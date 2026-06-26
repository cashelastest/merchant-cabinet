import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import LanguageSwitcher from '../../components/LanguageSwitcher/LanguageSwitcher';
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
  accepted_by_username?: string | null;
  accepted_at: string | null;
  received_at: string | null;
  created_at: string;
}

interface AdminUser {
  id: number;
  username: string;
  balance: number;
  is_active: boolean;
  currencies: string[];
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString('ru-RU');
}

export default function AdminDeals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<AdminDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

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

  const handleUserClick = async (userId: number) => {
    try {
      const user = await adminClient.get<AdminUser>(`/admin/users/${userId}`).then((r) => r.data);
      setSelectedUser(user);
    } catch {
      alert('Failed to load user details');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>{t('admin.deals.breadcrumb')}</h1>
        <div className={styles.topbarActions}>
          <LanguageSwitcher />
          <button className={styles.navBtn} onClick={() => navigate('/admin/users')}>
            {t('nav.admin_users')}
          </button>
          <button className={styles.navBtn} onClick={() => navigate('/admin/logs')}>
            {t('nav.admin_logs')}
          </button>
          <button className={styles.logoutBtn} onClick={logout}>{t('nav.logout')}</button>
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
                <th>{t('admin.deals.table.accepted_by')}</th>
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
                      <select
                        value={d.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          adminClient.patch(`/deals/${d.id}/status?status=${newStatus}`).catch(() => {
                            alert('Failed to update status');
                          });
                          setDeals((prev) => prev.map((deal) =>
                            deal.id === d.id ? { ...deal, status: newStatus } : deal
                          ));
                        }}
                        style={{
                          backgroundColor: d.status === 'accepted' ? '#1a4d1a' : d.status === 'refused' ? '#4d1a1a' : '#2a2a2a',
                          color: d.status === 'accepted' ? '#4ade80' : d.status === 'refused' ? '#f87171' : '#ccc',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                        }}
                      >
                        <option value="pending">pending</option>
                        <option value="in_progress">in_progress</option>
                        <option value="accepted">accepted</option>
                        <option value="refused">refused</option>
                      </select>
                    </td>
                    <td>
                      {d.accepted_by_username && d.accepted_by ? (
                        <span style={{ color: '#60a5fa', cursor: 'pointer' }} onClick={() => handleUserClick(d.accepted_by!)}>
                          {d.accepted_by_username}
                        </span>
                      ) : (
                        <span style={{ color: '#666' }}>—</span>
                      )}
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

      {selectedUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setSelectedUser(null)}>
          <div style={{
            backgroundColor: '#1a1a1a', color: '#fff', padding: '20px', borderRadius: '8px',
            maxWidth: '500px', width: '90%', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
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
