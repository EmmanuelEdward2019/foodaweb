import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { CartProvider } from './context/CartContext';
import { useAuth } from './context/AuthContext';

// Lazy-load all page-level components to reduce initial bundle size
const LandingPage      = lazy(() => import('./pages/LandingPage'));
const AuthPage         = lazy(() => import('./pages/AuthPage'));
const AdminDashboard   = lazy(() => import('./pages/admin/AdminDashboard'));
const VendorDashboard  = lazy(() => import('./pages/vendor/VendorDashboard'));
const RestaurantList   = lazy(() => import('./pages/customer/RestaurantList'));
const RestaurantDetail = lazy(() => import('./pages/customer/RestaurantDetail'));
const Checkout         = lazy(() => import('./pages/customer/Checkout'));
const OrderTracking    = lazy(() => import('./pages/customer/OrderTracking'));
const OrderHistory     = lazy(() => import('./pages/customer/OrderHistory'));
const Profile          = lazy(() => import('./pages/customer/Profile'));
const PaymentCallback  = lazy(() => import('./pages/customer/PaymentCallback'));

const PageLoader = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#888' }}>
    Loading…
  </div>
);

function App() {
  const { role, loading } = useAuth();

  if (loading) return <PageLoader />;

  const isCustomer = !role || role === 'customer' || role === 'user';

  return (
    <ErrorBoundary>
      <CartProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={
              role === 'admin' ? <Navigate to="/admin" /> :
              role === 'vendor' ? <Navigate to="/vendor" /> :
              <AuthPage />
            } />
            <Route path="/payment/callback" element={<PaymentCallback />} />

            {/* Customer — browsing is public */}
            <Route path="/restaurants" element={<RestaurantList />} />
            <Route path="/restaurants/:id" element={<RestaurantDetail />} />

            {/* Customer — account pages require auth */}
            <Route element={<ProtectedRoute allowedRoles={['customer', 'user', 'admin']} />}>
              <Route path="/restaurants/:id/checkout" element={<Checkout />} />
              <Route path="/orders" element={<OrderHistory />} />
              <Route path="/orders/:id" element={<OrderTracking />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Admin */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Route>

            {/* Vendor */}
            <Route element={<ProtectedRoute allowedRoles={['vendor']} />}>
              <Route path="/vendor/*" element={<VendorDashboard />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to={isCustomer ? '/restaurants' : '/'} />} />
          </Routes>
        </Suspense>
      </CartProvider>
    </ErrorBoundary>
  );
}

export default App;
