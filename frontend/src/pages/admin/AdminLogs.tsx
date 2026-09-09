import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        <h1 className={styles.pageTitle}>{t('admin.logs.breadcrumb')}</h1>
        <div className={styles.topbarActions}>
          <button className={styles.navBtn} onClick={() => navigate('/admin/users')}>
            {t('nav.admin_users')}
          </button>
          <button className={styles.navBtn} onClick={() => navigate('/admin/deals')}>
            Deals
          </button>
          <button className={styles.logoutBtn} onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>{t('common.loading')}</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('admin.logs.table.username')}</th>
                <th>{t('admin.logs.table.key_type')}</th>
                <th>{t('admin.logs.table.purpose')}</th>
                <th>{t('admin.logs.table.timestamp')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={5} className={styles.empty}>{t('admin.logs.table.no_logs')}</td></tr>
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
                  <td>{new Date(l.used_at).toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
