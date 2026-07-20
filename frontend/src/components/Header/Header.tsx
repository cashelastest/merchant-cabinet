import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Header.module.css';
import { useAuth } from '../../context/AuthContext';
import { setMyStatus } from '../../api/auth';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';

export default function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const isActive = user?.is_active ?? false;

  const [isPaused, setIsPaused] = useState(false);

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


    </>
  );
}
