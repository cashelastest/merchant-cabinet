import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import styles from './PayoutPage.module.css';

interface Payout {
  id: number;
  amount: number;
  wallet_address: string;
  currency: string;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#2d2a1a', color: '#fbbf24' },
  completed: { bg: '#1a4d1a', color: '#4ade80' },
};

export default function PayoutPage() {
  const { t } = useTranslation();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      const data = await adminClient
        .get<Payout[]>('/payout/')
        .then((r) => r.data);
      setPayouts(data);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (iso: string) => new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString('ru-RU');

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>Payouts</div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Wallet Address</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className={styles.emptyState}>Loading…</td>
              </tr>
            )}
            {!loading && payouts.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyState}>No payouts</td>
              </tr>
            )}
            {!loading && payouts.map((p) => {
              const sc = STATUS_COLORS[p.status] || { bg: '#1a3a4d', color: '#60a5fa' };
              return (
                <tr key={p.id}>
                  <td className={styles.idCell}>#{p.id}</td>
                  <td className={styles.cell}>{p.amount.toLocaleString()}</td>
                  <td className={styles.cell}>{p.currency}</td>
                  <td className={styles.cell}>{p.wallet_address.substring(0, 20)}...</td>
                  <td>
                    <span className={styles.statusBadge} style={{ backgroundColor: sc.bg, color: sc.color }}>
                      {p.status}
                    </span>
                  </td>
                  <td className={styles.cell}>{fmt(p.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
