import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchProduct, placeOrder, updateProduct, uploadProductImage,
  getCurrentUserIdFromToken, getRoleFromToken,
  type Product, type UpdateProductPayload,
} from '../services/api';

const CATEGORIES = ['Handcrafted', 'Jewelry', 'Textiles', 'Pottery', 'Woodwork', 'Other'];

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Edit state (seller own listing)
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<UpdateProductPayload | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const pendingImageUrlRef = useRef<string | null>(null);

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

  const openEdit = () => {
    if (!product) return;
    pendingImageUrlRef.current = null;
    setEditError(null);
    setEditForm({
      title: product.title,
      description: product.description,
      price: typeof product.price === 'number' ? product.price : parseFloat(String(product.price)),
      category: product.category,
      imageUrl: product.imageUrl ?? undefined,
    });
    setShowEdit(true);
  };

  const cancelEdit = () => {
    setShowEdit(false);
    setEditForm(null);
    setEditError(null);
    pendingImageUrlRef.current = null;
  };

  const handleEditImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !editForm) return;
    setEditImageUploading(true);
    try {
      const url = await uploadProductImage(file, token);
      pendingImageUrlRef.current = url;
      setEditForm((prev) => (prev ? { ...prev, imageUrl: url } : null));
    } catch {
      setEditError('Failed to upload image');
    } finally {
      setEditImageUploading(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !product || !editForm) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const imageUrl = editForm.imageUrl ?? pendingImageUrlRef.current;
      const updated = await updateProduct(product.id, { ...editForm, imageUrl: imageUrl || null }, token);
      setProduct(updated);
      setShowEdit(false);
      setEditForm(null);
      pendingImageUrlRef.current = null;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (err instanceof Error ? err.message : 'Failed to save');
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const price = typeof product.price === 'number' ? product.price : parseFloat(String(product.price));
  const token = localStorage.getItem('token');
  const role = getRoleFromToken(token);
  const isSeller = role === 'seller';
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
              {isSeller ? (
                isOwnListing ? (
                  /* Own listing: Edit button */
                  <button
                    type="button"
                    onClick={showEdit ? cancelEdit : openEdit}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      showEdit
                        ? 'border-stone-300 text-artisan-stone hover:bg-stone-100'
                        : 'border-artisan-terracotta bg-artisan-terracotta/5 text-artisan-terracotta hover:bg-artisan-terracotta/10'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {showEdit
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      }
                    </svg>
                    {showEdit ? 'Cancel edit' : 'Edit listing'}
                  </button>
                ) : (
                  /* Other seller's listing */
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-artisan-stone">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Seller view — purchase not available
                  </span>
                )
              ) : isOwnListing ? (
                <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-artisan-stone">
                  You are the seller of this item.
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleOpenBuy}
                    className="rounded-lg bg-artisan-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-artisan-terracotta/90"
                  >
                    Buy now
                  </button>
                  {!token && (
                    <Link
                      to={`/login?redirect=/products/${product.id}?buy=1`}
                      className="text-sm font-medium text-artisan-terracotta hover:underline"
                    >
                      Log in to buy
                    </Link>
                  )}
                </>
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
        {/* ── Inline edit panel (seller own listing) ── */}
        {showEdit && isOwnListing && editForm && (
          <div className="mt-8 rounded-2xl border border-artisan-terracotta/30 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-artisan-bark">Edit listing</h2>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-artisan-stone">Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm((p) => p ? { ...p, title: e.target.value } : null)}
                    required
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-artisan-stone">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((p) => p ? { ...p, category: e.target.value } : null)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-artisan-stone">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => p ? { ...p, description: e.target.value } : null)}
                  rows={3}
                  required
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                />
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-artisan-stone">Price (₹)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm((p) => p ? { ...p, price: parseFloat(e.target.value) || 0 } : null)}
                    required
                    className="mt-1 w-32 rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-artisan-stone">
                    Replace image {editImageUploading && <span className="text-artisan-terracotta animate-pulse">(uploading…)</span>}
                  </label>
                  <input
                    type="file" accept="image/*"
                    onChange={handleEditImageChange}
                    disabled={editImageUploading}
                    className="mt-1 block text-sm text-artisan-stone file:mr-2 file:rounded file:border-0 file:bg-artisan-terracotta/10 file:px-3 file:py-1 file:text-artisan-terracotta disabled:opacity-50"
                  />
                  {editForm.imageUrl && (
                    <img src={editForm.imageUrl} alt="Preview" className="mt-2 h-16 w-16 rounded-lg object-cover border border-stone-200" />
                  )}
                </div>
              </div>
              {editError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={editSaving || editImageUploading}
                  className="rounded-lg bg-artisan-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-artisan-terracotta/90 disabled:opacity-50"
                >
                  {editSaving ? 'Saving…' : editImageUploading ? 'Uploading image…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={editSaving || editImageUploading}
                  className="rounded-lg border border-stone-300 px-5 py-2 text-sm font-medium text-artisan-stone hover:bg-stone-100 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

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
