import { useState } from 'react';
import styles from './Header.module.css';
import { useAuth } from '../../context/AuthContext';
import { setMyStatus, updateMyCurrencies } from '../../api/auth';

export default function Header() {
  const { user, logout, refreshUser } = useAuth();
  const isActive = user?.is_active ?? false;

  const [isPaused, setIsPaused] = useState(false);
  const [showCurrencies, setShowCurrencies] = useState(false);
  const [currencyInput, setCurrencyInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    try {
      await setMyStatus(true);
      await refreshUser();
      setIsPaused(false);
      window.dispatchEvent(new CustomEvent('session:status', { detail: { is_active: true } }));
    } catch {/* ignore */}
  };

  const handleEnd = async () => {
    try {
      await setMyStatus(false);
      await refreshUser();
      setIsPaused(false);
      window.dispatchEvent(new CustomEvent('session:status', { detail: { is_active: false } }));
    } catch {/* ignore */}
  };

  const handlePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    window.dispatchEvent(new CustomEvent('session:status', { detail: { is_active: !next } }));
  };

  const handleRefresh = async () => {
    await refreshUser();
    window.dispatchEvent(new CustomEvent('deals:refresh'));
  };

  const openCurrencies = () => {
    setCurrencyInput((user?.currencies ?? []).join(', '));
    setShowCurrencies(true);
  };

  const saveCurrencies = async () => {
    setSaving(true);
    try {
      const list = currencyInput
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      await updateMyCurrencies(list);
      await refreshUser();
      setShowCurrencies(false);
      window.dispatchEvent(new CustomEvent('ws:update_currencies', { detail: { currencies: list } }));
      window.dispatchEvent(new CustomEvent('deals:refresh'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={styles.header}>
        <div className={styles.left}>
          <img src="/logo.png" alt="Logo" className={styles.logo} />
        </div>

        <div className={styles.center}>
          {!isActive ? (
            <button className={`${styles.btn} ${styles.btnStart}`} onClick={handleStart}>
              <span className={styles.btnDot} style={{ background: '#4ade80' }} />
              Start
            </button>
          ) : (
            <>
              <button className={`${styles.btn} ${styles.btnEnd}`} onClick={handleEnd}>
                <span className={styles.btnDot} style={{ background: '#ef4444' }} />
                End
              </button>
              <button
                className={`${styles.btn} ${isPaused ? styles.btnResume : styles.btnPause}`}
                onClick={handlePause}
              >
                <span className={styles.btnDot} style={{ background: isPaused ? '#4ade80' : '#fbbf24' }} />
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button className={`${styles.btn} ${styles.btnPayout}`} onClick={() => alert('Payout initiated')}>
                <span className={styles.btnDot} style={{ background: '#4ade80' }} />
                Payout
              </button>
            </>
          )}
        </div>

        <div className={styles.right}>
          {user && (
            <>
              <span className={`${styles.statusChip} ${isActive && !isPaused ? styles.statusActive : styles.statusPaused}`}>
                {!isActive ? 'Inactive' : isPaused ? 'Paused' : 'Active'}
              </span>
              <button className={styles.currenciesBtn} onClick={openCurrencies} title="Currencies">
                {user.currencies.length > 0 ? user.currencies.join(', ') : '+ Currencies'}
              </button>
              <span className={styles.balance}>
                {user.username}: {Number(user.balance).toFixed(2)}
              </span>
            </>
          )}
          <button className={styles.refreshBtn} onClick={handleRefresh}>↻ Refresh</button>
          <button className={styles.logoutBtn} onClick={logout} title="Logout">⎋</button>
        </div>
      </div>

      {showCurrencies && (
        <div className={styles.modalOverlay} onClick={() => setShowCurrencies(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Currencies</h3>
            <p className={styles.modalHint}>
              Enter currency XML codes separated by commas (e.g. UAH, USDT, BTC)
            </p>
            <input
              className={styles.modalInput}
              value={currencyInput}
              onChange={(e) => setCurrencyInput(e.target.value)}
              placeholder="UAH, USDT, BTC"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveCurrencies()}
            />
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowCurrencies(false)}>
                Cancel
              </button>
              <button className={styles.modalSave} onClick={saveCurrencies} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
