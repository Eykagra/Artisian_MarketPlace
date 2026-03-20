import { useEffect, useRef, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  fetchMyProducts,
  fetchSellerOrders,
  fetchSellerStats,
  fetchSellerDashboard,
  updateOrderStatus,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  type Product,
  type Order,
  type SellerStats,
  type DashboardMetrics,
  type UpdateProductPayload,
} from '../services/api';
import { SocketContext } from '../contexts/SocketContext';

const CATEGORIES = ['Handcrafted', 'Jewelry', 'Textiles', 'Pottery', 'Woodwork', 'Other'];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-artisan-stone">{label}</p>
      <p className="mt-1 text-2xl font-bold text-artisan-bark">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-artisan-stone">{sub}</p>}
    </div>
  );
}

type Tab = 'overview' | 'products' | 'orders';

export default function DashboardPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const { socket } = useContext(SocketContext);

  const [tab, setTab] = useState<Tab>('overview');

  // Dashboard Overview state
  const [dashboardData, setDashboardData] = useState<DashboardMetrics | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UpdateProductPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const pendingImageUrlRef = useRef<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  // OTP input: track which order is in "enter OTP" mode
  const [otpInputOrderId, setOtpInputOrderId] = useState<number | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');

  // Stats state
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const refreshAll = (tok: string) => {
    fetchSellerOrders(tok).then(setOrders).catch(() => {});
    fetchSellerStats(tok).then(setStats).catch(() => {});
    fetchSellerDashboard(tok).then(setDashboardData).catch(() => {});
  };

  useEffect(() => {
    if (!token) {
      navigate('/login?redirect=/dashboard', { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    setProductsLoading(true);
    fetchMyProducts(token)
      .then((d) => { if (!cancelled) setProducts(d); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Failed to load products'); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });

    setOrdersLoading(true);
    fetchSellerOrders(token)
      .then((d) => { if (!cancelled) setOrders(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOrdersLoading(false); });

    setDashboardLoading(true);
    fetchSellerDashboard(token)
      .then((d) => { if (!cancelled) setDashboardData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDashboardLoading(false); });

    setStatsLoading(true);
    fetchSellerStats(token)
      .then((d) => { if (!cancelled) setStats(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStatsLoading(false); });

    return () => { cancelled = true; };
  }, [token]);

  // ── Real-time: refresh analytics when a new order arrives via socket ──────
  useEffect(() => {
    if (!socket || !token) return;
    const handleNewOrder = () => {
      refreshAll(token);
    };
    socket.on('order:new', handleNewOrder);
    socket.on('order:update', handleNewOrder);
    return () => { 
      socket.off('order:new', handleNewOrder); 
      socket.off('order:update', handleNewOrder);
    };
  }, [socket, token]);

  // ── Products helpers ──────────────────────────────────────────────────────

  const startEdit = (p: Product) => {
    pendingImageUrlRef.current = null;
    setEditingId(p.id);
    setEditForm({
      title: p.title,
      description: p.description,
      price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price)),
      category: p.category,
      imageUrl: p.imageUrl ?? undefined,
      stock: typeof p.stock === 'number' ? p.stock : 1,
    });
  };

  const cancelEdit = () => {
    pendingImageUrlRef.current = null;
    setImageUploading(false);
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (!token || !editingId || !editForm) return;
    setSaving(true);
    try {
      const imageUrl = editForm.imageUrl ?? pendingImageUrlRef.current;
      const payload: UpdateProductPayload = { ...editForm, imageUrl: imageUrl || null };
      const updated = await updateProduct(editingId, payload, token);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      pendingImageUrlRef.current = null;
      setEditingId(null);
      setEditForm(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    setSaving(true);
    try {
      await deleteProduct(id, token);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !editForm) return;
    setImageUploading(true);
    try {
      const url = await uploadProductImage(file, token);
      pendingImageUrlRef.current = url;
      setEditForm((prev) => (prev ? { ...prev, imageUrl: url } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  // ── Orders helpers ────────────────────────────────────────────────────────

  const handleCancel = async (orderId: number) => {
    if (!token) return;
    setUpdatingOrderId(orderId);
    try {
      const updated = await updateOrderStatus(orderId, 'cancelled', token);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o)));
      if (token) refreshAll(token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDeliverClick = (orderId: number) => {
    setOtpInputOrderId(orderId);
    setOtpValue('');
    setOtpError('');
  };

  const handleDeliverConfirm = async (orderId: number) => {
    if (!token) return;
    if (otpValue.length !== 4) {
      setOtpError('Please enter the 4-digit OTP.');
      return;
    }
    setUpdatingOrderId(orderId);
    setOtpError('');
    try {
      const updated = await updateOrderStatus(orderId, 'delivered', token, otpValue);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o)));
      setOtpInputOrderId(null);
      setOtpValue('');
      if (token) refreshAll(token);
    } catch (err: unknown) {
      // axios wraps 4xx errors — dig into the response body for the real message
      const axiosMsg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setOtpError(axiosMsg || (err instanceof Error ? err.message : 'Invalid OTP. Please try again.'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (!token) return null;

  const totalProducts = products.length;
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const activeOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered' && o.status !== 'completed');

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-artisan-bark">Seller Dashboard</h1>
              <p className="mt-1 text-artisan-stone">Manage your listings and track orders.</p>
            </div>
            <Link
              to="/list-product"
              className="inline-flex items-center gap-2 rounded-lg bg-artisan-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-artisan-terracotta/90"
            >
              + Create listing via chat
            </Link>
          </div>

          {/* Stats strip */}
          {!statsLoading && stats && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total listings" value={String(totalProducts)} />
              <StatCard label="Total orders" value={String(stats.totalOrders)} />
              <StatCard label="Active orders" value={String(activeOrders.length)} />
              <StatCard
                label="Total revenue"
                value={fmt(stats.totalRevenue)}
                sub="all time"
              />
            </div>
          )}
          {statsLoading && (
            <div className="mt-6 text-sm text-artisan-stone animate-pulse">Loading stats…</div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <nav className="flex gap-6">
            {(['overview', 'products', 'orders'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`border-b-2 px-1 py-3 text-sm font-medium capitalize transition ${
                  tab === t
                    ? 'border-artisan-terracotta text-artisan-terracotta'
                    : 'border-transparent text-artisan-stone hover:text-artisan-bark'
                }`}
              >
                {t === 'orders' && stats && stats.totalOrders > 0
                  ? `Orders (${stats.totalOrders})`
                  : t === 'orders'
                  ? 'Orders'
                  : t === 'products' ? `Products (${totalProducts})` : 'Overview'}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 py-3 px-4 text-sm text-red-700">
            {error}
            <button className="ml-3 underline" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* ── Overview Tab ───────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {dashboardLoading ? (
              <div className="animate-pulse space-y-6">
                <div className="h-10 w-2/3 rounded-lg bg-stone-200" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl bg-stone-200" />)}
                </div>
                <div className="h-80 rounded-xl bg-stone-200" />
              </div>
            ) : !dashboardData ? (
              <div className="text-center text-red-600 font-medium">Failed to load business insights.</div>
            ) : (
              <>
                {/* Insight Line */}
                <div className="flex items-center gap-3 rounded-lg border border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 text-[15px] font-medium text-amber-900 shadow-sm">
                  <span className="text-xl">📈</span> {dashboardData.insight}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard label="Total Revenue" value={fmt(dashboardData.summary.totalRevenue)} />
                  <StatCard label="Total Orders" value={String(dashboardData.summary.totalOrders)} />
                  <StatCard label="Products Listed" value={String(dashboardData.summary.productsListed)} />
                  <StatCard label="Top Selling" value={dashboardData.summary.bestSellingProduct} />
                </div>

                {dashboardData.summary.totalOrders === 0 ? (
                  <div className="mt-8 rounded-xl border border-stone-200 bg-stone-50 py-20 px-4 text-center shadow-sm">
                    <div className="mx-auto h-16 w-16 rounded-full bg-stone-200 flex items-center justify-center text-2xl mb-4">🛒</div>
                    <p className="text-xl font-bold text-artisan-bark">You haven't made any sales yet. Share your products to get started!</p>
                    <p className="mt-2 text-stone-500 font-medium max-w-md mx-auto">Your charts and insights will automatically appear here once buyers start purchasing your items.</p>
                  </div>
                ) : (
                  <>
                    {/* Charts Row */}
                    <div className="grid gap-6 lg:grid-cols-3">
                      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2">
                        <h3 className="mb-6 text-lg font-bold text-artisan-bark">Revenue Over Time (Last 30 Days)</h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dashboardData.revenueOverTime}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                              <XAxis dataKey="date" tick={{fontSize: 12, fill: '#78716C'}} axisLine={false} tickLine={false} dy={10} />
                              <YAxis tickFormatter={(val) => `₹${val}`} tick={{fontSize: 12, fill: '#78716C'}} axisLine={false} tickLine={false} dx={-10} />
                              <Tooltip
                                formatter={(value) => [`₹${Number(value ?? 0).toLocaleString('en-IN')}`, 'Revenue']}
                                labelStyle={{color: '#44403C', fontWeight: 'bold'}}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              />
                              <Line type="monotone" dataKey="revenue" stroke="#D35400" strokeWidth={3} dot={{r: 4, fill: '#FFF', strokeWidth: 2}} activeDot={{r: 6, fill: '#D35400'}} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-6 text-lg font-bold text-artisan-bark">Order Volume</h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData.revenueOverTime}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                              <XAxis dataKey="date" tick={{fontSize: 12, fill: '#78716C'}} axisLine={false} tickLine={false} dy={10} />
                              <YAxis allowDecimals={false} tick={{fontSize: 12, fill: '#78716C'}} axisLine={false} tickLine={false} dx={-10} />
                              <Tooltip formatter={(value) => [Number(value ?? 0), 'Orders']} cursor={{fill: '#F5F5F4'}} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                              <Bar dataKey="orders" fill="#FBBF24" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Tables Row */}
                    <div className="grid gap-6 lg:grid-cols-2 mt-2">
                      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-lg font-bold text-artisan-bark">Top Selling Products</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-stone-200 bg-stone-50">
                              <tr>
                                <th className="py-3 px-4 font-semibold text-artisan-stone">Product</th>
                                <th className="py-3 px-4 font-semibold text-right text-artisan-stone">Units</th>
                                <th className="py-3 px-4 font-semibold text-right text-artisan-stone">Revenue</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {dashboardData.topSellingProducts.map((p, idx) => (
                                <tr key={idx} className="hover:bg-stone-50/50 transition-colors">
                                  <td className="py-3 px-4 font-medium text-artisan-bark">{p.title}</td>
                                  <td className="py-3 px-4 text-right text-stone-600">{p.unitsSold}</td>
                                  <td className="py-3 px-4 text-right font-semibold text-artisan-terracotta">{fmt(p.revenue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-lg font-bold text-artisan-bark">Recent Orders</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-stone-200 bg-stone-50">
                              <tr>
                                <th className="py-3 px-4 font-semibold text-artisan-stone">Order</th>
                                <th className="py-3 px-4 font-semibold text-artisan-stone">Product</th>
                                <th className="py-3 px-4 font-semibold text-right text-artisan-stone">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {dashboardData.recentOrders.map((o) => (
                                <tr key={o.id} className="hover:bg-stone-50/50 transition-colors">
                                  <td className="py-3 px-4">
                                    <span className="font-semibold text-artisan-bark">#{o.id}</span>
                                    <div className="text-xs font-medium text-stone-500 mt-0.5">{o.buyerName}</div>
                                  </td>
                                  <td className="py-3 px-4 text-stone-600">{o.productTitle}</td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="font-semibold text-artisan-terracotta">{fmt(o.amount)}</div>
                                    <span className={`inline-block mt-1 rounded px-2 py-0.5 text-[10px] font-bold capitalize tracking-wide ${STATUS_COLORS[o.status] ?? 'bg-stone-100 text-stone-600'}`}>
                                      {o.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Products Tab ───────────────────────────────────────────────── */}
        {tab === 'products' && (
          <>
            {productsLoading && (
              <div className="py-16 text-center text-artisan-stone">Loading your products…</div>
            )}
            {!productsLoading && products.length === 0 && (
              <div className="rounded-xl border border-stone-200 bg-stone-50 py-16 text-center text-artisan-stone">
                <p className="font-medium">You have no products yet.</p>
                <Link to="/list-product" className="mt-4 inline-block text-artisan-terracotta hover:underline">
                  Create one with chat →
                </Link>
              </div>
            )}
            {!productsLoading && products.length > 0 && (
              <ul className="space-y-6">
                {products.map((p) => {
                  const productOrders = orders.filter((o) => o.productId === p.id);
                  const productRevenue = productOrders.reduce((s, o) => s + o.totalPrice, 0);
                  return (
                    <li key={p.id} className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
                      {editingId === p.id && editForm ? (
                        <div className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="block text-sm font-medium text-artisan-stone">Title</label>
                              <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, title: e.target.value } : null))}
                                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-artisan-stone">Category</label>
                              <select
                                value={editForm.category}
                                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, category: e.target.value } : null))}
                                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                              >
                                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-artisan-stone">Description</label>
                            <textarea
                              value={editForm.description}
                              onChange={(e) => setEditForm((prev) => (prev ? { ...prev, description: e.target.value } : null))}
                              rows={3}
                              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            <div>
                              <label className="block text-sm font-medium text-artisan-stone">Price (₹)</label>
                              <input
                                type="number" min="0" step="0.01"
                                value={editForm.price}
                                onChange={(e) => setEditForm((prev) => (prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null))}
                                className="mt-1 w-32 rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-artisan-stone">Stock</label>
                              <input
                                type="number" min="0" step="1"
                                value={typeof editForm.stock === 'number' ? editForm.stock : 1}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? { ...prev, stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) }
                                      : null
                                  )
                                }
                                className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-artisan-stone">Image</label>
                              <input
                                type="file" accept="image/*" onChange={handleImageChange}
                                className="mt-1 block w-full text-sm text-artisan-stone file:mr-2 file:rounded file:border-0 file:bg-artisan-terracotta/10 file:px-3 file:py-1 file:text-artisan-terracotta"
                              />
                              {editForm.imageUrl && (
                                <img src={editForm.imageUrl} alt="Preview" className="mt-2 h-24 w-24 rounded object-cover" />
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              type="button" onClick={handleSaveEdit} disabled={saving || imageUploading}
                              className="rounded-lg bg-artisan-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-artisan-terracotta/90 disabled:opacity-50"
                            >
                              {saving ? 'Saving…' : imageUploading ? 'Uploading image…' : 'Save'}
                            </button>
                            <button
                              type="button" onClick={cancelEdit} disabled={saving || imageUploading}
                              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-artisan-stone hover:bg-stone-100 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex gap-4">
                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-artisan-stone/50">
                                  <span className="text-2xl">◇</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="text-xs font-medium uppercase tracking-wide text-artisan-terracotta">{p.category}</span>
                              <h2 className="font-semibold text-artisan-bark">{p.title}</h2>
                              <p className="mt-1 line-clamp-2 text-sm text-artisan-stone">{p.description}</p>
                              <p className="mt-1 text-base font-semibold text-artisan-bark">
                                ₹{(typeof p.price === 'number' ? p.price : parseFloat(String(p.price))).toLocaleString('en-IN')}
                              </p>
                              <p className="mt-1 text-xs text-artisan-stone">
                                Stock left:{' '}
                                <span className="font-medium text-artisan-bark">
                                  {typeof p.stock === 'number' ? p.stock : 0}
                                </span>
                              </p>
                              {!ordersLoading && (
                                <p className="mt-1 text-xs text-artisan-stone">
                                  {productOrders.length} order{productOrders.length !== 1 ? 's' : ''}
                                  {productRevenue > 0 && ` · ${fmt(productRevenue)} revenue`}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button" onClick={() => startEdit(p)}
                              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-artisan-stone hover:bg-stone-100"
                            >
                              Edit
                            </button>
                            {deleteConfirmId === p.id ? (
                              <>
                                <span className="text-sm text-artisan-stone self-center">Delete?</span>
                                <button
                                  type="button" onClick={() => handleDelete(p.id)} disabled={saving}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >Yes</button>
                                <button
                                  type="button" onClick={() => setDeleteConfirmId(null)}
                                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium"
                                >No</button>
                              </>
                            ) : (
                              <button
                                type="button" onClick={() => setDeleteConfirmId(p.id)}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                              >Delete</button>
                            )}
                            <Link
                              to={`/products/${p.id}`}
                              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-artisan-stone hover:bg-stone-100"
                            >View</Link>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* ── Orders Tab ─────────────────────────────────────────────────── */}
        {tab === 'orders' && (
          <>
            {ordersLoading && (
              <div className="py-16 text-center text-artisan-stone">Loading orders…</div>
            )}
            {!ordersLoading && orders.length === 0 && (
              <div className="rounded-xl border border-stone-200 bg-stone-50 py-16 text-center text-artisan-stone">
                <p className="font-medium">No orders yet.</p>
                <p className="mt-1 text-sm">Orders will appear here when buyers purchase your products.</p>
              </div>
            )}
            {!ordersLoading && orders.length > 0 && (
              <div className="space-y-4">
                {orders.map((o) => {
                  const isFinished = o.status === 'delivered' || o.status === 'completed' || o.status === 'cancelled';
                  const isEnteringOtp = otpInputOrderId === o.id;
                  return (
                    <div key={o.id} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-artisan-bark">Order #{o.id}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[o.status] ?? 'bg-stone-100 text-stone-600'}`}>
                              {o.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-artisan-terracotta">{o.productTitle}</p>
                          <p className="text-xs text-artisan-stone">
                            Qty: {o.quantity} · {fmt(o.totalPrice)} ·{' '}
                            {new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>

                        {/* Action area */}
                        {!isFinished && (
                          <div className="flex flex-col items-end gap-2">
                            {isEnteringOtp ? (
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="4-digit OTP"
                                    value={otpValue}
                                    onChange={(e) => { setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 4)); setOtpError(''); }}
                                    className="w-28 rounded-lg border border-stone-300 px-3 py-1.5 text-center text-sm font-mono tracking-widest text-artisan-bark focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDeliverConfirm(o.id)}
                                    disabled={updatingOrderId === o.id}
                                    className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {updatingOrderId === o.id ? 'Confirming…' : 'Confirm'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setOtpInputOrderId(null); setOtpError(''); }}
                                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-artisan-stone hover:bg-stone-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                {otpError && (
                                  <p className="text-xs text-red-600 font-medium">{otpError}</p>
                                )}
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDeliverClick(o.id)}
                                  disabled={updatingOrderId === o.id}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                  ✓ Mark as Delivered
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancel(o.id)}
                                  disabled={updatingOrderId === o.id}
                                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  {updatingOrderId === o.id ? 'Cancelling…' : '✕ Cancel Order'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 rounded-lg bg-stone-50 px-4 py-3 text-xs text-artisan-stone">
                        <p className="font-medium text-artisan-bark">Buyer details</p>
                        <p className="mt-1">{o.buyerName} · {o.buyerPhone} · {o.buyerEmail}</p>
                        <p>{o.deliveryAddress}, {o.deliveryCity} – {o.deliveryPincode}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
