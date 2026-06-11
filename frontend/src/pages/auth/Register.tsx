import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import styles from './Auth.module.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token } = await register(username, password, apiKey, secret);
      await authLogin(access_token);
      navigate('/deals');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formBlock}>
      <h1 className={styles.title}>Register</h1>
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
              autoComplete="new-password"
            />
          </div>
          <div className={styles.formInputBlock}>
            <label htmlFor="apiKey">API Key</label>
            <input
              id="apiKey"
              type="text"
              className={styles.formInput}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className={styles.formInputBlock}>
            <label htmlFor="secret">Secret</label>
            <input
              id="secret"
              type="password"
              className={styles.formInput}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        </div>
        <div className={styles.authLinkBlock}>
          Have an account?{' '}
          <Link to="/auth/login" className={styles.authLink}>
            Sign In
          </Link>
        </div>
        <div className={styles.buttonWrapper}>
          <button
            type="submit"
            className={`${styles.submitButton} ${loading ? styles.loading : ''}`}
            disabled={loading}
          >
            {loading ? '' : 'Register'}
          </button>
        </div>
      </form>
    </div>
  );
}
