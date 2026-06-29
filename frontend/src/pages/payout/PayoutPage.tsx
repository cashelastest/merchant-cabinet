import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import CountdownTimer from '../../components/CountdownTimer/CountdownTimer';
import styles from './PayoutPage.module.css';

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
  wallet_address: string;
  currency: string;
  card_holder?: string;
  card_number?: string;
  phone_number?: string;
  bank_name?: string;
  status: string;
  created_at: string;
  receipt_url?: string;
}

export default function PayoutPage() {
  const { t } = useTranslation();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingReceipt, setUploadingReceipt] = useState<Record<number, boolean>>({});
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  useEffect(() => {
    fetchPayouts();
    const interval = setInterval(fetchPayouts, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPayouts = async () => {
    try {
      const data = await client.get<Payout[]>('/payout/').then((r) => r.data);
      setPayouts(data);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadReceipt = async (payoutId: number, file: File) => {
    setUploadingReceipt((p) => ({ ...p, [payoutId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/v1/admin/deals/${payoutId}/receipt/`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('merchantToken')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPayouts((prev) => prev.map((p) => p.id === payoutId ? { ...p, receipt_url: data.url } : p));
      }
    } catch {
      alert('Failed to upload receipt');
    } finally {
      setUploadingReceipt((p) => ({ ...p, [payoutId]: false }));
    }
  };

  const handleStatusChange = async (payoutId: number, newStatus: string) => {
    try {
      const response = await client.patch(`/payout/${payoutId}/status?status=${newStatus}`);
      setPayouts((prev) => prev.map((p) => p.id === payoutId ? { ...p, status: newStatus } : p));
    } catch {
      alert('Failed to update status');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>Payouts</div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Receipts</th>
              <th>Estimate</th>
              <th>{t('deals.table.request_id')}</th>
              <th>{t('deals.table.status')}</th>
              <th>{t('deals.table.currency')}</th>
              <th>Card Holder</th>
              <th>Card Number</th>
              <th>Phone Number</th>
              <th>External Bank Name</th>
              <th>{t('deals.table.amount')}</th>
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
                  <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <label style={{
                      backgroundColor: '#0066cc', color: '#fff', padding: '6px 12px',
                      borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                      border: 'none', display: 'block',
                    }}>
                      {uploadingReceipt[p.id] ? 'Uploading...' : 'Upload'}
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
                        View
                      </button>
                    )}
                  </td>

                  <td className={styles.timerCell}>
                    <CountdownTimer receivedAt={p.created_at} isActive={p.status === 'pending'} />
                  </td>

                  <td className={styles.idCell}>#{p.id}</td>

                  <td>
                    <select
                      value={p.status}
                      onChange={(e) => handleStatusChange(p.id, e.target.value)}
                      style={{
                        backgroundColor: sc.bg,
                        color: sc.color,
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '11px',
                      }}
                    >
                      {PAYOUT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className={styles.cell}>{p.currency}</td>
                  <td className={styles.cell}>{p.card_holder || '—'}</td>
                  <td className={styles.cell}>{p.card_number || '—'}</td>
                  <td className={styles.cell}>{p.phone_number || '—'}</td>
                  <td className={styles.cell}>{p.bank_name || '—'}</td>
                  <td className={styles.amountCell}>{p.amount} {p.currency}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
