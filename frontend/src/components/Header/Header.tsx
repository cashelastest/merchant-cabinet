import { useState } from 'react';
import styles from './Header.module.css';
import { useAuth } from '../../context/AuthContext';
import { setMyStatus, updateMyCurrencies } from '../../api/auth';

export default function Header() {
  const { user, logout, refreshUser } = useAuth();
  const isActive = user?.is_active ?? true;

  const [showCurrencies, setShowCurrencies] = useState(false);
  const [currencyInput, setCurrencyInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handleToggleActive = async () => {
    try {
      await setMyStatus(!isActive);
      await refreshUser();
      window.dispatchEvent(new CustomEvent('session:status', { detail: { is_active: !isActive } }));
    } catch {/* ignore */}
  };

  const handleEnd = () => {
    if (confirm('Завершить сессию и выйти?')) logout();
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
      // update WS connection currencies without reconnecting
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
          <button className={`${styles.btn} ${styles.btnEnd}`} onClick={handleEnd}>
            <span className={styles.btnDot} style={{ background: '#ef4444' }} />
            End
          </button>
          <button
            className={`${styles.btn} ${isActive ? styles.btnPause : styles.btnResume}`}
            onClick={handleToggleActive}
          >
            <span className={styles.btnDot} style={{ background: isActive ? '#fbbf24' : '#4ade80' }} />
            {isActive ? 'Pause' : 'Resume'}
          </button>
          <button className={`${styles.btn} ${styles.btnPayout}`} onClick={() => alert('Вывод инициирован')}>
            <span className={styles.btnDot} style={{ background: '#4ade80' }} />
            Payout
          </button>
        </div>

        <div className={styles.right}>
          {user && (
            <>
              <span className={`${styles.statusChip} ${isActive ? styles.statusActive : styles.statusPaused}`}>
                {isActive ? 'Active' : 'Paused'}
              </span>
              <button className={styles.currenciesBtn} onClick={openCurrencies} title="Currencies">
                {user.currencies.length > 0
                  ? user.currencies.join(', ')
                  : '+ Currencies'}
              </button>
              <span className={styles.balance}>
                {user.username}: {Number(user.balance).toFixed(2)}
              </span>
            </>
          )}
          <button className={styles.refreshBtn} onClick={handleRefresh}>↻ Refresh</button>
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
