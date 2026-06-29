import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import LanguageSwitcher from '../../components/LanguageSwitcher/LanguageSwitcher';
import styles from './PayoutPage.module.css';

interface Payout {
  id: number;
  amount: number;
  wallet_address: string;
  currency: string;
  status: string;
  created_at: string;
}

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
    } catch {
      console.error('Failed to load payouts');
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
              <th>Wallet</th>
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
            {!loading && payouts.map((p) => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>{p.amount.toLocaleString()}</td>
                <td>{p.currency}</td>
                <td className={styles.wallet}>{p.wallet_address.substring(0, 16)}...</td>
                <td>
                  <span className={p.status === 'pending' ? styles.badgePending : styles.badgeCompleted}>
                    {p.status}
                  </span>
                </td>
                <td>{fmt(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
