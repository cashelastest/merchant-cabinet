import { NavLink, useNavigate } from 'react-router-dom';
import styles from './AdminSidebar.module.css';

export default function AdminSidebar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        <NavLink
          to="/admin/users"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <span className={styles.icon}>👥</span>
          <span className={styles.label}>Users</span>
        </NavLink>
        <NavLink
          to="/admin/deals"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <span className={styles.icon}>📋</span>
          <span className={styles.label}>Deals</span>
        </NavLink>
        <NavLink
          to="/admin/logs"
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          <span className={styles.icon}>📝</span>
          <span className={styles.label}>Logs</span>
        </NavLink>
      </nav>
      <button className={styles.logoutBtn} onClick={logout}>
        Logout
      </button>
    </aside>
  );
}
