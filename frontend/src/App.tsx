import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/auth/Login';
import DealsPage from './pages/deals/DealsPage';
import HistoryPage from './pages/history/HistoryPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/admin/AdminRoute';
import AdminLogin from './pages/admin/AdminLogin';
import AdminUsers from './pages/admin/AdminUsers';
import AdminDeals from './pages/admin/AdminDeals';
import AdminLogs from './pages/admin/AdminLogs';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Merchant routes */}
        <Route element={<AuthLayout />}>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<Navigate to="/auth/login" replace />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/" element={<Navigate to="/deals" replace />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/deals" element={<AdminDeals />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
        </Route>
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
