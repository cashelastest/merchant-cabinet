import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getDeals } from '../../api/deals';
import type { Deal } from '../../types/index';
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
              <th>{t('history.table.created')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className={styles.emptyState}>{t('common.loading')}</td></tr>
            )}
            {!loading && deals.length === 0 && (
              <tr><td colSpan={7} className={styles.emptyState}>{t('common.no_data')}</td></tr>
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

    </div>
  );
}
