import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminClient from '../../api/adminClient';
import styles from './Admin.module.css';

interface AdminUser {
  id: number;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  currencies: string[];
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyInputs, setCurrencyInputs] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await adminClient.get<AdminUser[]>('/admin/users').then((r) => r.data);
      setUsers(data);
      const inputs: Record<number, string> = {};
      data.forEach((u) => { inputs[u.id] = u.currencies.join(', '); });
      setCurrencyInputs(inputs);
    } catch {
      setError('Access denied or session expired');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (userId: number) => {
    setSaving((p) => ({ ...p, [userId]: true }));
    try {
      const list = (currencyInputs[userId] ?? '')
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      await adminClient.patch(`/admin/users/${userId}/currencies`, { currencies: list });
      setSaved((p) => ({ ...p, [userId]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [userId]: false })), 2000);
      await fetchUsers();
    } finally {
      setSaving((p) => ({ ...p, [userId]: false }));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await adminClient.post('/admin/users', {
        username: newUsername,
        password: newPassword,
        api_key: newApiKey,
        secret: newSecret,
      });
      setCreateSuccess(true);
      setNewUsername(''); setNewPassword(''); setNewApiKey(''); setNewSecret('');
      setTimeout(() => setCreateSuccess(false), 3000);
      await fetchUsers();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCreateError(msg || 'Error creating user');
    } finally {
      setCreating(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>Admin — Users</h1>
        <div className={styles.topbarActions}>
          <button className={styles.navBtn} onClick={() => navigate('/admin/deals')}>
            Deals History
          </button>
          <button className={styles.navBtn} onClick={() => navigate('/admin/logs')}>
            API Logs
          </button>
          <button className={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.createForm} onSubmit={handleCreate}>
        <h2 className={styles.sectionTitle}>Create User</h2>
        <div className={styles.createFields}>
          <input className={styles.currencyInput} placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
          <input className={styles.currencyInput} placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <input className={styles.currencyInput} placeholder="API Key" value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} required />
          <input className={styles.currencyInput} placeholder="Secret" value={newSecret} onChange={(e) => setNewSecret(e.target.value)} required />
          <button className={createSuccess ? styles.savedBtn : styles.saveBtn} type="submit" disabled={creating}>
            {creating ? 'Creating…' : createSuccess ? 'Created ✓' : 'Create'}
          </button>
        </div>
        {createError && <div className={styles.error}>{createError}</div>}
      </form>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Status</th>
                <th>Role</th>
                <th>Currencies</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>
                    <span className={u.is_active ? styles.badgeActive : styles.badgePaused}>
                      {u.is_active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <span className={u.is_admin ? styles.badgeAdmin : styles.badgeUser}>
                      {u.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>
                    <input
                      className={styles.currencyInput}
                      value={currencyInputs[u.id] ?? ''}
                      onChange={(e) => setCurrencyInputs((p) => ({ ...p, [u.id]: e.target.value }))}
                      placeholder="UAH, USDT, BTC"
                    />
                  </td>
                  <td>
                    <button
                      className={saved[u.id] ? styles.savedBtn : styles.saveBtn}
                      onClick={() => handleSave(u.id)}
                      disabled={saving[u.id]}
                    >
                      {saving[u.id] ? 'Saving…' : saved[u.id] ? 'Saved ✓' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
