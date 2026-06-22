import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminClient from '../../api/adminClient';
import AdminSidebar from '../../components/AdminSidebar/AdminSidebar';
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <AdminSidebar />
      <div className={styles.page}>
        <div className={styles.topbar}>
          <h1 className={styles.pageTitle}>API Key Logs</h1>
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
    </div>
  );
}
