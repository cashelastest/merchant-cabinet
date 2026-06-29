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
  receipt_url?: string | null;
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
  const [uploadingReceipt, setUploadingReceipt] = useState<Record<number, boolean>>({});
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

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

  const handleUploadReceipt = async (dealId: number, file: File) => {
    setUploadingReceipt((p) => ({ ...p, [dealId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await adminClient.post<{ url: string }>(`/admin/deals/${dealId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, receipt_url: response.data.url } : d));
    } catch {
      alert('Failed to upload receipt');
    } finally {
      setUploadingReceipt((p) => ({ ...p, [dealId]: false }));
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
                <th>Receipt</th>
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
                    <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <label style={{
                        backgroundColor: '#0066cc', color: '#fff', padding: '6px 12px',
                        borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                        border: 'none', display: 'block',
                      }}>
                        {uploadingReceipt[d.id] ? 'Uploading...' : 'Upload'}
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadReceipt(d.id, file);
                          }}
                          style={{ display: 'none' }}
                          disabled={uploadingReceipt[d.id]}
                        />
                      </label>
                      {d.receipt_url && (
                        <button
                          onClick={() => setViewingReceipt(d.receipt_url!)}
                          style={{
                            backgroundColor: '#4ade80', color: '#000', padding: '6px 12px',
                            borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                            border: 'none',
                          }}
                        >
                          View
                        </button>
                      )}
                    </td>
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

      {viewingReceipt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
        }} onClick={() => setViewingReceipt(null)}>
          <div style={{
            backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px',
            maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Receipt</h3>
              <button onClick={() => setViewingReceipt(null)} style={{
                backgroundColor: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 12px',
                borderRadius: '4px', cursor: 'pointer',
              }}>
                ✕
              </button>
            </div>
            {viewingReceipt.endsWith('.pdf') ? (
              <embed src={viewingReceipt} type="application/pdf" style={{ width: '100%', height: '500px' }} />
            ) : (
              <img src={viewingReceipt} alt="receipt" style={{ width: '100%', borderRadius: '4px' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
