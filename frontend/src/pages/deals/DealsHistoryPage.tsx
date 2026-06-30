import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import styles from './DealsHistory.module.css';

interface DealEvent {
  id: number;
  status: string;
  created_at: string;
  changed_at?: string;
}

interface Deal {
  id: number;
  uid: string;
  currency: string;
  from_xml: string;
  from_name: string;
  to_name: string;
  to_values: string;
  amount: number;
  status: string;
  accepted_by_username?: string;
  created_at: string;
  accepted_at?: string;
  received_at?: string;
}

export default function DealsHistoryPage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeals();
  }, [userId]);

  const fetchDeals = async () => {
    try {
      const data = await adminClient
        .get<Deal[]>(`/admin/deals?user_id=${userId}`)
        .then((r) => r.data);
      setDeals(data);
    } catch {
      alert('Failed to load deals history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string | undefined) => {
    if (!isoString) return '—';
    const date = new Date(isoString + (isoString.endsWith('Z') ? '' : 'Z'));
    return date.toLocaleString('ru-RU');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#4ade80';
      case 'refused':
        return '#ef4444';
      case 'pending':
        return '#fbbf24';
      case 'in_progress':
        return '#60a5fa';
      default:
        return '#888';
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button onClick={() => navigate('/admin/payouts')} style={{
          backgroundColor: 'transparent', color: '#60a5fa', border: 'none',
          cursor: 'pointer', fontSize: '14px', textDecoration: 'underline',
          marginBottom: '15px',
        }}>
          ← Вернуться в выплаты
        </button>
        <h1 className={styles.pageTitle}>{t('nav.history')} (User #{userId})</h1>
      </div>

      {loading ? (
        <div className={styles.empty}>{t('common.loading')}</div>
      ) : deals.length === 0 ? (
        <div className={styles.empty}>{t('common.no_data')}</div>
      ) : (
        <div className={styles.dealsContainer}>
          {deals.map((deal) => (
            <div key={deal.id} className={styles.dealCard}>
              <div className={styles.dealHeader}>
                <div>
                  <div className={styles.dealId}>ID: {deal.uid}</div>
                  <div className={styles.dealAmount}>
                    {deal.amount} {deal.currency} {deal.from_xml}
                  </div>
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
                }}>
                  <span className={styles.statusBadge} style={{
                    backgroundColor: getStatusColor(deal.status) + '33',
                    color: getStatusColor(deal.status),
                    border: `1px solid ${getStatusColor(deal.status)}`,
                  }}>
                    {deal.status}
                  </span>
                  <span className={styles.dealDate}>
                    {formatDate(deal.created_at)}
                  </span>
                </div>
              </div>

              <div className={styles.dealDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.label}>From:</span>
                  <span className={styles.value}>{deal.from_name}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>To:</span>
                  <span className={styles.value}>{deal.to_name}</span>
                </div>
                {deal.accepted_by_username && (
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Processed by:</span>
                    <span className={styles.value}>{deal.accepted_by_username}</span>
                  </div>
                )}
              </div>

              <div className={styles.timeline}>
                <div className={styles.timelineItem}>
                  <div className={styles.timelineMarker} style={{ backgroundColor: '#888' }} />
                  <div>
                    <div className={styles.timelineLabel}>Created</div>
                    <div className={styles.timelineTime}>{formatDate(deal.created_at)}</div>
                  </div>
                </div>

                {deal.accepted_at && (
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineMarker} style={{ backgroundColor: '#60a5fa' }} />
                    <div>
                      <div className={styles.timelineLabel}>Accepted</div>
                      <div className={styles.timelineTime}>{formatDate(deal.accepted_at)}</div>
                    </div>
                  </div>
                )}

                {deal.received_at && (
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineMarker} style={{ backgroundColor: '#4ade80' }} />
                    <div>
                      <div className={styles.timelineLabel}>Received/Completed</div>
                      <div className={styles.timelineTime}>{formatDate(deal.received_at)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
