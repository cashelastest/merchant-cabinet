import { useState, useEffect, useCallback, useRef } from 'react';
import { getDeals, acceptDeal, refuseDeal } from '../../api/deals';
import type { Deal } from '../../types';
import CountdownTimer from '../../components/CountdownTimer/CountdownTimer';
import styles from './DealsPage.module.css';

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: '#1a3a4d', color: '#60a5fa', label: 'ACTIVE'    },
  accepted: { bg: '#1a4d1a', color: '#4ade80', label: 'ACCEPTED'  },
  refused:  { bg: '#4d1a1a', color: '#f87171', label: 'CANCELLED' },
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#2a2a2a', color: '#9ca3af', label: status.toUpperCase() };
}

function getValue(values: Record<string, unknown>, key: string): string {
  const v = values[key];
  return v !== undefined && v !== null ? String(v) : '—';
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [filterId, setFilterId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterXml, setFilterXml] = useState('');

  // action loading per deal
  const [acting, setActing] = useState<Record<number, boolean>>({});

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

  const handleAccept = async (id: number) => {
    setActing((p) => ({ ...p, [id]: true }));
    try {
      const updated = await acceptDeal(id);
      setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, status: updated.status } : d)));
    } finally {
      setActing((p) => ({ ...p, [id]: false }));
    }
  };

  const handleRefuse = async (id: number) => {
    setActing((p) => ({ ...p, [id]: true }));
    try {
      const updated = await refuseDeal(id);
      setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, status: updated.status } : d)));
    } finally {
      setActing((p) => ({ ...p, [id]: false }));
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>Requests / List</div>

      {/* Filter bar */}
      <form className={styles.filterBar} onSubmit={handleSearch}>
        <input
          className={styles.filterInput}
          placeholder="Request ID"
          value={filterId}
          onChange={(e) => setFilterId(e.target.value)}
          type="number"
          min="1"
        />
        <input
          className={styles.filterInput}
          placeholder="Currency (from_xml)"
          value={filterXml}
          onChange={(e) => setFilterXml(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Active (pending)</option>
          <option value="accepted">Accepted</option>
          <option value="refused">Cancelled</option>
        </select>
        <button type="submit" className={styles.searchBtn}>
          Search
        </button>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => { setFilterId(''); setFilterStatus(''); setFilterXml(''); }}
        >
          Reset
        </button>
      </form>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Change Status</th>
              <th>Estimate</th>
              <th>Request Id</th>
              <th>Status</th>
              <th>Currency</th>
              <th>Country</th>
              <th>USDT Wallet</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className={styles.emptyState}>Loading…</td>
              </tr>
            )}
            {!loading && deals.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.emptyState}>No requests found</td>
              </tr>
            )}
            {!loading && deals.map((deal) => {
              const isPending = deal.status === 'pending';
              const busy = acting[deal.id];
              const ss = getStatusStyle(deal.status);
              const tv = deal.to_values;

              return (
                <tr key={deal.id} className={isPending ? styles.rowActive : styles.rowInactive}>
                  {/* Change Status buttons */}
                  <td className={styles.actionsCell}>
                    <button
                      className={`${styles.actionBtn} ${isPending ? styles.actionBtnActive : ''}`}
                      onClick={() => handleAccept(deal.id)}
                      disabled={!isPending || busy}
                      title="Accept"
                    >
                      ✓
                    </button>
                    <button
                      className={styles.refuseBtn}
                      onClick={() => handleRefuse(deal.id)}
                      disabled={!isPending || busy}
                      title="Refuse Request"
                    >
                      Refuse Request
                    </button>
                  </td>

                  {/* Countdown timer */}
                  <td className={styles.timerCell}>
                    <CountdownTimer
                      receivedAt={deal.received_at}
                      isActive={isPending}
                    />
                  </td>

                  {/* Request ID */}
                  <td className={styles.idCell} title={String(deal.id)}>
                    #{deal.id} / uid:{deal.uid}
                  </td>

                  {/* Status badge */}
                  <td>
                    <span
                      className={styles.statusBadge}
                      style={{ backgroundColor: ss.bg, color: ss.color }}
                    >
                      {ss.label}
                    </span>
                  </td>

                  {/* Currency */}
                  <td className={styles.cell}>{deal.from_xml}</td>

                  {/* Country */}
                  <td className={styles.cell}>{getValue(tv, 'country')}</td>

                  {/* USDT Wallet */}
                  <td className={styles.walletCell}>{getValue(tv, 'usdtWallet')}</td>

                  {/* Amount */}
                  <td className={styles.amountCell}>
                    {getValue(tv, 'outAmount')} {deal.from_xml}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
