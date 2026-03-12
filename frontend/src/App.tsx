import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './components/ui/Toast';

// Layouts
import CustomerLayout from './components/layout/CustomerLayout';
import AdminLayout from './components/layout/AdminLayout';

// Login pages
import LoginPage from './pages/LoginPage';
import CustomerLoginPage from './pages/customer/LoginPage';

// Customer pages
import CustomerRegister from './pages/customer/RegisterPage';
import CustomerHome from './pages/customer/HomePage';
import CustomerHistory from './pages/customer/HistoryPage';
import CustomerProfile from './pages/customer/ProfilePage';
import CompleteProfilePage from './pages/customer/CompleteProfilePage';

// Admin pages
import AdminDashboard from './pages/admin/DashboardPage';
import AdminPOS from './pages/admin/POSPage';
import AdminCustomers from './pages/admin/CustomersPage';
import AdminRedemptions from './pages/admin/RedemptionsPage';
import AdminSettings from './pages/admin/SettingsPage';
import AdminActivity from './pages/admin/ActivityPage';
import AdminReport from './pages/admin/ReportPage';
import AdminStaff from './pages/admin/StaffPage';
import AdminTransactionHistory from './pages/admin/TransactionHistoryPage';
import AdminBroadcasts from './pages/admin/BroadcastsPage';

import StaffRegisterPage from './pages/StaffRegisterPage';
import GoogleCallbackPage from './pages/GoogleCallbackPage';
import NotFoundPage from './pages/NotFoundPage';

function AppRoutes() {
  const { isAuthenticated, isAdmin, needsProfileCompletion } = useAuth();

  return (
    <Routes>
      {/* Admin/Staff login - with password */}
      <Route path="login" element={
        isAuthenticated ? (
          isAdmin ? <Navigate to="/admin" replace /> :
          needsProfileCompletion ? <Navigate to="/complete-profile" replace /> :
          <Navigate to="/" replace />
        ) : <LoginPage />
      } />

      {/* Customer login - phone only */}
      <Route path="users" element={
        isAuthenticated ? (
          isAdmin ? <Navigate to="/admin" replace /> :
          needsProfileCompletion ? <Navigate to="/complete-profile" replace /> :
          <Navigate to="/" replace />
        ) : <CustomerLoginPage />
      } />

      <Route path="register" element={
        isAuthenticated ? (
          isAdmin ? <Navigate to="/admin" replace /> :
          needsProfileCompletion ? <Navigate to="/complete-profile" replace /> :
          <Navigate to="/" replace />
        ) : <CustomerRegister />
      } />
      <Route path="staff-register" element={
        isAuthenticated ? (
          isAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/" replace />
        ) : <StaffRegisterPage />
      } />

      {/* Google OAuth redirect callback */}
      <Route path="auth/google/callback" element={<GoogleCallbackPage />} />

      {/* Legacy admin/login redirect */}
      <Route path="admin/login" element={<Navigate to="/login" replace />} />

      {/* Complete profile route - for customers with incomplete profile */}
      <Route path="complete-profile" element={
        !isAuthenticated ? <Navigate to="/users" replace /> :
        isAdmin ? <Navigate to="/admin" replace /> :
        !needsProfileCompletion ? <Navigate to="/" replace /> :
        <CompleteProfilePage />
      } />

      {/* Customer routes - redirect to /users if not authenticated */}
      <Route element={
        !isAuthenticated ? <Navigate to="/users" replace /> :
        isAdmin ? <Navigate to="/admin" replace /> :
        needsProfileCompletion ? <Navigate to="/complete-profile" replace /> :
        <CustomerLayout />
      }>
        <Route index element={<CustomerHome />} />
        <Route path="history" element={<CustomerHistory />} />
        <Route path="profile" element={<CustomerProfile />} />
      </Route>

      {/* Admin routes */}
      <Route path="admin" element={
        isAuthenticated && isAdmin ? <AdminLayout /> : <Navigate to="/login" replace />
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="pos" element={<AdminPOS />} />
        <Route path="walkin-sales" element={<Navigate to="/admin/pos" replace />} />
        <Route path="add-token" element={<Navigate to="/admin/pos" replace />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="redemptions" element={<AdminRedemptions />} />
        <Route path="report" element={<AdminReport />} />
        <Route path="staff" element={<AdminStaff />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="transactions" element={<AdminTransactionHistory />} />
        <Route path="broadcasts" element={<AdminBroadcasts />} />
        <Route path="activity" element={<AdminActivity />} />

      </Route>

      {/* Catch-all: 404 page */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/+$/, '')}>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
