import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import CountdownTimer from '../../components/CountdownTimer/CountdownTimer';
import styles from './PayoutPage.module.css';

const FIVE_MINUTES_SECONDS = 300;
const POLL_INTERVAL_MS = 5000;

const RECEIPT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp';
const RECEIPT_MAX_SIZE = 10 * 1024 * 1024;

const PAYOUT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled'];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#2d2a1a', color: '#fbbf24' },
  processing: { bg: '#1a3a4d', color: '#60a5fa' },
  completed: { bg: '#1a4d1a', color: '#4ade80' },
  failed:    { bg: '#4d1a1a', color: '#ef4444' },
  cancelled: { bg: '#3a2a1a', color: '#a0a0a0' },
};

interface Payout {
  id: number;
  amount: number;
  currency: string;
  card_holder?: string;
  card_number?: string;
  phone_number?: string;
  bank_name?: string;
  status: string;
  created_at: string;
  receipt_url?: string;
  user_username?: string;
}

export default function PayoutPage() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingReceipt, setUploadingReceipt] = useState<Record<number, boolean>>({});
  const [receipt, setReceipt] = useState<{ payoutId: number; url: string; isPdf: boolean } | null>(null);
  const receiptUrlRef = useRef<string | null>(null);

  useEffect(() => {
    fetchPayouts();
    const interval = setInterval(pollPayouts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // release the last blob URL when leaving the page
  useEffect(() => () => {
    if (receiptUrlRef.current) URL.revokeObjectURL(receiptUrlRef.current);
  }, []);

  const fetchPayouts = async () => {
    try {
      const data = await client.get<Payout[]>('/payout/').then((r) => r.data);
      setPayouts(data);
    } catch {
      // an empty table would otherwise be indistinguishable from a failed load
      alert('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const pollPayouts = async () => {
    try {
      const data = await client.get<Payout[]>('/payout/').then((r) => r.data);
      setPayouts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPayouts = data.filter((p) => !existingIds.has(p.id));
        if (newPayouts.length > 0) {
          return [...newPayouts, ...prev];
        }
        return prev;
      });
    } catch {
      // transient poll failure — the next tick retries
    }
  };

  const handleUploadReceipt = async (payoutId: number, file: File) => {
    if (file.size > RECEIPT_MAX_SIZE) {
      alert('File is too large (max 10 MB)');
      return;
    }
    setUploadingReceipt((p) => ({ ...p, [payoutId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await client.post<{ url: string }>(`/payout/${payoutId}/receipt/`, formData);
      setPayouts((prev) => prev.map((p) => p.id === payoutId ? { ...p, receipt_url: data.url } : p));
    } catch {
      alert('Failed to upload receipt');
    } finally {
      setUploadingReceipt((p) => ({ ...p, [payoutId]: false }));
    }
  };

  const closeReceipt = () => {
    if (receiptUrlRef.current) {
      URL.revokeObjectURL(receiptUrlRef.current);
      receiptUrlRef.current = null;
    }
    setReceipt(null);
  };

  // Receipts are behind auth, so the file is fetched as a blob rather than
  // linked directly — an <img src> would carry no Authorization header.
  const handleViewReceipt = async (payout: Payout) => {
    if (!payout.receipt_url) return;
    try {
      const { data: blob } = await client.get<Blob>(`/payout/${payout.id}/receipt`, {
        responseType: 'blob',
      });
      closeReceipt();
      const url = URL.createObjectURL(blob);
      receiptUrlRef.current = url;
      setReceipt({
        payoutId: payout.id,
        url,
        isPdf: blob.type === 'application/pdf' || payout.receipt_url.toLowerCase().endsWith('.pdf'),
      });
    } catch {
      alert('Failed to load receipt');
    }
  };

  const handleStatusChange = async (payoutId: number, newStatus: string) => {
    try {
      await client.patch(`/payout/${payoutId}/status?status=${newStatus}`);
      setPayouts((prev) => prev.map((p) => p.id === payoutId ? { ...p, status: newStatus } : p));

      if (newStatus === 'completed') {
        await refreshUser();
      }
    } catch {
      alert('Failed to update status');
    }
  };


  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>{t('admin.payouts.title')}</div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('admin.payouts.table.id')}</th>
              <th>{t('admin.payouts.table.time')}</th>
              <th>{t('admin.payouts.table.amount')}</th>
              <th>{t('admin.payouts.table.currency')}</th>
              <th>{t('admin.payouts.columns.card_holder')}</th>
              <th>{t('admin.payouts.columns.card_number')}</th>
              <th>{t('admin.payouts.columns.phone_number')}</th>
              <th>{t('admin.payouts.columns.bank_name')}</th>
              <th>{t('admin.payouts.table.status')}</th>
              <th>{t('admin.payouts.table.receipt')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className={styles.emptyState}>{t('common.loading')}</td>
              </tr>
            )}
            {!loading && payouts.length === 0 && (
              <tr>
                <td colSpan={10} className={styles.emptyState}>{t('common.no_data')}</td>
              </tr>
            )}
            {!loading && payouts.map((p) => {
              const sc = STATUS_COLORS[p.status] || { bg: '#1a3a4d', color: '#60a5fa' };

              return (
                <tr key={p.id} className={styles.rowInactive}>
                  <td className={styles.idCell}>#{p.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <CountdownTimer
                        receivedAt={p.created_at}
                        isActive={p.status !== 'completed' && p.status !== 'cancelled'}
                        estimate={FIVE_MINUTES_SECONDS}
                      />
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        {new Date(p.created_at + (p.created_at.endsWith('Z') ? '' : 'Z')).toLocaleTimeString('ru-RU')}
                      </div>
                    </div>
                  </td>
                  <td className={styles.amountCell}>{p.amount}</td>
                  <td>{p.currency}</td>
                  <td>{p.card_holder || '—'}</td>
                  <td>{p.card_number || '—'}</td>
                  <td>{p.phone_number || '—'}</td>
                  <td>{p.bank_name || '—'}</td>
                  <td>
                    {p.status === 'completed' || p.status === 'cancelled' ? (
                      <span className={p.status === 'completed' ? styles.statusBadge : styles.statusBadgePending}>
                        {p.status}
                      </span>
                    ) : (
                      <select
                        value={p.status}
                        onChange={(e) => handleStatusChange(p.id, e.target.value)}
                        style={{
                          backgroundColor: '#0a0a0a',
                          color: STATUS_COLORS[p.status]?.color || '#60a5fa',
                          border: `1px solid ${STATUS_COLORS[p.status]?.color || '#60a5fa'}`,
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        {PAYOUT_STATUSES.map((status) => (
                          <option key={status} value={status} style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>
                            {status}
                          </option>
                        ))}
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
                        accept={RECEIPT_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) handleUploadReceipt(p.id, file);
                        }}
                        style={{ display: 'none' }}
                        disabled={uploadingReceipt[p.id]}
                      />
                    </label>
                    {p.receipt_url && (
                      <button
                        onClick={() => handleViewReceipt(p)}
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
              );
            })}
          </tbody>
        </table>
      </div>

      {receipt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
        }} onClick={closeReceipt}>
          <div style={{
            backgroundColor: '#1a1a1a', padding: '20px', borderRadius: '8px',
            maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>
                {t('admin.payouts.table.receipt')} — #{receipt.payoutId}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={receipt.url}
                  download={`receipt_payout_${receipt.payoutId}${receipt.isPdf ? '.pdf' : ''}`}
                  style={{
                    backgroundColor: '#0066cc', color: '#fff', padding: '8px 12px',
                    borderRadius: '4px', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold',
                  }}
                >
                  {t('common.download', { defaultValue: 'Download' })}
                </a>
                <button onClick={closeReceipt} style={{
                  backgroundColor: '#2a2a2a', color: '#fff', border: 'none', padding: '8px 12px',
                  borderRadius: '4px', cursor: 'pointer',
                }}>
                  ✕
                </button>
              </div>
            </div>
            {receipt.isPdf ? (
              <iframe src={receipt.url} title="receipt" style={{ width: '100%', height: '500px', border: 'none' }} />
            ) : (
              <img src={receipt.url} alt="receipt" style={{ width: '100%', borderRadius: '4px' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
