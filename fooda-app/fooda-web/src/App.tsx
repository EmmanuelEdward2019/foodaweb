import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import VendorDashboard from './pages/vendor/VendorDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function App() {
  const { role, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={
        // If already logged in, redirect to dashboard
        role === 'admin' ? <Navigate to="/admin" /> :
          role === 'vendor' ? <Navigate to="/vendor" /> :
            <AuthPage />
      } />

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Route>

      {/* Vendor Routes */}
      <Route element={<ProtectedRoute allowedRoles={['vendor']} />}>
        <Route path="/vendor/*" element={<VendorDashboard />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
