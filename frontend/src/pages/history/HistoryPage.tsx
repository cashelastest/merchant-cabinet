import { useState, useEffect, useCallback } from 'react';
import { getDeals } from '../../api/deals';
import type { Deal } from '../../types';
import styles from '../deals/DealsPage.module.css';

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  accepted: { bg: '#1a4d1a', color: '#4ade80', label: 'ВЫПОЛНЕНА' },
  refused:  { bg: '#4d1a1a', color: '#f87171', label: 'ОТКЛОНЕНА' },
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#2a2a2a', color: '#9ca3af', label: status.toUpperCase() };
}

function getValue(values: Record<string, unknown>, key: string): string {
  const v = values[key];
  return v !== undefined && v !== null ? String(v) : '—';
}

export default function HistoryPage() {
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
      <div className={styles.breadcrumb}>History / List</div>

      <form className={styles.filterBar} onSubmit={handleSearch}>
        <input
          className={styles.filterInput}
          placeholder="Request ID"
          value={filterId}
          onChange={(e) => setFilterId(e.target.value)}
          type="number"
          min="1"
        />
        <input
          className={styles.filterInput}
          placeholder="Currency (from_xml)"
          value={filterXml}
          onChange={(e) => setFilterXml(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="accepted">Выполнена</option>
          <option value="refused">Отклонена</option>
        </select>
        <button type="submit" className={styles.searchBtn}>Search</button>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => { setFilterId(''); setFilterStatus(''); setFilterXml(''); }}
        >
          Reset
        </button>
      </form>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Request Id</th>
              <th>Status</th>
              <th>Currency</th>
              <th>Country</th>
              <th>USDT Wallet</th>
              <th>Amount</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className={styles.emptyState}>Loading…</td></tr>
            )}
            {!loading && deals.length === 0 && (
              <tr><td colSpan={7} className={styles.emptyState}>No history found</td></tr>
            )}
            {!loading && deals.map((deal) => {
              const ss = getStatusStyle(deal.status);
              const tv = deal.to_values;
              return (
                <tr key={deal.id} className={styles.rowInactive}>
                  <td className={styles.idCell}>#{deal.id} / uid:{deal.uid}</td>
                  <td>
                    <span className={styles.statusBadge} style={{ backgroundColor: ss.bg, color: ss.color }}>
                      {ss.label}
                    </span>
                  </td>
                  <td className={styles.cell}>{deal.from_xml}</td>
                  <td className={styles.cell}>{getValue(tv, 'country')}</td>
                  <td className={styles.walletCell}>{getValue(tv, 'usdtWallet')}</td>
                  <td className={styles.amountCell}>{getValue(tv, 'outAmount')} {deal.from_xml}</td>
                  <td className={styles.cell}>
                    {new Date(deal.created_at).toLocaleString('ru-RU', {
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
