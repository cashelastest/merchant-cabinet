import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Header.module.css';
import { useAuth } from '../../context/AuthContext';
import { setMyStatus } from '../../api/auth';
import { requestPayout } from '../../api/payout';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';

export default function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const isActive = user?.is_active ?? false;

  const [isPaused, setIsPaused] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutWallet, setPayoutWallet] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  const handleStart = async () => {
    try {
      await setMyStatus(true);
      await refreshUser();
      setIsPaused(false);
      window.dispatchEvent(new CustomEvent('session:status', { detail: { is_active: true } }));
      window.dispatchEvent(new CustomEvent('deals:refresh'));
    } catch {/* ignore */}
  };

  const handleEnd = async () => {
    try {
      await setMyStatus(false);
      await refreshUser();
      setIsPaused(false);
      window.dispatchEvent(new CustomEvent('session:status', { detail: { is_active: false } }));
      window.dispatchEvent(new CustomEvent('deals:refresh'));
    } catch {/* ignore */}
  };

  const handlePause = () => {
    const next = !isPaused;
    setIsPaused(next);
    window.dispatchEvent(new CustomEvent('session:status', { detail: { is_active: !next } }));
    window.dispatchEvent(new CustomEvent('deals:refresh'));
  };

  const handleRefresh = async () => {
    await refreshUser();
    window.dispatchEvent(new CustomEvent('deals:refresh'));
  };

  const handlePayoutSubmit = async () => {
    setPayoutError('');
    const amount = parseFloat(payoutAmount);
    if (!payoutWallet.trim()) { setPayoutError('Enter wallet address'); return; }
    if (isNaN(amount) || amount <= 0) { setPayoutError('Enter a valid amount'); return; }
    if (amount > (user?.balance ?? 0)) { setPayoutError('Insufficient balance'); return; }
    setPayoutLoading(true);
    try {
      const result = await requestPayout({ amount });
      setShowPayout(false);
      setPayoutAmount('');
      setPayoutWallet('');
      await refreshUser();
      window.location.href = result.redirect_url;
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPayoutError(msg || 'Payout failed');
    } finally {
      setPayoutLoading(false);
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
              <button className={`${styles.btn} ${styles.btnPayout}`} onClick={() => { setShowPayout(true); setPayoutError(''); }}>
                <span className={styles.btnDot} style={{ background: '#4ade80' }} />
                Payout
              </button>
            </>
          )}
        </div>

        <div className={styles.right}>
          <LanguageSwitcher />
          {user && (
            <>
              <span className={`${styles.statusChip} ${isActive && !isPaused ? styles.statusActive : styles.statusPaused}`}>
                {!isActive ? 'Inactive' : isPaused ? 'Paused' : 'Active'}
              </span>
              <span className={styles.balance}>
                {user.username}: {Number(user.balance).toFixed(2)}
              </span>
            </>
          )}
          <button className={styles.refreshBtn} onClick={handleRefresh}>↻ Refresh</button>
          <button className={styles.settingsBtn} onClick={() => navigate('/settings')} title="Settings">⚙ Settings</button>
          <button className={styles.logoutBtn} onClick={logout} title="Logout">⎋</button>
        </div>
      </div>

      {showPayout && (
        <div className={styles.payoutOverlay} onClick={() => setShowPayout(false)}>
          <div className={styles.payoutModal} onClick={(e) => e.stopPropagation()}>

            <div className={styles.payoutHeader}>
              <h2 className={styles.payoutTitle}>Withdraw funds</h2>
              <button className={styles.payoutClose} onClick={() => setShowPayout(false)}>✕</button>
            </div>

            <div className={styles.payoutDirection}>
              <div className={styles.payoutCurrency}>
                <span className={styles.payoutCurrencyIcon}>₮</span>
                <span className={styles.payoutCurrencyName}>USDT</span>
              </div>
              <span className={styles.payoutArrow}>→</span>
              <div className={styles.payoutCurrency}>
                <span className={styles.payoutCurrencyIcon}>👛</span>
                <span className={styles.payoutCurrencyName}>USDT Wallet</span>
              </div>
            </div>

            <div className={styles.payoutBalance}>
              Available balance: <strong>{Number(user?.balance ?? 0).toFixed(2)} USDT</strong>
            </div>

            <div className={styles.payoutFields}>
              <div className={styles.payoutField}>
                <label className={styles.payoutLabel}>USDT wallet address (TRC20)</label>
                <input
                  className={styles.payoutInput}
                  value={payoutWallet}
                  onChange={(e) => setPayoutWallet(e.target.value)}
                  placeholder="T…"
                  autoFocus
                />
              </div>
              <div className={styles.payoutField}>
                <label className={styles.payoutLabel}>Amount (USDT)</label>
                <div className={styles.payoutAmountRow}>
                  <input
                    className={styles.payoutInput}
                    type="number"
                    min="0"
                    step="0.01"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <button
                    className={styles.payoutMax}
                    type="button"
                    onClick={() => setPayoutAmount(String(Number(user?.balance ?? 0).toFixed(2)))}
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>

            {payoutError && <div className={styles.payoutError}>{payoutError}</div>}

            <div className={styles.payoutActions}>
              <button className={styles.payoutCancel} onClick={() => setShowPayout(false)}>
                {t('common.cancel')}
              </button>
              <button className={styles.payoutSubmit} onClick={handlePayoutSubmit} disabled={payoutLoading}>
                {payoutLoading ? 'Processing…' : 'Withdraw →'}
              </button>
            </div>

          </div>
        </div>
      )}

    </>
  );
}
