import { Outlet } from 'react-router-dom';
import Header from '../components/Header/Header';

export default function MainLayout() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
