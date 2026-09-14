import { useState, useEffect, useMemo } from 'react';
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

interface HistoryDeal {
  id: number;
  uid: number;
  to_xml: string;
  to_values: Record<string, unknown>;
  status: string;
  rate: number | null;
  markup_percent: number | null;
  our_rate: number | null;
  turnover_usdt: number | null;
  credited_usdt: number | null;
  margin_usdt: number | null;
  receipt_url: string | null;
  received_at: string | null;
  created_at: string | null;
}

interface Totals {
  successCount: number;
  refusedCount: number;
  /** Sum of outAmount over successful deals, per payout currency */
  paidOut: Record<string, number>;
  /** USDT settlement of successful deals */
  turnover: number;
  credited: number;
  margin: number;
}

interface DaySection extends Totals {
  key: string;
  label: string;
  deals: HistoryDeal[];
}

const toDate = (iso: string) => new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));

// Deals are grouped by when the cabinet received them. created_at is set by the
// API caller and can hold any date; received_at is stamped by the server.
const dealTime = (d: HistoryDeal) => d.received_at ?? d.created_at;

function amountOf(d: HistoryDeal): number {
  const n = Number(d.to_values?.outAmount);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyTotals = (): Totals => ({
  successCount: 0, refusedCount: 0, paidOut: {}, turnover: 0, credited: 0, margin: 0,
});

// Only successful deals are paid out and settled, so only they count towards
// the money totals.
function addDeal(totals: Totals, d: HistoryDeal): void {
  if (d.status === 'accepted') {
    totals.successCount += 1;
    // Summed per currency: amounts in UAH and USDT can't be added together.
    totals.paidOut[d.to_xml] = (totals.paidOut[d.to_xml] ?? 0) + amountOf(d);
    totals.turnover += d.turnover_usdt ?? 0;
    totals.credited += d.credited_usdt ?? 0;
    totals.margin += d.margin_usdt ?? 0;
  } else if (d.status === 'refused') {
    totals.refusedCount += 1;
  }
}

function groupByDay(deals: HistoryDeal[]): DaySection[] {
  const timeOf = (d: HistoryDeal) => {
    const iso = dealTime(d);
    return iso ? toDate(iso).getTime() : 0;
  };
  const sorted = [...deals].sort((a, b) => timeOf(b) - timeOf(a));

  const sections = new Map<string, DaySection>();
  for (const d of sorted) {
    const iso = dealTime(d);
    const date = iso ? toDate(iso) : null;
    const key = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : 'unknown';

    let section = sections.get(key);
    if (!section) {
      section = {
        key,
        label: date
          ? date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
          : 'Без даты',
        deals: [],
        ...emptyTotals(),
      };
      sections.set(key, section);
    }

    section.deals.push(d);
    addDeal(section, d);
  }
  return [...sections.values()];
}

function TotalsLine({ totals, count }: { totals: Totals; count: number }) {
  const paid = Object.entries(totals.paidOut)
    .map(([currency, sum]) => `${money(sum)} ${currency}`)
    .join(' · ');
  return (
    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888', flexWrap: 'wrap' }}>
      <span>Заявок: <b style={{ color: '#ccc' }}>{count}</b></span>
      <span>Успешно: <b style={{ color: '#4ade80' }}>{totals.successCount}</b></span>
      <span>Отклонено: <b style={{ color: '#f87171' }}>{totals.refusedCount}</b></span>
      <span>Выплачено: <b style={{ color: '#ccc' }}>{paid || '—'}</b></span>
      <span>Оборот: <b style={{ color: '#ccc' }}>{money(totals.turnover)} USDT</b></span>
      <span>Маржа: <b style={{ color: '#fbbf24' }}>{money(totals.margin)} USDT</b></span>
      <span>Зачислено: <b style={{ color: '#4ade80' }}>{money(totals.credited)} USDT</b></span>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: '#666', fontWeight: 600 };
const td: React.CSSProperties = { padding: '10px 12px', color: '#ccc' };

export default function DealsHistoryPage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<HistoryDeal[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'deals' | 'balance'>('deals');

  const sections = useMemo(() => groupByDay(deals), [deals]);
  const overall = useMemo(() => {
    const totals = emptyTotals();
    deals.forEach((d) => addDeal(totals, d));
    return totals;
  }, [deals]);

  useEffect(() => {
    fetchUserHistory();
  }, [userId]);

  const fetchUserHistory = async () => {
    try {
      const [dealsData, balanceData] = await Promise.all([
        adminClient.get<HistoryDeal[]>(`/admin/deals/${userId}`).then((r) => r.data),
        adminClient.get<BalanceHistoryItem[]>(`/admin/users/${userId}/balance-history`).then((r) => r.data),
      ]);
      setDeals(dealsData);
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

  const tabButton = (value: 'deals' | 'balance', label: string) => (
    <button
      onClick={() => setTab(value)}
      style={{
        padding: '8px 16px', borderRadius: '4px', border: 'none',
        backgroundColor: tab === value ? '#0066cc' : '#222',
        color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
      }}
    >
      {label}
    </button>
  );

  const usdtCell = (v: number | null | undefined) => (v == null ? '—' : money(v));

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
        {tabButton('deals', 'Заявки')}
        {tabButton('balance', 'История баланса')}
      </div>

      {loading ? (
        <div className={styles.empty}>{t('common.loading')}</div>
      ) : tab === 'deals' ? (
        sections.length === 0 ? (
          <div className={styles.empty}>{t('common.no_data')}</div>
        ) : (
          <>
            <div style={{
              padding: '12px', marginBottom: '20px', background: '#0f170f',
              border: '1px solid #1f3a1f', borderRadius: '4px',
            }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                Итого за всё время
              </div>
              <TotalsLine totals={overall} count={deals.length} />
            </div>

            {sections.map((s) => (
              <section key={s.key} style={{ marginBottom: '28px' }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px',
                  background: '#161616', border: '1px solid #222', borderBottom: 'none',
                  borderRadius: '4px 4px 0 0',
                }}>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{s.label}</div>
                  <TotalsLine totals={s} count={s.deals.length} />
                </div>
                <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse', fontSize: '13px',
                    background: '#111', border: '1px solid #222', borderRadius: '0 0 4px 4px',
                  }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #222' }}>
                        <th style={th}>ID</th>
                        <th style={th}>Время</th>
                        <th style={th}>Сумма</th>
                        <th style={th}>Курс</th>
                        <th style={th}>Оборот, USDT</th>
                        <th style={th}>Маржа, USDT</th>
                        <th style={th}>Зачислено, USDT</th>
                        <th style={th}>Получатель</th>
                        <th style={th}>Банк</th>
                        <th style={th}>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.deals.map((d) => {
                        const iso = dealTime(d);
                        return (
                          <tr key={d.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                            <td style={{ ...td, color: '#888' }}>#{d.id}</td>
                            <td style={{ ...td, color: '#666', fontSize: '12px' }}>
                              {iso ? toDate(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td style={{ ...td, fontWeight: 600 }}>
                              {money(amountOf(d))} {d.to_xml}
                            </td>
                            <td style={td}>{d.our_rate ?? '—'}</td>
                            <td style={td}>{usdtCell(d.turnover_usdt)}</td>
                            <td style={{ ...td, color: '#fbbf24' }}>{usdtCell(d.margin_usdt)}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{usdtCell(d.credited_usdt)}</td>
                            <td style={td}>{String(d.to_values?.cardHolder ?? '—')}</td>
                            <td style={td}>{String(d.to_values?.bankName ?? '—')}</td>
                            <td style={td}>
                              <span style={{
                                padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 600,
                                backgroundColor: '#1a1a1a', color: getStatusColor(d.status),
                              }}>
                                {t(`deals.status_badge.${d.status}`, { defaultValue: d.status })}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
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
                <th style={th}>Action</th>
                <th style={th}>Amount</th>
                <th style={th}>Reason</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {balanceHistory.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={td}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 600,
                      backgroundColor: item.action === 'reset' ? '#4d1a1a' : '#052e16',
                      color: item.action === 'reset' ? '#ef4444' : '#4ade80',
                    }}>
                      {item.action}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{Number(item.amount).toFixed(2)} USDT</td>
                  <td style={{ ...td, color: '#888' }}>{item.reason}</td>
                  <td style={{ ...td, color: '#666', fontSize: '11px' }}>
                    {toDate(item.created_at).toLocaleString('ru-RU')}
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
