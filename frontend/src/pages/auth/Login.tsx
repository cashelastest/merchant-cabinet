import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, verify2FA } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import styles from './Auth.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.requires_2fa) {
        setRequires2FA(true);
        setTempToken(result.access_token);
      } else {
        await authLogin(result.access_token);
        navigate('/deals');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await verify2FA(twoFACode, tempToken!);
      await authLogin(result.access_token);
      navigate('/deals');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (requires2FA) {
    return (
      <div className={styles.formBlock}>
        <h1 className={styles.title}>Two-Factor Authentication</h1>
        <form onSubmit={handle2FASubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formInputs}>
            <div className={styles.formInputBlock}>
              <label htmlFor="2fa-code">Enter 2FA Code</label>
              <input
                id="2fa-code"
                type="text"
                className={styles.formInput}
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                disabled={loading}
                autoFocus
                maxLength={6}
              />
            </div>
          </div>
          <div className={styles.buttonWrapper}>
            <button
              type="submit"
              className={`${styles.submitButton} ${loading ? styles.loading : ''}`}
              disabled={loading}
            >
              {loading ? '' : 'Verify'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setRequires2FA(false);
              setTempToken(null);
              setTwoFACode('');
              setUsername('');
              setPassword('');
            }}
            disabled={loading}
            style={{ marginTop: '10px', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer' }}
          >
            Back to Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.formBlock}>
      <h1 className={styles.title}>Sign In</h1>
      <form onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.formInputs}>
          <div className={styles.formInputBlock}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className={styles.formInput}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>
          <div className={styles.formInputBlock}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className={styles.formInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
        </div>
        <div className={styles.authLinkBlock}>
          No account?{' '}
          <Link to="/auth/register" className={styles.authLink}>
            Register
          </Link>
        </div>
        <div className={styles.buttonWrapper}>
          <button
            type="submit"
            className={`${styles.submitButton} ${loading ? styles.loading : ''}`}
            disabled={loading}
          >
            {loading ? '' : 'Sign In'}
          </button>
        </div>
      </form>
    </div>
  );
}
