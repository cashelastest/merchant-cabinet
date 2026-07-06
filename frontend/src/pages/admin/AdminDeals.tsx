import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import LanguageSwitcher from '../../components/LanguageSwitcher/LanguageSwitcher';
import styles from './Admin.module.css';

interface AdminPayout {
  id: number;
  user_id: number;
  amount: number;
  currency: string;
  card_holder: string | null;
  card_number: string | null;
  phone_number: string | null;
  bank_name: string | null;
  receipt_url: string | null;
  status: string;
  created_at: string;
  user_username: string | null;
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

export default function AdminPayouts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<Record<number, boolean>>({});
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState('accepted');
  const [todayOnly, setTodayOnly] = useState(true);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async (e?: FormEvent) => {
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
        .get<AdminPayout[]>(`/admin/payouts?${params}`)
        .then((r) => r.data);
      setPayouts(data);
    } catch {
      setError('Access denied or session expired');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };


  const handleUploadReceipt = async (payoutId: number, file: File) => {
    setUploadingReceipt((p) => ({ ...p, [payoutId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await adminClient.post<{ url: string }>(`/admin/payouts/${payoutId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPayouts((prev) => prev.map((p) => p.id === payoutId ? { ...p, receipt_url: response.data.url } : p));
    } catch {
      alert('Failed to upload receipt');
    } finally {
      setUploadingReceipt((p) => ({ ...p, [payoutId]: false }));
    }
  };

  const handleStatusChange = async (payoutId: number, newStatus: string) => {
    try {
      await adminClient.patch(`/admin/payouts/${payoutId}/status?status=${newStatus}`);
      setPayouts((prev) => prev.map((p) => p.id === payoutId ? { ...p, status: newStatus } : p));
    } catch (e: any) {
      alert(`Failed to update status: ${e.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleResetBalance = async (userId: number) => {
    if (!window.confirm('Are you sure you want to reset this user\'s balance to 0?')) {
      return;
    }
    try {
      await adminClient.post(`/admin/users/${userId}/reset-balance`);
      setUserBalance(0);
      alert('Balance reset to 0');
    } catch (e: any) {
      alert(`Failed to reset balance: ${e.response?.data?.detail || 'Unknown error'}`);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>{t('admin.payouts.title')}</h1>
        <div className={styles.topbarActions}>
          <LanguageSwitcher />
          <button className={styles.navBtn} onClick={() => navigate('/admin/users')}>
            {t('nav.admin_users')}
          </button>
          <button className={styles.logoutBtn} onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>

      {/* Filters */}
      <form className={styles.filterBar} onSubmit={fetchPayouts}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={todayOnly}
            onChange={(e) => setTodayOnly(e.target.checked)}
          />
          {t('admin.payouts.filters.today_only')}
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
          <option value="">{t('admin.payouts.filters.all_statuses')}</option>
          <option value="pending">pending</option>
          <option value="processing">processing</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </select>

        <button type="submit" className={styles.saveBtn}>
          {t('admin.payouts.buttons.apply')}
        </button>
      </form>

      {/* Summary */}
      <div className={styles.summary}>
        <span>{t('admin.payouts.table.total_payouts')}: <strong>{payouts.length}</strong></span>
        <span>{t('admin.payouts.table.total_amount')}: <strong>{totalAmount.toLocaleString()}</strong></span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.empty}>{t('common.loading')}</div>
      ) : payouts.length === 0 ? (
        <div className={styles.empty}>{t('common.no_data')}</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.payouts.table.id')}</th>
                <th>{t('admin.payouts.table.user')}</th>
                <th>{t('admin.payouts.table.amount')}</th>
                <th>{t('admin.payouts.table.currency')}</th>
                <th>Получатель</th>
                <th>Номер карты</th>
                <th>Телефон</th>
                <th>Банк</th>
                <th>{t('admin.payouts.table.status')}</th>
                <th>{t('admin.payouts.table.receipt')}</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td>
                    {p.user_username ? (
                      <span
                        onClick={() => navigate(`/admin/deals/${p.user_id}`)}
                        style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {p.user_username}
                      </span>
                    ) : (
                      <span style={{ color: '#666' }}>—</span>
                    )}
                  </td>
                  <td>{p.amount.toLocaleString()}</td>
                  <td>{p.currency}</td>
                  <td>{p.card_holder || '—'}</td>
                  <td>{p.card_number || '—'}</td>
                  <td>{p.phone_number || '—'}</td>
                  <td>{p.bank_name || '—'}</td>
                  <td>
                    {p.status === 'completed' || p.status === 'cancelled' ? (
                      <span className={p.status === 'completed' ? styles.badgeActive : styles.badgePaused}>
                        {p.status}
                      </span>
                    ) : (
                      <select
                        value={p.status}
                        onChange={(e) => handleStatusChange(p.id, e.target.value)}
                        style={{
                          backgroundColor: '#1a1a1a',
                          color: p.status === 'completed' ? '#4ade80' : '#f87171',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        <option value="pending">pending</option>
                        <option value="processing">processing</option>
                        <option value="completed">completed</option>
                        <option value="failed">failed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <label style={{
                      backgroundColor: '#0066cc', color: '#fff', padding: '6px 12px',
                      borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                      border: 'none', display: 'block',
                    }}>
                      {uploadingReceipt[p.id] ? t('admin.payouts.buttons.uploading') : t('admin.payouts.buttons.upload')}
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadReceipt(p.id, file);
                        }}
                        style={{ display: 'none' }}
                        disabled={uploadingReceipt[p.id]}
                      />
                    </label>
                    {p.receipt_url && (
                      <button
                        onClick={() => setViewingReceipt(p.receipt_url!)}
                        style={{
                          backgroundColor: '#4ade80', color: '#000', padding: '6px 12px',
                          borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                          border: 'none',
                        }}
                      >
                        {t('admin.payouts.buttons.view')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <h3 style={{ margin: 0, color: '#fff' }}>{t('admin.payouts.table.receipt')}</h3>
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
