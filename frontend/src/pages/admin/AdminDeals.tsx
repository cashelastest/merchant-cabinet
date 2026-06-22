import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import adminClient from '../../api/adminClient';
import styles from './Admin.module.css';

interface AdminDeal {
  id: number;
  uid: number;
  from_xml: string;
  from_name: string;
  to_name: string;
  to_values: Record<string, unknown>;
  status: string;
  accepted_by: number | null;
  accepted_at: string | null;
  received_at: string | null;
  created_at: string;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString('ru-RU');
}

export default function AdminDeals() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<AdminDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState('accepted');
  const [todayOnly, setTodayOnly] = useState(true);

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (todayOnly) {
        params.set('today', 'true');
      } else {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
      }
      if (status) params.set('status', status);
      const data = await adminClient
        .get<AdminDeal[]>(`/admin/deals?${params}`)
        .then((r) => r.data);
      setDeals(data);
    } catch {
      setError('Access denied or session expired');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = deals.reduce((sum, d) => {
    const v = d.to_values?.outAmount;
    return sum + (typeof v === 'number' ? v : 0);
  }, 0);

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>Admin — Deals History</h1>
        <div className={styles.topbarActions}>
          <button className={styles.navBtn} onClick={() => navigate('/admin/users')}>
            Users
          </button>
          <button className={styles.navBtn} onClick={() => navigate('/admin/logs')}>
            Logs
          </button>
          <button className={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Filters */}
      <form className={styles.filterBar} onSubmit={fetchDeals}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={todayOnly}
            onChange={(e) => setTodayOnly(e.target.checked)}
          />
          Today
        </label>

        <input
          type="date"
          className={styles.dateInput}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          disabled={todayOnly}
        />
        <span className={styles.dateSep}>—</span>
        <input
          type="date"
          className={styles.dateInput}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          disabled={todayOnly}
        />

        <select
          className={styles.filterSelect}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All closed</option>
          <option value="accepted">Accepted</option>
          <option value="refused">Refused</option>
        </select>

        <button type="submit" className={styles.saveBtn}>
          Apply
        </button>
      </form>

      {/* Summary */}
      <div className={styles.summary}>
        <span>Total deals: <strong>{deals.length}</strong></span>
        <span>Total amount: <strong>{totalAmount.toLocaleString()} (outAmount)</strong></span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : deals.length === 0 ? (
        <div className={styles.empty}>No deals found</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>UID</th>
                <th>Currency</th>
                <th>Recipient</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Accepted At</th>
                <th>Received At</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const amount = d.to_values?.outAmount;
                return (
                  <tr key={d.id}>
                    <td>#{d.id}</td>
                    <td>{d.uid}</td>
                    <td>{d.from_xml}</td>
                    <td>{d.to_name}</td>
                    <td>{typeof amount === 'number' ? amount.toLocaleString() : '—'} {d.from_xml}</td>
                    <td>
                      <span className={d.status === 'accepted' ? styles.badgeActive : styles.badgePaused}>
                        {d.status}
                      </span>
                    </td>
                    <td>{fmt(d.accepted_at)}</td>
                    <td>{fmt(d.received_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
