import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import LanguageSwitcher from '../../components/LanguageSwitcher/LanguageSwitcher';
import styles from './PayoutPage.module.css';

interface Payout {
  id: number;
  amount: number;
  wallet_address: string;
  status: string;
  created_at: string;
}

export default function PayoutPage() {
  const { t } = useTranslation();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [currency, setCurrency] = useState('USDT');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setError('Failed to load payouts');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await adminClient.post('/payout/', {
        amount: parseFloat(amount),
        wallet_address: wallet,
        currency,
      });
      setSuccess(`Payout created: ${response.data.amount} ${currency}`);
      setAmount('');
      setWallet('');
      setCurrency('USDT');
      fetchPayouts();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create payout');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (iso: string) => new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString('ru-RU');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Payout</h1>
        <LanguageSwitcher />
      </div>

      <div className={styles.container}>
        <div className={styles.formSection}>
          <h2>Create Payout</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Amount</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Wallet Address</label>
              <input
                type="text"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0x..."
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USDT">USDT</option>
                <option value="CASHUSD">CASHUSD</option>
              </select>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Payout'}
            </button>
          </form>

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}
        </div>

        <div className={styles.listSection}>
          <h2>Payouts ({payouts.length})</h2>
          {payouts.length === 0 ? (
            <p>No payouts yet</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Amount</th>
                    <th>Wallet</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td>#{p.id}</td>
                      <td>{p.amount}</td>
                      <td className={styles.wallet}>{p.wallet_address.substring(0, 12)}...</td>
                      <td>
                        <span className={p.status === 'pending' ? styles.pending : styles.completed}>
                          {p.status}
                        </span>
                      </td>
                      <td>{fmt(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
