import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import LanguageSwitcher from '../../components/LanguageSwitcher/LanguageSwitcher';
import styles from './Admin.module.css';

interface AdminDeal {
  id: number;
  uid: number;
  user_id: number;
  from_xml: string;
  from_name: string;
  to_xml: string;
  to_name: string;
  to_values: Record<string, unknown>;
  receipt_url: string | null;
  status: string;
  accepted_by: number | null;
  accepted_by_username: string | null;
  accepted_at: string | null;
  received_at: string | null;
  created_at: string | null;
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleString('ru-RU');
}

function val(values: Record<string, unknown>, key: string): string {
  const v = values?.[key];
  return v !== undefined && v !== null ? String(v) : '—';
}

export default function AdminDeals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<AdminDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ dealId: number; url: string; isPdf: boolean } | null>(null);

  // Unlike the payouts page, the range is left empty on purpose: an admin
  // opening this page expects to see everything, not just today.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (status) params.set('status', status);
      if (userId) params.set('user_id', userId);
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

  const closeReceipt = () => {
    setReceipt((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  // Deal receipts sit behind auth; admins pass the ownership check by is_admin.
  const handleViewReceipt = async (deal: AdminDeal) => {
    if (!deal.receipt_url) return;
    try {
      const { data: blob } = await adminClient.get<Blob>(
        deal.receipt_url.replace(/^\/api\/v1/, ''),
        { responseType: 'blob' },
      );
      setReceipt((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return {
          dealId: deal.id,
          url: URL.createObjectURL(blob),
          isPdf: blob.type === 'application/pdf',
        };
      });
    } catch {
      alert('Failed to load receipt');
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>Deals</h1>
        <div className={styles.topbarActions}>
          <LanguageSwitcher />
          <button className={styles.navBtn} onClick={() => navigate('/admin/users')}>
            {t('nav.admin_users')}
          </button>
          <button className={styles.logoutBtn} onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>

      <form className={styles.filterBar} onSubmit={fetchDeals}>
        <input
          type="date"
          className={styles.dateInput}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <span className={styles.dateSep}>—</span>
        <input
          type="date"
          className={styles.dateInput}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />

        <select
          className={styles.filterSelect}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t('admin.payouts.filters.all_statuses')}</option>
          <option value="pending">pending</option>
          <option value="in_progress">in_progress</option>
          <option value="accepted">accepted</option>
          <option value="refused">refused</option>
        </select>

        <input
          className={styles.filterInput}
          placeholder="User ID"
          type="number"
          min="1"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />

        <button type="submit" className={styles.saveBtn}>
          {t('admin.payouts.buttons.apply')}
        </button>
      </form>

      <div className={styles.summary}>
        <span>Deals: <strong>{deals.length}</strong></span>
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
                <th>Merchant</th>
                <th>Status</th>
                <th>Payout currency</th>
                <th>Amount</th>
                <th>Card Holder</th>
                <th>Card Number</th>
                <th>Bank</th>
                <th>Created</th>
                <th>Accepted by</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td>#{d.id}</td>
                  <td>{d.uid}</td>
                  <td>{d.user_id}</td>
                  <td>{d.status}</td>
                  <td>{d.to_xml}</td>
                  <td>{val(d.to_values, 'outAmount')}</td>
                  <td>{val(d.to_values, 'cardHolder')}</td>
                  <td>{val(d.to_values, 'cardNumber')}</td>
                  <td>{val(d.to_values, 'bankName')}</td>
                  <td>{fmt(d.created_at)}</td>
                  <td>{d.accepted_by_username ?? '—'}</td>
                  <td>
                    {d.receipt_url ? (
                      <button
                        onClick={() => handleViewReceipt(d)}
                        style={{
                          backgroundColor: '#1a3a60', color: '#60a5fa', padding: '6px 12px',
                          borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
                          fontWeight: 'bold', border: '1px solid #2563eb',
                        }}
                      >
                        {t('admin.payouts.buttons.view')}
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {receipt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1001,
        }} onClick={closeReceipt}>
          <div style={{
            backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px',
            maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: '15px',
            }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Receipt — deal #{receipt.dealId}</h3>
              <button onClick={closeReceipt} style={{
                backgroundColor: '#2a2a2a', color: '#fff', border: 'none',
                padding: '8px 12px', borderRadius: '4px', cursor: 'pointer',
              }}>
                ✕
              </button>
            </div>
            {receipt.isPdf ? (
              <iframe
                src={receipt.url}
                title="receipt"
                style={{ width: '100%', height: '500px', border: 'none' }}
              />
            ) : (
              <img src={receipt.url} alt="receipt" style={{ width: '100%', borderRadius: '4px' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
