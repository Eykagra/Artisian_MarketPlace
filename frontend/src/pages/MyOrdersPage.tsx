import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMyOrders, getRoleFromToken, type Order } from '../services/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Order received — awaiting confirmation',
  confirmed: 'Payment confirmed · Preparing your order',
  shipped: 'On the way to you!',
  delivered: 'Delivered 🎉',
  completed: 'Delivered 🎉',
  cancelled: 'Cancelled by seller',
};

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const role = getRoleFromToken(token);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/login?redirect=/my-orders', { replace: true });
      return;
    }
    if (role === 'seller') {
      navigate('/dashboard', { replace: true });
      return;
    }
    let cancelled = false;
    fetchMyOrders(token)
      .then((d) => { if (!cancelled) setOrders(d); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Failed to load orders'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, role, navigate]);

  if (!token || role === 'seller') return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white py-8">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-3xl font-bold text-artisan-bark">My Orders</h1>
          <p className="mt-1 text-artisan-stone">Track everything you've ordered.</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading && (
          <div className="py-16 text-center text-artisan-stone">Loading your orders…</div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && orders.length === 0 && !error && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 py-16 text-center text-artisan-stone">
            <p className="text-4xl">🛍️</p>
            <p className="mt-4 font-medium">No orders yet.</p>
            <Link to="/" className="mt-3 inline-block text-artisan-terracotta hover:underline">
              Browse products →
            </Link>
          </div>
        )}
        {!loading && orders.length > 0 && (
          <ul className="space-y-4">
            {orders.map((o) => {
              const isActive = o.status !== 'cancelled' && o.status !== 'delivered' && o.status !== 'completed';
              return (
                <li key={o.id} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start gap-4">
                    {/* Product image */}
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-stone-100 bg-stone-100">
                      {o.productImageUrl ? (
                        <img
                          src={o.productImageUrl}
                          alt={o.productTitle}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-stone-300 text-2xl">◇</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/products/${o.productId}`}
                          className="font-semibold text-artisan-bark hover:text-artisan-terracotta"
                        >
                          {o.productTitle}
                        </Link>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[o.status] ?? 'bg-stone-100 text-stone-600'}`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-artisan-stone">
                        {STATUS_LABELS[o.status] ?? o.status}
                      </p>
                      {o.status === 'cancelled' && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800">
                          💸 Refund processing — money will be credited in 3 business days
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-artisan-stone">
                        <span>Qty: <strong className="text-artisan-bark">{o.quantity}</strong></span>
                        <span>Total: <strong className="text-artisan-bark">₹{o.totalPrice.toLocaleString('en-IN')}</strong></span>
                        <span>Seller: <strong className="text-artisan-bark">{o.sellerEmail}</strong></span>
                      </div>
                      <p className="mt-1 text-xs text-artisan-stone/70">
                        Ordered on {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {/* Delivery OTP — visible for active orders */}
                      {isActive && o.deliveryOtp && (
                        <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Delivery OTP</p>
                          <p className="mt-0.5 text-2xl font-black tracking-[0.3em] text-amber-900 font-mono">{o.deliveryOtp}</p>
                          <p className="mt-0.5 text-[10px] text-amber-600">Share with seller on delivery</p>
                        </div>
                      )}

                      <div className="text-right text-sm text-artisan-stone">
                        <p className="font-medium text-artisan-bark">Delivery to</p>
                        <p>{o.deliveryCity}, {o.deliveryPincode}</p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
