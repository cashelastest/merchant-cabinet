import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getDeals, getUser } from '../../api/deals';
import type { Deal, User } from '../../types/index';
import styles from '../deals/DealsPage.module.css';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  accepted: { bg: '#1a4d1a', color: '#4ade80' },
  refused:  { bg: '#4d1a1a', color: '#f87171' },
};

function getValue(values: Record<string, unknown>, key: string): string {
  const v = values[key];
  return v !== undefined && v !== null ? String(v) : '—';
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [filterId, setFilterId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterXml, setFilterXml] = useState('');

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDeals({
        deal_id: filterId ? Number(filterId) : undefined,
        status: filterStatus || undefined,
        from_xml: filterXml || undefined,
      });
      setDeals(data.filter((d) => d.status === 'accepted' || d.status === 'refused'));
    } finally {
      setLoading(false);
    }
  }, [filterId, filterStatus, filterXml]);

  useEffect(() => {
    fetchDeals();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDeals();
  };

  const handleUserClick = async (userId: number | null) => {
    if (!userId) return;
    const user = await getUser(userId);
    setSelectedUser(user);
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>{t('history.breadcrumb')}</div>

      <form className={styles.filterBar} onSubmit={handleSearch}>
        <input
          className={styles.filterInput}
          placeholder={t('history.filters.request_id')}
          value={filterId}
          onChange={(e) => setFilterId(e.target.value)}
          type="number"
          min="1"
        />
        <input
          className={styles.filterInput}
          placeholder={t('history.filters.currency')}
          value={filterXml}
          onChange={(e) => setFilterXml(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">{t('history.filters.all_statuses')}</option>
          <option value="accepted">{t('history.filters.completed')}</option>
          <option value="refused">{t('history.filters.rejected')}</option>
        </select>
        <button type="submit" className={styles.searchBtn}>{t('common.search')}</button>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => { setFilterId(''); setFilterStatus(''); setFilterXml(''); }}
        >
          {t('common.reset')}
        </button>
      </form>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('history.table.request_id')}</th>
              <th>{t('history.table.status')}</th>
              <th>{t('history.table.currency')}</th>
              <th>{t('history.table.country')}</th>
              <th>{t('history.table.wallet')}</th>
              <th>{t('history.table.amount')}</th>
              <th>{t('history.table.accepted_by')}</th>
              <th>{t('history.table.created')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className={styles.emptyState}>{t('common.loading')}</td></tr>
            )}
            {!loading && deals.length === 0 && (
              <tr><td colSpan={8} className={styles.emptyState}>{t('common.no_data')}</td></tr>
            )}
            {!loading && deals.map((deal) => {
              const sc = STATUS_COLORS[deal.status];
              const tv = deal.to_values;
              return (
                <tr key={deal.id} className={styles.rowInactive}>
                  <td className={styles.idCell}>#{deal.id} / uid:{deal.uid}</td>
                  <td>
                    <span className={styles.statusBadge} style={{ backgroundColor: sc.bg, color: sc.color }}>
                      {t(`history.status_label.${deal.status}`)}
                    </span>
                  </td>
                  <td className={styles.cell}>{deal.from_xml}</td>
                  <td className={styles.cell}>{getValue(tv, 'country')}</td>
                  <td className={styles.walletCell}>{getValue(tv, 'usdtWallet')}</td>
                  <td className={styles.amountCell}>{getValue(tv, 'outAmount')} {deal.from_xml}</td>
                  <td className={styles.cell}>
                    {deal.accepted_by_username ? (
                      <span style={{ color: '#60a5fa', cursor: 'pointer' }} onClick={() => handleUserClick(deal.accepted_by)}>
                        {deal.accepted_by_username}
                      </span>
                    ) : (
                      <span style={{ color: '#666' }}>—</span>
                    )}
                  </td>
                  <td className={styles.cell}>
                    {new Date(deal.created_at).toLocaleString('en-GB', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setSelectedUser(null)}>
          <div style={{
            backgroundColor: '#1a1a1a', color: '#fff', padding: '20px', borderRadius: '8px',
            maxWidth: '400px', width: '90%', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
              {t('user_details.title')}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>{t('user_details.username')}:</strong> {selectedUser.username}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>{t('user_details.balance')}:</strong> {selectedUser.balance}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>{t('user_details.status')}:</strong> {selectedUser.is_active ? t('user_details.active') : t('user_details.inactive')}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>{t('user_details.payout_currencies')}:</strong> {selectedUser.currencies.join(', ')}
            </div>
            <button onClick={() => setSelectedUser(null)} style={{
              backgroundColor: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 16px',
              borderRadius: '4px', cursor: 'pointer', marginTop: '10px',
            }}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
