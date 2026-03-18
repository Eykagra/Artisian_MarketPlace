import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRoleFromToken } from '../services/api';

export default function Navbar() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  useEffect(() => {
    const onAuthChange = () => setToken(localStorage.getItem('token'));
    window.addEventListener('auth-change', onAuthChange);
    return () => window.removeEventListener('auth-change', onAuthChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    window.dispatchEvent(new Event('auth-change'));
    navigate('/');
  };

  const role = getRoleFromToken(token);
  const isSeller = role === 'seller';
  const isBuyer = role === 'buyer';

  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 bg-artisan-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          to={isSeller ? '/dashboard' : '/'}
          className="text-xl font-semibold tracking-tight text-artisan-bark transition hover:text-artisan-terracotta"
        >
          Artisan Marketplace
        </Link>

        <div className="flex items-center gap-6">
          {/* Guest + Buyer: Browse */}
          {(!token || isBuyer) && (
            <Link to="/" className="text-sm font-medium text-artisan-stone transition hover:text-artisan-bark">
              Browse
            </Link>
          )}

          {/* Seller only */}
          {isSeller && (
            <>
              <Link to="/list-product" className="text-sm font-medium text-artisan-stone transition hover:text-artisan-bark">
                List product
              </Link>
              <Link to="/dashboard" className="text-sm font-medium text-artisan-stone transition hover:text-artisan-bark">
                Dashboard
              </Link>
            </>
          )}

          {/* Buyer only */}
          {isBuyer && (
            <Link to="/my-orders" className="text-sm font-medium text-artisan-stone transition hover:text-artisan-bark">
              My orders
            </Link>
          )}

          {/* Auth */}
          {token ? (
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-medium text-artisan-stone transition hover:text-artisan-bark"
            >
              Log out
            </button>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-artisan-stone transition hover:text-artisan-bark">
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-artisan-terracotta px-3 py-1.5 text-sm font-medium text-white hover:bg-artisan-terracotta/90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
