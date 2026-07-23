import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getDeals, acceptDeal, refuseDeal, completeDeal } from '../../api/deals';
import type { Deal } from '../../types';
import CountdownTimer from '../../components/CountdownTimer/CountdownTimer';
import styles from './DealsPage.module.css';

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

export default function DealsPage() {
  const { t } = useTranslation();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<number | null>(null);

  // filters
  const [filterId, setFilterId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterXml, setFilterXml] = useState('');


  const wsRef = useRef<WebSocket | null>(null);

  const fetchDeals = useCallback(async () => {
    try {
      const data = await getDeals({
        deal_id: filterId ? Number(filterId) : undefined,
        status: filterStatus || undefined,
        from_xml: filterXml || undefined,
      });
      setDeals(data);
    } finally {
      setLoading(false);
    }
  }, [filterId, filterStatus, filterXml]);

  useEffect(() => {
    fetchDeals();
  }, []);

  // listen for Header refresh button
  useEffect(() => {
    const handler = () => fetchDeals();
    window.addEventListener('deals:refresh', handler);
    return () => window.removeEventListener('deals:refresh', handler);
  }, [fetchDeals]);

  // WebSocket for real-time new deals with auto-reconnect
  useEffect(() => {
    const token = localStorage.getItem('merchantToken');
    if (!token) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const connect = () => {
      if (destroyed) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/api/v1/ws/deals?token=${token}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.event === 'new_deal') {
            const newDeal: Deal = {
              ...payload.data,
              id: payload.deal_id,
              received_at: payload.data.received_at ?? new Date().toISOString(),
            };
            setDeals((prev) => {
              if (prev.some((d) => d.id === newDeal.id)) return prev;
              return [newDeal, ...prev];
            });
          }
        } catch {/* ignore */}
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  // sync pause/resume with WS backend
  useEffect(() => {
    const handler = (e: Event) => {
      const { is_active } = (e as CustomEvent<{ is_active: boolean }>).detail;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: is_active ? 'resume' : 'pause' }));
      }
    };
    window.addEventListener('session:status', handler);
    return () => window.removeEventListener('session:status', handler);
  }, []);

  // update currencies in WS without reconnecting
  useEffect(() => {
    const handler = (e: Event) => {
      const { currencies } = (e as CustomEvent<{ currencies: string[] }>).detail;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'update_currencies', currencies }));
      }
    };
    window.addEventListener('ws:update_currencies', handler);
    return () => window.removeEventListener('ws:update_currencies', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchDeals();
  };

  const handleAccept = async (dealId: number) => {
    setActioningId(dealId);
    try {
      const res = await acceptDeal(dealId);
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, status: res.status } : d));
    } catch {
      alert('Failed to accept deal');
    } finally {
      setActioningId(null);
    }
  };

  const handleRefuse = async (dealId: number) => {
    setActioningId(dealId);
    try {
      const res = await refuseDeal(dealId);
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, status: res.status } : d));
    } catch {
      alert('Failed to refuse deal');
    } finally {
      setActioningId(null);
    }
  };

  const handleComplete = async (dealId: number) => {
    setActioningId(dealId);
    try {
      const res = await completeDeal(dealId);
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, status: res.status } : d));
    } catch {
      alert('Failed to complete deal');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>{t('deals.breadcrumb')}</div>

      <form className={styles.filterBar} onSubmit={handleSearch}>
        <input
          className={styles.filterInput}
          placeholder={t('deals.filters.request_id')}
          value={filterId}
          onChange={(e) => setFilterId(e.target.value)}
          type="number"
          min="1"
        />
        <input
          className={styles.filterInput}
          placeholder={t('deals.filters.currency')}
          value={filterXml}
          onChange={(e) => setFilterXml(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">{t('common.no_data')}</option>
          <option value="pending">{t('deals.status_badge.pending')}</option>
          <option value="in_progress">{t('deals.status_badge.in_progress')}</option>
          <option value="accepted">{t('deals.status_badge.accepted')}</option>
          <option value="refused">{t('deals.status_badge.refused')}</option>
        </select>
        <button type="submit" className={styles.searchBtn}>{t('common.search')}</button>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => { setFilterId(''); setFilterStatus(''); setFilterXml(''); }}
        >
          {t('common.reset')}
        </button>
      </form>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Change Status</th>
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
                <td colSpan={11} className={styles.emptyState}>{t('common.loading')}</td>
              </tr>
            )}
            {!loading && deals.length === 0 && (
              <tr>
                <td colSpan={11} className={styles.emptyState}>{t('common.no_data')}</td>
              </tr>
            )}
            {!loading && deals.map((deal) => {
              const isPending    = deal.status === 'pending';
              const isInProgress = deal.status === 'in_progress';
              const sc = STATUS_COLORS[deal.status];
              const tv = deal.to_values;

              return (
                <tr key={deal.id} className={isPending || isInProgress ? styles.rowActive : styles.rowInactive}>
                  <td className={styles.actionsCell}>
                    {isPending && (
                      <>
                        <button
                          className={styles.btnAccept}
                          onClick={() => handleAccept(deal.id)}
                          disabled={actioningId === deal.id}
                          title={t('deals.buttons.accept')}
                        >
                          ✓
                        </button>
                        <button
                          className={styles.btnRefuse}
                          onClick={() => handleRefuse(deal.id)}
                          disabled={actioningId === deal.id}
                          title={t('deals.buttons.refuse')}
                        >
                          ✕
                        </button>
                      </>
                    )}
                    {isInProgress && (
                      <>
                        <button
                          className={styles.btnComplete}
                          onClick={() => handleComplete(deal.id)}
                          disabled={actioningId === deal.id}
                          title={t('deals.buttons.complete')}
                        >
                          ✓
                        </button>
                      </>
                    )}
                  </td>

                  <td className={styles.cell}>—</td>

                  <td className={styles.timerCell}>
                    {isPending && (
                      <CountdownTimer receivedAt={deal.received_at} isActive={true} />
                    )}
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
    </div>
  );
}
