import { Outlet } from 'react-router-dom';
import Header from '../components/Header/Header';
import Sidebar from '../components/Sidebar/Sidebar';

export default function MainLayout() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <Header />
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
