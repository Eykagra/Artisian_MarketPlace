import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { fetchProduct, placeOrder, getCurrentUserIdFromToken, type Product } from '../services/api';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBuy, setShowBuy] = useState(false);
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  /** 'idle' | 'placing' | 'placed' */
  const [orderStage, setOrderStage] = useState<'idle' | 'placing' | 'placed'>('idle');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProduct(id)
      .then((data) => {
        if (!cancelled) setProduct(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load product');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (searchParams.get('buy') === '1') {
      setShowBuy(true);
      // Remove ?buy=1 from the URL immediately so closing and re-visiting don't reopen the modal
      navigate({ search: '' }, { replace: true });
    }
    // Run only when searchParams changes (not showBuy), so closing the modal doesn't retrigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-artisan-stone">
        Loading…
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-red-600">{error || 'Product not found.'}</p>
      </div>
    );
  }

  const price = typeof product.price === 'number' ? product.price : parseFloat(String(product.price));
  const token = localStorage.getItem('token');
  const currentUserId = getCurrentUserIdFromToken(token);
  const isOwnListing = currentUserId != null && currentUserId === product.sellerId;

  const handleOpenBuy = () => {
    if (!token) {
      navigate(`/login?redirect=/products/${product.id}?buy=1`);
      return;
    }
    if (isOwnListing) return;
    setOrderStage('idle');
    setSubmitError(null);
    setShowBuy(true);
  };

  const closeModal = () => {
    setShowBuy(false);
    setOrderStage('idle');
    setSubmitError(null);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !token || isOwnListing) return;
    setSubmitError(null);
    setOrderStage('placing');
    try {
      await placeOrder(
        product.id,
        {
          buyerName: deliveryName,
          buyerPhone: deliveryPhone,
          deliveryAddress,
          deliveryCity,
          deliveryPincode,
        },
        token
      );
      setOrderStage('placed');
      setSubmitSuccess('Order placed! The seller will contact you soon to confirm delivery.');
      setDeliveryName('');
      setDeliveryPhone('');
      setDeliveryAddress('');
      setDeliveryCity('');
      setDeliveryPincode('');
      // Stay on success screen for 2.8 s then close
      setTimeout(() => {
        setShowBuy(false);
        setOrderStage('idle');
      }, 2800);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to place order');
      setSubmitError(msg);
      setOrderStage('idle');
    }
  };

  return (
    <div className="min-h-screen">
      <article className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-artisan-stone/50">
                <span className="text-6xl">◇</span>
              </div>
            )}
          </div>
          <div>
            <span className="text-sm font-medium uppercase tracking-wide text-artisan-terracotta">
              {product.category}
            </span>
            <h1 className="mt-2 text-3xl font-bold text-artisan-bark">{product.title}</h1>
            <p className="mt-4 text-artisan-stone">{product.description}</p>
            <p className="mt-6 text-2xl font-semibold text-artisan-bark">
              ₹{price.toLocaleString('en-IN')}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {isOwnListing ? (
                <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-artisan-stone">
                  You are the seller of this item.
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenBuy}
                  className="rounded-lg bg-artisan-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-artisan-terracotta/90"
                >
                  Buy now
                </button>
              )}
              {!token && (
                <Link
                  to={`/login?redirect=/products/${product.id}?buy=1`}
                  className="text-sm font-medium text-artisan-terracotta hover:underline"
                >
                  Log in to buy
                </Link>
              )}
            </div>
            {product.sellerEmail && (
              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-medium text-artisan-stone">Seller</p>
                <p className="mt-1 text-artisan-bark">{product.sellerEmail}</p>
              </div>
            )}
            {submitSuccess && (
              <p className="mt-4 text-sm font-medium text-artisan-sage">{submitSuccess}</p>
            )}
          </div>
        </div>
        {showBuy && !isOwnListing && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm transition-all">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">

              {/* ── Placing stage: full-modal spinner ── */}
              {orderStage === 'placing' && (
                <div className="flex flex-col items-center justify-center gap-4 px-8 py-16">
                  <div className="relative h-16 w-16">
                    <svg className="absolute inset-0 animate-spin" viewBox="0 0 64 64" fill="none">
                      <circle cx="32" cy="32" r="28" stroke="#e7e5e4" strokeWidth="6" />
                      <path d="M32 4 a28 28 0 0 1 28 28" stroke="#c0604a" strokeWidth="6" strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-2xl">🛍️</span>
                  </div>
                  <p className="text-base font-semibold text-artisan-bark animate-pulse">Placing your order…</p>
                  <p className="text-sm text-artisan-stone">Hang tight, this won't take long.</p>
                </div>
              )}

              {/* ── Success stage: checkmark + confirmation ── */}
              {orderStage === 'placed' && (
                <div className="flex flex-col items-center gap-4 px-8 py-14 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50 animate-[scale-in_0.35s_cubic-bezier(.22,1,.36,1)_both]"
                       style={{ animation: 'orderSuccess 0.4s cubic-bezier(.22,1,.36,1) both' }}>
                    <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                        className="[stroke-dasharray:30] [stroke-dashoffset:30] animate-[drawCheck_0.5s_0.2s_ease-out_forwards]"
                        style={{ strokeDasharray: 30, strokeDashoffset: 30,
                                 animation: 'drawCheck 0.5s 0.25s ease-out forwards' }} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-artisan-bark">Order Placed!</p>
                    <p className="mt-2 text-sm text-artisan-stone leading-relaxed">
                      The seller will contact you soon to confirm delivery and payment.
                    </p>
                  </div>
                  <div className="mt-1 rounded-xl bg-stone-50 border border-stone-200 px-6 py-3 text-sm text-artisan-stone">
                    <span className="font-medium text-artisan-bark">{product.title}</span>
                    {' · '}₹{price.toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-artisan-stone/70 mt-1">This window will close automatically…</p>
                </div>
              )}

              {/* ── Form stage ── */}
              {orderStage === 'idle' && (
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-artisan-bark">Delivery details</h2>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full p-1 text-artisan-stone hover:bg-stone-100 hover:text-artisan-bark transition"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="mb-4 text-sm text-artisan-stone">
                    Share your delivery details so the seller can arrange payment and shipping for{' '}
                    <span className="font-medium text-artisan-bark">{product.title}</span>.
                  </p>
                  <form onSubmit={handleSubmitOrder} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-artisan-stone">Full name</label>
                      <input
                        type="text"
                        value={deliveryName}
                        onChange={(e) => setDeliveryName(e.target.value)}
                        required
                        placeholder="e.g. Priya Sharma"
                        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-artisan-stone">Phone number</label>
                      <input
                        type="tel"
                        value={deliveryPhone}
                        onChange={(e) => setDeliveryPhone(e.target.value)}
                        required
                        placeholder="10-digit mobile number"
                        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-artisan-stone">Address (street, area)</label>
                      <textarea
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        required
                        rows={2}
                        placeholder="House no., street, area / locality"
                        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                      />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-artisan-stone">City</label>
                        <input
                          type="text"
                          value={deliveryCity}
                          onChange={(e) => setDeliveryCity(e.target.value)}
                          required
                          placeholder="Mumbai"
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                        />
                      </div>
                      <div className="w-28">
                        <label className="block text-xs font-medium text-artisan-stone">Pincode</label>
                        <input
                          type="text"
                          value={deliveryPincode}
                          onChange={(e) => setDeliveryPincode(e.target.value)}
                          required
                          placeholder="400001"
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                        />
                      </div>
                    </div>
                    {submitError && (
                      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</p>
                    )}
                    <button
                      type="submit"
                      className="mt-2 w-full rounded-lg bg-artisan-terracotta px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-artisan-terracotta/90 active:scale-95 transition-transform"
                    >
                      Place order for ₹{price.toLocaleString('en-IN')}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
