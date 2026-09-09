import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import styles from './DealsHistory.module.css';

interface BalanceHistoryItem {
  id: number;
  action: string;
  amount: number;
  reason: string;
  created_at: string;
}

interface Payout {
  id: number;
  user_id: number;
  amount: number;
  currency: string;
  card_holder?: string;
  card_number?: string;
  phone_number?: string;
  bank_name?: string;
  receipt_url?: string;
  status: string;
  created_at: string;
}

export default function DealsHistoryPage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'payouts' | 'balance'>('payouts');

  useEffect(() => {
    fetchUserHistory();
  }, [userId]);

  const fetchUserHistory = async () => {
    try {
      const [payoutsData, balanceData] = await Promise.all([
        adminClient.get<Payout[]>(`/admin/payouts?user_id=${userId}`).then((r) => r.data),
        adminClient.get<BalanceHistoryItem[]>(`/admin/users/${userId}/balance-history`).then((r) => r.data),
      ]);
      setPayouts(payoutsData);
      setBalanceHistory(balanceData);
    } catch {
      alert('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleResetBalance = async () => {
    if (!window.confirm('Are you sure you want to reset this user\'s balance to 0?')) {
      return;
    }
    try {
      await adminClient.post(`/admin/users/${userId}/reset-balance`);
      fetchUserHistory();
      alert('Balance reset to 0');
    } catch (e: any) {
      alert(`Failed to reset balance: ${e.response?.data?.detail || 'Unknown error'}`);
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
        <button onClick={() => navigate('/admin/users')} style={{
          backgroundColor: 'transparent', color: '#60a5fa', border: 'none',
          cursor: 'pointer', fontSize: '14px', textDecoration: 'underline',
          marginBottom: '15px',
        }}>
          ← Вернуться к пользователям
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className={styles.pageTitle}>История пользователя (User #{userId})</h1>
          <button
            onClick={handleResetBalance}
            style={{
              backgroundColor: '#ef4444', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
              padding: '8px 16px', borderRadius: '4px',
            }}
          >
            Сбросить баланс на 0
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setTab('payouts')}
          style={{
            padding: '8px 16px', borderRadius: '4px', border: 'none',
            backgroundColor: tab === 'payouts' ? '#0066cc' : '#222',
            color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
          }}
        >
          Выплаты
        </button>
        <button
          onClick={() => setTab('balance')}
          style={{
            padding: '8px 16px', borderRadius: '4px', border: 'none',
            backgroundColor: tab === 'balance' ? '#0066cc' : '#222',
            color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
          }}
        >
          История баланса
        </button>
      </div>

      {loading ? (
        <div className={styles.empty}>{t('common.loading')}</div>
      ) : tab === 'payouts' ? (
        payouts.length === 0 ? (
          <div className={styles.empty}>{t('common.no_data')}</div>
        ) : (
          <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse', fontSize: '13px',
              background: '#111', border: '1px solid #222', borderRadius: '4px',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222' }}>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>Сумма</th>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>Валюта</th>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>Получатель</th>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>Статус</th>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>Дата</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '12px', color: '#888' }}>#{payout.id}</td>
                    <td style={{ padding: '12px', color: '#ccc', fontWeight: '600' }}>{payout.amount.toFixed(2)}</td>
                    <td style={{ padding: '12px', color: '#ccc' }}>{payout.currency}</td>
                    <td style={{ padding: '12px', color: '#ccc' }}>{payout.card_holder || '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: '600',
                        backgroundColor: payout.status === 'completed' ? '#052e16' : '#1c1917',
                        color: payout.status === 'completed' ? '#4ade80' : '#f87171',
                      }}>
                        {payout.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#666', fontSize: '11px' }}>
                      {formatDate(payout.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : balanceHistory.length === 0 ? (
        <div className={styles.empty}>{t('common.no_data')}</div>
      ) : (
        <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: '13px',
            background: '#111', border: '1px solid #222', borderRadius: '4px',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>Action</th>
                <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>Reason</th>
                <th style={{ textAlign: 'left', padding: '12px', color: '#666', fontWeight: '600' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {balanceHistory.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '12px', color: '#ccc' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: '600',
                      backgroundColor: item.action === 'reset' ? '#4d1a1a' : '#052e16',
                      color: item.action === 'reset' ? '#ef4444' : '#4ade80',
                    }}>
                      {item.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#ccc', fontWeight: '600' }}>{item.amount.toFixed(2)}</td>
                  <td style={{ padding: '12px', color: '#888' }}>{item.reason}</td>
                  <td style={{ padding: '12px', color: '#666', fontSize: '11px' }}>
                    {new Date(item.created_at + (item.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
