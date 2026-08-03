import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import LanguageSwitcher from '../../components/LanguageSwitcher/LanguageSwitcher';
import styles from './Admin.module.css';

interface AdminDeal {
  id: number;
  uid: number;
  user_id: number;
  from_xml: string;
  to_xml: string;
  status: string;
  to_values: { outAmount?: number; cardHolder?: string; cardNumber?: string; phoneNumber?: string; bankName?: string; [key: string]: any };
  receipt_url: string | null;
  created_at: string;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString('ru-RU');
}

export default function AdminDeals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [deals, setDeals] = useState<AdminDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<Record<number, boolean>>({});
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  useEffect(() => {
    fetchDeals();
  }, [userId]);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const data = await adminClient
        .get<AdminDeal[]>(`/admin/deals/${userId}`)
        .then((r) => r.data);
      setDeals(data);
    } catch {
      setError('Access denied or session expired');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const handleUploadReceipt = async (dealId: number, file: File) => {
    setUploadingReceipt((p) => ({ ...p, [dealId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await adminClient.post<{ receipt_url: string }>(`/deal/${dealId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, receipt_url: response.data.receipt_url } : d));
    } catch {
      alert('Failed to upload receipt');
    } finally {
      setUploadingReceipt((p) => ({ ...p, [dealId]: false }));
    }
  };

  const handleStatusChange = async (dealId: number, newStatus: string) => {
    try {
      await adminClient.patch(`/deal/${dealId}/status?status=${newStatus}`);
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, status: newStatus } : d));
    } catch (e: any) {
      alert(`Failed to update status: ${e.response?.data?.detail || 'Unknown error'}`);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>Deal Management</h1>
        <div className={styles.topbarActions}>
          <LanguageSwitcher />
          <button className={styles.navBtn} onClick={() => navigate('/admin/users')}>
            {t('nav.admin_users')}
          </button>
          <button className={styles.logoutBtn} onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.empty}>{t('common.loading')}</div>
      ) : deals.length === 0 ? (
        <div className={styles.empty}>{t('common.no_data')}</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>UID</th>
                <th>From</th>
                <th>To</th>
                <th>Amount</th>
                <th>Card Holder</th>
                <th>Status</th>
                <th>Receipt</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td>#{d.id}</td>
                  <td>{d.uid}</td>
                  <td>{d.from_xml}</td>
                  <td>{d.to_xml}</td>
                  <td>{d.to_values?.outAmount ? Number(d.to_values.outAmount).toLocaleString() : '—'}</td>
                  <td>{d.to_values?.cardHolder || '—'}</td>
                  <td>
                    {d.status === 'accepted' || d.status === 'refused' ? (
                      <span className={d.status === 'accepted' ? styles.badgeActive : styles.badgePaused}>
                        {d.status}
                      </span>
                    ) : (
                      <select
                        value={d.status}
                        onChange={(e) => handleStatusChange(d.id, e.target.value)}
                        style={{
                          backgroundColor: '#1a1a1a',
                          color: '#fff',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        <option value="pending">pending</option>
                        <option value="in_progress">in_progress</option>
                        <option value="accepted">accepted</option>
                        <option value="refused">refused</option>
                      </select>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <label style={{
                      backgroundColor: '#0066cc', color: '#fff', padding: '6px 12px',
                      borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                      border: 'none', display: 'block',
                    }}>
                      {uploadingReceipt[d.id] ? '...' : 'Upload'}
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
                  <td>{fmt(d.created_at)}</td>
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
