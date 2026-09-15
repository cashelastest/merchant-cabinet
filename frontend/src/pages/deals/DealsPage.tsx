import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getDeals,
  acceptDeal,
  refuseDeal,
  completeDeal,
  uploadDealReceipt,
  fetchDealReceipt,
  RECEIPT_ACCEPT,
  RECEIPT_MAX_SIZE,
} from '../../api/deals';
import type { Deal } from '../../types';
import CountdownTimer from '../../components/CountdownTimer/CountdownTimer';
import styles from './DealsPage.module.css';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:     { bg: '#1a3a4d', color: '#60a5fa' },
  in_progress: { bg: '#2d2a1a', color: '#fbbf24' },
  accepted:    { bg: '#1a4d1a', color: '#4ade80' },
  refused:     { bg: '#4d1a1a', color: '#f87171' },
};

/** Rows stored with a status outside the list above must still render. */
const STATUS_FALLBACK = { bg: '#1e1e1e', color: '#a0a0a0' };

/**
 * Statuses selectable from the current one. Absent key = terminal, no edits.
 * Each target maps to a dedicated endpoint rather than PATCH /deal/{id}/status,
 * because those keep the balance and the Bizon sync correct.
 */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending:     ['pending', 'in_progress', 'refused'],
  in_progress: ['in_progress', 'accepted', 'refused'],
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
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<{ dealId: number; url: string; isPdf: boolean } | null>(null);

  // filters
  const [filterId, setFilterId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterXml, setFilterXml] = useState('');


  const wsRef = useRef<WebSocket | null>(null);
  const receiptUrlRef = useRef<string | null>(null);

  const fetchDeals = useCallback(async () => {
    try {
      const data = await getDeals({
        deal_id: filterId ? Number(filterId) : undefined,
        status: filterStatus || undefined,
        to_xml: filterXml || undefined,
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
          } else if (payload.event === 'deal_updated') {
            // A deal from the shared pool was taken or closed. Only the server
            // knows which deals this merchant may still see, so re-sync the list.
            window.dispatchEvent(new Event('deals:refresh'));
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchDeals();
  };

  const handleStatusSelect = async (deal: Deal, next: string) => {
    if (next === deal.status) return;
    setActioningId(deal.id);
    try {
      const res =
        next === 'in_progress' ? await acceptDeal(deal.id) :
        next === 'accepted'    ? await completeDeal(deal.id) :
                                 await refuseDeal(deal.id);
      if (next === 'refused') {
        // Refusing only hides the deal from this merchant; everyone else still sees it.
        setDeals((prev) => prev.filter((d) => d.id !== deal.id));
      } else {
        setDeals((prev) => prev.map((d) => d.id === deal.id ? { ...d, status: res.status } : d));
      }
    } catch (e) {
      // Show the server's reason, e.g. a deal that has no rate to settle with.
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      alert(typeof detail === 'string' ? detail : 'Failed to update status');
      // Another merchant may have taken the deal in the meantime; re-sync the list.
      fetchDeals();
    } finally {
      setActioningId(null);
    }
  };

  const closeReceipt = () => {
    if (receiptUrlRef.current) {
      URL.revokeObjectURL(receiptUrlRef.current);
      receiptUrlRef.current = null;
    }
    setReceipt(null);
  };

  // release the last blob URL when leaving the page
  useEffect(() => () => {
    if (receiptUrlRef.current) URL.revokeObjectURL(receiptUrlRef.current);
  }, []);

  const handleUploadReceipt = async (dealId: number, file: File) => {
    if (file.size > RECEIPT_MAX_SIZE) {
      alert('File is too large (max 10 MB)');
      return;
    }
    setUploadingId(dealId);
    try {
      const { receipt_url } = await uploadDealReceipt(dealId, file);
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, receipt_url } : d));
    } catch {
      alert('Failed to upload receipt');
    } finally {
      setUploadingId(null);
    }
  };

  const handleViewReceipt = async (deal: Deal) => {
    if (!deal.receipt_url) return;
    try {
      const blob = await fetchDealReceipt(deal.receipt_url);
      closeReceipt();
      const url = URL.createObjectURL(blob);
      receiptUrlRef.current = url;
      setReceipt({
        dealId: deal.id,
        url,
        isPdf: blob.type === 'application/pdf' || deal.receipt_url.toLowerCase().endsWith('.pdf'),
      });
    } catch {
      alert('Failed to load receipt');
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
              <th>{t('deals.table.rate')}</th>
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
                <td colSpan={12} className={styles.emptyState}>{t('common.loading')}</td>
              </tr>
            )}
            {!loading && deals.length === 0 && (
              <tr>
                <td colSpan={12} className={styles.emptyState}>{t('common.no_data')}</td>
              </tr>
            )}
            {!loading && deals.map((deal) => {
              const isPending    = deal.status === 'pending';
              const isInProgress = deal.status === 'in_progress';
              const sc = STATUS_COLORS[deal.status] ?? STATUS_FALLBACK;
              const tv = deal.to_values;

              return (
                <tr key={deal.id} className={isPending || isInProgress ? styles.rowActive : styles.rowInactive}>
                  <td className={styles.actionsCell}>
                    {STATUS_TRANSITIONS[deal.status] ? (
                      <select
                        className={styles.statusSelect}
                        value={deal.status}
                        disabled={actioningId === deal.id}
                        onChange={(e) => handleStatusSelect(deal, e.target.value)}
                        style={{ color: sc.color, borderColor: sc.color }}
                      >
                        {STATUS_TRANSITIONS[deal.status].map((s) => (
                          <option key={s} value={s}>
                            {t(`deals.status_badge.${s}`, { defaultValue: s })}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={styles.statusLocked}>—</span>
                    )}
                  </td>

                  <td className={styles.receiptCell}>
                    <label
                      className={styles.btnUpload}
                      title={deal.receipt_url ? 'Replace receipt' : 'Upload receipt'}
                    >
                      {uploadingId === deal.id ? '⏳' : '📎'}
                      <input
                        type="file"
                        accept={RECEIPT_ACCEPT}
                        className={styles.fileInput}
                        disabled={uploadingId === deal.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) handleUploadReceipt(deal.id, file);
                        }}
                      />
                    </label>
                    {deal.receipt_url ? (
                      <button
                        className={styles.btnView}
                        onClick={() => handleViewReceipt(deal)}
                        title="View receipt"
                      >
                        👁
                      </button>
                    ) : (
                      <span className={styles.receiptEmpty}>—</span>
                    )}
                  </td>

                  <td className={styles.timerCell}>
                    {isPending && (
                      <CountdownTimer receivedAt={deal.received_at} isActive={true} />
                    )}
                  </td>

                  <td className={styles.idCell}>#{deal.id}</td>

                  <td>
                    <span className={styles.statusBadge} style={{ backgroundColor: sc.bg, color: sc.color }}>
                      {t(`deals.status_badge.${deal.status}`, { defaultValue: deal.status })}
                    </span>
                  </td>

                  <td className={styles.cell}>{deal.to_xml}</td>
                  <td className={styles.cell}>{deal.our_rate ?? '—'}</td>
                  <td className={styles.cell}>{getValue(tv, 'cardHolder')}</td>
                  <td className={styles.cell}>{getValue(tv, 'cardNumber')}</td>
                  <td className={styles.cell}>{getValue(tv, 'phoneNumber')}</td>
                  <td className={styles.cell}>{getValue(tv, 'bankName')}</td>
                  <td className={styles.amountCell}>{getValue(tv, 'outAmount')} {deal.to_xml}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {receipt && (
        <div className={styles.modalOverlay} onClick={closeReceipt}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Receipt — deal #{receipt.dealId}</span>
              <div className={styles.modalActions}>
                <a
                  className={styles.btnDownload}
                  href={receipt.url}
                  download={`receipt_deal_${receipt.dealId}${receipt.isPdf ? '.pdf' : ''}`}
                >
                  Download
                </a>
                <button className={styles.modalClose} onClick={closeReceipt}>✕</button>
              </div>
            </div>
            {receipt.isPdf ? (
              <iframe className={styles.receiptPdf} src={receipt.url} title="receipt" />
            ) : (
              <img className={styles.receiptImage} src={receipt.url} alt="receipt" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
