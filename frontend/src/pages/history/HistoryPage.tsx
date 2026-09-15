import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDealsHistory, getMyBalanceHistory } from '../../api/history';
import type { BalanceHistoryItem, Deal } from '../../types';
import dealStyles from '../deals/DealsPage.module.css';
import styles from './History.module.css';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  accepted: { bg: '#1a4d1a', color: '#4ade80' },
  refused:  { bg: '#4d1a1a', color: '#f87171' },
};
const STATUS_FALLBACK = { bg: '#1e1e1e', color: '#a0a0a0' };

interface Totals {
  count: number;
  success: number;
  refused: number;
  /** outAmount of successful deals, per payout currency */
  paidOut: Record<string, number>;
  /** USDT credited to the balance by successful deals */
  credited: number;
}

interface DaySection extends Totals {
  key: string;
  date: Date | null;
  deals: Deal[];
}

const toDate = (iso: string) => new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));

// A deal belongs to the day it was finished: that is when its USDT hit the
// balance, so a day's sum lines up with the balance history for that day.
const finishedAt = (d: Deal) => d.updated_at ?? d.accepted_at ?? d.received_at ?? d.created_at;

function amountOf(d: Deal): number {
  const n = Number(d.to_values?.outAmount);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyTotals = (): Totals => ({ count: 0, success: 0, refused: 0, paidOut: {}, credited: 0 });

function addDeal(totals: Totals, d: Deal): void {
  totals.count += 1;
  if (d.status === 'accepted') {
    totals.success += 1;
    // Per currency: amounts in UAH and USDT can't be added together.
    totals.paidOut[d.to_xml] = (totals.paidOut[d.to_xml] ?? 0) + amountOf(d);
    totals.credited += d.credited_usdt ?? 0;
  } else if (d.status === 'refused') {
    totals.refused += 1;
  }
}

function groupByDay(deals: Deal[]): DaySection[] {
  const timeOf = (d: Deal) => {
    const iso = finishedAt(d);
    return iso ? toDate(iso).getTime() : 0;
  };
  const sections = new Map<string, DaySection>();
  for (const d of [...deals].sort((a, b) => timeOf(b) - timeOf(a))) {
    const iso = finishedAt(d);
    const date = iso ? toDate(iso) : null;
    const key = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : 'unknown';
    let section = sections.get(key);
    if (!section) {
      section = { key, date, deals: [], ...emptyTotals() };
      sections.set(key, section);
    }
    section.deals.push(d);
    addDeal(section, d);
  }
  return [...sections.values()];
}

function TotalsLine({ totals }: { totals: Totals }) {
  const { t } = useTranslation();
  const paid = Object.entries(totals.paidOut)
    .map(([currency, sum]) => `${money(sum)} ${currency}`)
    .join(' · ');
  return (
    <div className={styles.totals}>
      <span>{t('history.totals.count')}: <b>{totals.count}</b></span>
      <span>{t('history.totals.success')}: <b className={styles.positive}>{totals.success}</b></span>
      <span>{t('history.totals.refused')}: <b className={styles.negative}>{totals.refused}</b></span>
      <span>{t('history.totals.paid_out')}: <b>{paid || '—'}</b></span>
      <span>
        {t('history.totals.credited')}: <b className={styles.positive}>{money(totals.credited)} USDT</b>
      </span>
    </div>
  );
}

export default function HistoryPage() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<'deals' | 'balance'>('deals');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [balance, setBalance] = useState<BalanceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([getDealsHistory(), getMyBalanceHistory()])
      .then(([dealsData, balanceData]) => {
        setDeals(dealsData);
        setBalance(balanceData);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(() => groupByDay(deals), [deals]);
  const overall = useMemo(() => {
    const totals = emptyTotals();
    deals.forEach((d) => addDeal(totals, d));
    return totals;
  }, [deals]);

  // Day and month names follow the selected interface language.
  const locale = i18n.language?.startsWith('en') ? 'en-US' : i18n.language?.startsWith('uk') ? 'uk-UA' : 'ru-RU';

  const renderDeals = () => {
    if (sections.length === 0) {
      return <div className={dealStyles.emptyState}>{t('common.no_data')}</div>;
    }
    return (
      <>
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>{t('history.totals.all_time')}</div>
          <TotalsLine totals={overall} />
        </div>

        {sections.map((s) => (
          <section key={s.key} className={styles.day}>
            <div className={styles.dayHeader}>
              <div className={styles.dayTitle}>
                {s.date
                  ? s.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
                  : t('history.no_date')}
              </div>
              <TotalsLine totals={s} />
            </div>
            <div className={dealStyles.tableWrapper}>
              <table className={dealStyles.table}>
                <thead>
                  <tr>
                    <th>{t('history.table.request_id')}</th>
                    <th>{t('history.day_table.time')}</th>
                    <th>{t('history.day_table.amount')}</th>
                    <th>{t('history.day_table.rate')}</th>
                    <th>{t('history.day_table.credited')}</th>
                    <th>{t('history.day_table.recipient')}</th>
                    <th>{t('history.day_table.bank')}</th>
                    <th>{t('history.day_table.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.deals.map((d) => {
                    const iso = finishedAt(d);
                    const sc = STATUS_COLORS[d.status] ?? STATUS_FALLBACK;
                    return (
                      <tr key={d.id} className={dealStyles.rowInactive}>
                        <td className={dealStyles.idCell}>#{d.id}</td>
                        <td className={dealStyles.cell}>
                          {iso ? toDate(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className={dealStyles.amountCell}>{money(amountOf(d))} {d.to_xml}</td>
                        <td className={dealStyles.cell}>{d.our_rate ?? '—'}</td>
                        <td className={dealStyles.amountCell}>
                          {d.credited_usdt != null ? money(d.credited_usdt) : '—'}
                        </td>
                        <td className={dealStyles.cell}>{String(d.to_values?.cardHolder ?? '—')}</td>
                        <td className={dealStyles.cell}>{String(d.to_values?.bankName ?? '—')}</td>
                        <td>
                          <span className={dealStyles.statusBadge} style={{ backgroundColor: sc.bg, color: sc.color }}>
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
    );
  };

  const renderBalance = () => {
    if (balance.length === 0) {
      return <div className={dealStyles.emptyState}>{t('common.no_data')}</div>;
    }
    return (
      <div className={styles.day}>
        <div className={dealStyles.tableWrapper}>
          <table className={dealStyles.table}>
            <thead>
              <tr>
                <th>{t('history.balance.date')}</th>
                <th>{t('history.balance.operation')}</th>
                <th>{t('history.balance.amount')}</th>
                <th>{t('history.balance.details')}</th>
              </tr>
            </thead>
            <tbody>
              {balance.map((h) => {
                // A reset stores the balance it wiped as a positive number; it is a deduction.
                const deduction = h.action === 'reset';
                return (
                  <tr key={h.id} className={dealStyles.rowInactive}>
                    <td className={dealStyles.cell}>
                      {h.created_at ? toDate(h.created_at).toLocaleString(locale) : '—'}
                    </td>
                    <td className={dealStyles.cell}>
                      {t(`history.actions.${h.action}`, { defaultValue: h.action })}
                    </td>
                    <td className={`${styles.signed} ${deduction ? styles.negative : styles.positive}`}>
                      {deduction ? '−' : '+'}{money(Math.abs(Number(h.amount)))}
                    </td>
                    <td className={styles.details}>{h.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={dealStyles.page}>
      <div className={dealStyles.breadcrumb}>{t('history.breadcrumb')}</div>

      <div className={styles.content}>
        <div className={styles.tabs}>
          <button className={tab === 'deals' ? styles.tabActive : styles.tab} onClick={() => setTab('deals')}>
            {t('history.tabs.deals')}
          </button>
          <button className={tab === 'balance' ? styles.tabActive : styles.tab} onClick={() => setTab('balance')}>
            {t('history.tabs.balance')}
          </button>
        </div>

        {loading ? (
          <div className={dealStyles.emptyState}>{t('common.loading')}</div>
        ) : failed ? (
          <div className={dealStyles.emptyState}>{t('history.load_error')}</div>
        ) : tab === 'deals' ? (
          renderDeals()
        ) : (
          renderBalance()
        )}
      </div>
    </div>
  );
}
