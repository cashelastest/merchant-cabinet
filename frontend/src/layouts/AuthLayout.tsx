import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AuthLayout.module.css';

export default function AuthLayout() {
  const { token, loading } = useAuth();
  if (loading) return null;
  if (token) return <Navigate to="/deals" replace />;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <img src="/logo.png" alt="Logo" className={styles.logo} />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
