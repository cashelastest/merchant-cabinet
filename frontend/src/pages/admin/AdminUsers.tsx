import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import adminClient from '../../api/adminClient';
import LanguageSwitcher from '../../components/LanguageSwitcher/LanguageSwitcher';
import styles from './Admin.module.css';

interface AdminUser {
  id: number;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  currencies: string[];
}

interface EditUser {
  username?: string;
  password?: string;
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyInputs, setCurrencyInputs] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
        api_key: '',
        secret: '',
      });
      setCreateSuccess(true);
      setNewUsername(''); setNewPassword('');
      setTimeout(() => setCreateSuccess(false), 3000);
      await fetchUsers();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCreateError(msg || 'Error creating user');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    setSaving((p) => ({ ...p, [userId]: true }));
    try {
      await adminClient.patch(`/admin/users/${userId}`, { is_active: !isActive });
      await fetchUsers();
    } finally {
      setSaving((p) => ({ ...p, [userId]: false }));
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Delete this user?')) return;
    setSaving((p) => ({ ...p, [userId]: true }));
    try {
      await adminClient.delete(`/admin/users/${userId}`);
      await fetchUsers();
    } finally {
      setSaving((p) => ({ ...p, [userId]: false }));
    }
  };

  const handleEditClick = (user: AdminUser) => {
    setEditingId(user.id);
    setEditUsername(user.username);
    setEditPassword('');
  };

  const handleEditSubmit = async (userId: number) => {
    setSaving((p) => ({ ...p, [userId]: true }));
    try {
      const updates: EditUser = {};
      if (editUsername) updates.username = editUsername;
      if (editPassword) updates.password = editPassword;
      if (Object.keys(updates).length > 0) {
        await adminClient.patch(`/admin/users/${userId}`, updates);
      }
      setEditingId(null);
      await fetchUsers();
    } finally {
      setSaving((p) => ({ ...p, [userId]: false }));
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>{t('admin.users.title')}</h1>
        <div className={styles.topbarActions}>
          <LanguageSwitcher />
          <button className={styles.navBtn} onClick={() => navigate('/admin/payouts')}>
            {t('admin.payouts.title')}
          </button>
          <button className={styles.navBtn} onClick={() => navigate('/admin/deals')}>
            Deals
          </button>
          <button className={styles.logoutBtn} onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.createForm} onSubmit={handleCreate}>
        <h2 className={styles.sectionTitle}>{t('admin.users.create_user')}</h2>
        <div className={styles.createFields}>
          <input className={styles.currencyInput} placeholder={t('admin.users.username')} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
          <input className={styles.currencyInput} placeholder={t('admin.users.password')} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <button className={createSuccess ? styles.savedBtn : styles.saveBtn} type="submit" disabled={creating}>
            {creating ? `${t('common.save')}…` : createSuccess ? `${t('common.save')} ✓` : t('common.save')}
          </button>
        </div>
        {createError && <div className={styles.error}>{createError}</div>}
      </form>

      {loading ? (
        <div className={styles.empty}>Загрузка…</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.users.table.id')}</th>
                <th>{t('admin.users.table.username')}</th>
                <th>{t('admin.users.password')}</th>
                <th>{t('admin.users.status')}</th>
                <th>Role</th>
                <th>{t('admin.users.currencies')}</th>
                <th>{t('admin.users.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    {editingId === u.id ? (
                      <input
                        className={styles.currencyInput}
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => navigate(`/admin/deals/${u.id}`)}
                        style={{ cursor: 'pointer', color: '#60a5fa', textDecoration: 'underline' }}
                      >
                        {u.username}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingId === u.id ? (
                      <input
                        className={styles.currencyInput}
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="(оставить пусто)"
                      />
                    ) : (
                      <span style={{ color: '#aaa', fontSize: '12px' }}>••••••</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={u.is_active ? styles.badgeActive : styles.badgePaused}
                      onClick={() => handleToggleActive(u.id, u.is_active)}
                      disabled={saving[u.id]}
                      style={{ border: 'none', cursor: 'pointer', fontSize: 'inherit' }}
                    >
                      {u.is_active ? '✓ Активен' : '✕ Неактивен'}
                    </button>
                  </td>
                  <td>
                    <span className={u.is_admin ? styles.badgeAdmin : styles.badgeUser}>
                      {u.is_admin ? 'Админ' : 'Пользователь'}
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
                  <td style={{ display: 'flex', gap: '6px' }}>
                    {editingId === u.id ? (
                      <>
                        <button
                          className={styles.saveBtn}
                          onClick={() => handleEditSubmit(u.id)}
                          disabled={saving[u.id]}
                        >
                          {saving[u.id] ? 'Сохранение…' : 'Сохранить'}
                        </button>
                        <button
                          className={styles.resetBtn}
                          onClick={() => setEditingId(null)}
                          disabled={saving[u.id]}
                        >
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={saved[u.id] ? styles.savedBtn : styles.saveBtn}
                          onClick={() => handleSave(u.id)}
                          disabled={saving[u.id]}
                        >
                          {saving[u.id] ? 'Сохранение…' : saved[u.id] ? 'Сохранено ✓' : 'Сохранить'}
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(u.id)}
                          disabled={saving[u.id]}
                        >
                          Удалить
                        </button>
                      </>
                    )}
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
