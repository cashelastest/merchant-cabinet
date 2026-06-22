import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminClient from '../../api/adminClient';
import styles from './Admin.module.css';

interface LogEntry {
  id: number;
  username: string;
  used_at: string;
  purpose: string;
  key_type: string;
}

export default function AdminLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminClient.get<LogEntry[]>('/admin/logs?limit=200')
      .then((r) => setLogs(r.data))
      .catch(() => navigate('/admin/login'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>Admin — API Key Logs</h1>
        <div className={styles.topbarActions}>
          <button className={styles.navBtn} onClick={() => navigate('/admin/users')}>
            Users
          </button>
          <button className={styles.navBtn} onClick={() => navigate('/admin/deals')}>
            Deals
          </button>
          <button className={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Username</th>
                <th>Key Type</th>
                <th>Purpose</th>
                <th>Used At</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={5} className={styles.empty}>No logs yet</td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>{l.username}</td>
                  <td>
                    <span className={l.key_type === 'admin' ? styles.badgeAdmin : styles.badgeUser}>
                      {l.key_type}
                    </span>
                  </td>
                  <td>{l.purpose}</td>
                  <td>{new Date(l.used_at).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
