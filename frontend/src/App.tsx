import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ProductPage from './pages/ProductPage';
import ListProductPage from './pages/ListProductPage';
import DashboardPage from './pages/DashboardPage';
import MyOrdersPage from './pages/MyOrdersPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import { getRoleFromToken } from './services/api';

function SellerRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  const role = getRoleFromToken(token);
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'seller') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function BuyerRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  const role = getRoleFromToken(token);
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'buyer') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-artisan-cream">
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Seller only */}
          <Route path="/list-product" element={<SellerRoute><ListProductPage /></SellerRoute>} />
          <Route path="/dashboard" element={<SellerRoute><DashboardPage /></SellerRoute>} />

          {/* Buyer only */}
          <Route path="/my-orders" element={<BuyerRoute><MyOrdersPage /></BuyerRoute>} />
          <Route path="/cart" element={<BuyerRoute><CartPage /></BuyerRoute>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
