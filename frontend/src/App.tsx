import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/auth/Login';
import DealsPage from './pages/deals/DealsPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/admin/AdminRoute';
import AdminLogin from './pages/admin/AdminLogin';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPayouts from './pages/admin/AdminPayouts';
import AdminLogs from './pages/admin/AdminLogs';
import DealsHistoryPage from './pages/deals/DealsHistoryPage';
import SettingsPage from './pages/settings/SettingsPage';
import DocsPage from './pages/DocsPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/docs" element={<DocsPage />} />

        {/* Merchant routes */}
        <Route element={<AuthLayout />}>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<Navigate to="/auth/login" replace />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/payout" element={<DealsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/" element={<Navigate to="/payout" replace />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/payouts" element={<AdminPayouts />} />
          <Route path="/admin/deals/:userId" element={<DealsHistoryPage />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
        </Route>
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
