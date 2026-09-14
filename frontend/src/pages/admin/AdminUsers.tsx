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
  is_banned: boolean;
  currencies: string[];
  /** Markup percent per payout currency, e.g. { UAH: 2.5 } */
  markups: Record<string, number>;
}

interface EditUser {
  username?: string;
  password?: string;
}

function errorDetail(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  // FastAPI validation errors arrive as a list of { msg } objects
  if (Array.isArray(detail)) {
    return detail.map((d) => (d as { msg?: string })?.msg ?? '').filter(Boolean).join('; ') || fallback;
  }
  return fallback;
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyInputs, setCurrencyInputs] = useState<Record<number, string>>({});
  const [markupInputs, setMarkupInputs] = useState<Record<number, Record<string, string>>>({});
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
      const markups: Record<number, Record<string, string>> = {};
      data.forEach((u) => {
        inputs[u.id] = u.currencies.join(', ');
        markups[u.id] = Object.fromEntries(
          u.currencies.map((c) => [c, String(u.markups?.[c] ?? 0)]),
        );
      });
      setCurrencyInputs(inputs);
      setMarkupInputs(markups);
    } catch {
      setError('Access denied or session expired');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (userId: number) => {
    const list = (currencyInputs[userId] ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    // Markups are sent only for currencies that stay on the list. The PUT
    // replaces the whole set, so a removed currency loses its markup as well.
    const markups: Record<string, number> = {};
    for (const c of list) {
      const raw = (markupInputs[userId]?.[c] ?? '0').replace(',', '.').trim();
      const value = raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(value)) {
        alert(`Некорректная надбавка для ${c}: «${raw}»`);
        return;
      }
      markups[c] = value;
    }

    setSaving((p) => ({ ...p, [userId]: true }));
    try {
      await adminClient.patch(`/admin/users/${userId}/currencies`, { currencies: list });
      await adminClient.put(`/admin/users/${userId}/markups`, { markups });
      setSaved((p) => ({ ...p, [userId]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [userId]: false })), 2000);
      await fetchUsers();
    } catch (e) {
      alert(errorDetail(e, 'Не удалось сохранить'));
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
      setCreateError(errorDetail(e, 'Error creating user'));
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

  const handleToggleBan = async (user: AdminUser) => {
    const banning = !user.is_banned;
    if (
      banning &&
      !window.confirm(
        `Забанить ${user.username}?\n\nПользователь будет разлогинен, API-ключ перестанет работать, новые заявки ему не пойдут.`,
      )
    ) {
      return;
    }
    setSaving((p) => ({ ...p, [user.id]: true }));
    try {
      await adminClient.patch(`/admin/users/${user.id}`, { is_banned: banning });
      await fetchUsers();
    } catch (e) {
      alert(errorDetail(e, 'Не удалось изменить бан'));
    } finally {
      setSaving((p) => ({ ...p, [user.id]: false }));
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
                <th>Бан</th>
                <th>{t('admin.users.currencies')}</th>
                <th>Надбавка к курсу, %</th>
                <th>{t('admin.users.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={u.is_banned ? { backgroundColor: '#1f1212' } : undefined}>
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
                      <>
                        <span
                          onClick={() => navigate(`/admin/deals/${u.id}`)}
                          style={{ cursor: 'pointer', color: '#60a5fa', textDecoration: 'underline' }}
                        >
                          {u.username}
                        </span>
                        {u.is_banned && (
                          <span style={{ marginLeft: '8px', color: '#f87171', fontSize: '11px', fontWeight: 600 }}>
                            забанен
                          </span>
                        )}
                      </>
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
                    {u.is_admin ? (
                      <span style={{ color: '#666' }} title="Администратора забанить нельзя">—</span>
                    ) : (
                      <button
                        className={u.is_banned ? styles.unbanBtn : styles.banBtn}
                        onClick={() => handleToggleBan(u)}
                        disabled={saving[u.id]}
                      >
                        {u.is_banned ? 'Разбанить' : 'Забанить'}
                      </button>
                    )}
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
                    {u.currencies.length === 0 ? (
                      <span style={{ color: '#666', fontSize: '12px' }}>сначала сохраните валюты</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {u.currencies.map((c) => (
                          <label
                            key={c}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#aaa' }}
                          >
                            <span style={{ minWidth: '44px', fontFamily: 'monospace', color: '#ccc' }}>{c}</span>
                            <input
                              className={styles.currencyInput}
                              style={{ width: '80px' }}
                              inputMode="decimal"
                              value={markupInputs[u.id]?.[c] ?? '0'}
                              onChange={(e) =>
                                setMarkupInputs((p) => ({ ...p, [u.id]: { ...p[u.id], [c]: e.target.value } }))
                              }
                            />
                            %
                          </label>
                        ))}
                      </div>
                    )}
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
                          className={styles.resetBtn}
                          onClick={() => handleEditClick(u)}
                          disabled={saving[u.id]}
                        >
                          Изменить
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
