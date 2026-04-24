import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import VendorDashboard from './pages/vendor/VendorDashboard';
import RestaurantList from './pages/customer/RestaurantList';
import RestaurantDetail from './pages/customer/RestaurantDetail';
import Checkout from './pages/customer/Checkout';
import OrderTracking from './pages/customer/OrderTracking';
import OrderHistory from './pages/customer/OrderHistory';
import Profile from './pages/customer/Profile';
import PaymentCallback from './pages/customer/PaymentCallback';
import ProtectedRoute from './components/ProtectedRoute';
import { CartProvider } from './context/CartContext';
import { useAuth } from './context/AuthContext';

function App() {
  const { role, loading } = useAuth();

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#888' }}>Loading…</div>;

  const isCustomer = !role || role === 'customer' || role === 'user';

  return (
    <CartProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={
          role === 'admin' ? <Navigate to="/admin" /> :
          role === 'vendor' ? <Navigate to="/vendor" /> :
          <AuthPage />
        } />
        <Route path="/payment/callback" element={<PaymentCallback />} />

        {/* Customer pages — browsing is public; account pages require auth */}
        <Route path="/restaurants" element={<RestaurantList />} />
        <Route path="/restaurants/:id" element={<RestaurantDetail />} />

        {/* Checkout requires login */}
        <Route element={<ProtectedRoute allowedRoles={['customer', 'user', 'admin']} />}>
          <Route path="/restaurants/:id/checkout" element={<Checkout />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/orders/:id" element={<OrderTracking />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Admin Routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Route>

        {/* Vendor Routes */}
        <Route element={<ProtectedRoute allowedRoles={['vendor']} />}>
          <Route path="/vendor/*" element={<VendorDashboard />} />
        </Route>

        {/* Catch-all: send customers to restaurants, others to home */}
        <Route path="*" element={<Navigate to={isCustomer ? '/restaurants' : '/'} />} />
      </Routes>
    </CartProvider>
  );
}

export default App;
