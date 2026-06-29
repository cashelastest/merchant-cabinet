import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getDeals } from '../../api/deals';
import type { Deal } from '../../types';
import CountdownTimer from '../../components/CountdownTimer/CountdownTimer';
import styles from './PayoutPage.module.css';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:     { bg: '#1a3a4d', color: '#60a5fa' },
  in_progress: { bg: '#2d2a1a', color: '#fbbf24' },
  accepted:    { bg: '#1a4d1a', color: '#4ade80' },
  refused:     { bg: '#4d1a1a', color: '#f87171' },
};

function getValue(values: Record<string, unknown>, key: string): string {
  const v = values[key];
  return v !== undefined && v !== null ? String(v) : '—';
}

interface PayoutDeal extends Deal {
  receipt_url?: string;
}

export default function PayoutPage() {
  const { t } = useTranslation();
  const [deals, setDeals] = useState<PayoutDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingReceipt, setUploadingReceipt] = useState<Record<number, boolean>>({});
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      const data = await getDeals({});
      setDeals(data);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadReceipt = async (dealId: number, file: File) => {
    setUploadingReceipt((p) => ({ ...p, [dealId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/v1/admin/deals/${dealId}/receipt/`, {
        method: 'POST',
        body: formData,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('merchantToken')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, receipt_url: data.url } : d));
      }
    } catch {
      alert('Failed to upload receipt');
    } finally {
      setUploadingReceipt((p) => ({ ...p, [dealId]: false }));
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
            {!loading && deals.length === 0 && (
              <tr>
                <td colSpan={10} className={styles.emptyState}>{t('common.no_data')}</td>
              </tr>
            )}
            {!loading && deals.map((deal) => {
              const sc = STATUS_COLORS[deal.status];
              const tv = deal.to_values;

              return (
                <tr key={deal.id} className={styles.rowInactive}>
                  <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <label style={{
                      backgroundColor: '#0066cc', color: '#fff', padding: '6px 12px',
                      borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                      border: 'none', display: 'block',
                    }}>
                      {uploadingReceipt[deal.id] ? 'Uploading...' : 'Upload'}
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadReceipt(deal.id, file);
                        }}
                        style={{ display: 'none' }}
                        disabled={uploadingReceipt[deal.id]}
                      />
                    </label>
                    {deal.receipt_url && (
                      <button
                        onClick={() => setViewingReceipt(deal.receipt_url!)}
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
                    <CountdownTimer receivedAt={deal.received_at} isActive={true} />
                  </td>

                  <td className={styles.idCell}>#{deal.id}</td>

                  <td>
                    <span className={styles.statusBadge} style={{ backgroundColor: sc.bg, color: sc.color }}>
                      {t(`deals.status_badge.${deal.status}`)}
                    </span>
                  </td>

                  <td className={styles.cell}>{deal.from_xml}</td>
                  <td className={styles.cell}>{getValue(tv, 'cardHolder')}</td>
                  <td className={styles.cell}>{getValue(tv, 'cardNumber')}</td>
                  <td className={styles.cell}>{getValue(tv, 'phoneNumber')}</td>
                  <td className={styles.cell}>{getValue(tv, 'bankName')}</td>
                  <td className={styles.amountCell}>{getValue(tv, 'outAmount')} {deal.from_xml}</td>
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
