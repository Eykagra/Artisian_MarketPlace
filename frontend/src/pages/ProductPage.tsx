import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchProduct, createCheckoutSession, updateProduct, uploadProductImage,
  getCurrentUserIdFromToken, getRoleFromToken,
  type Product, type UpdateProductPayload,
} from '../services/api';
import { addToCartWithStock } from '../services/cart';
import CheckoutModal from '../components/CheckoutModal';

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
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** 'idle' | 'placing' | 'placed' | 'failed' */
  const [orderStage, setOrderStage] = useState<'idle' | 'placing' | 'placed' | 'failed'>('idle');
  const [addingToCart, setAddingToCart] = useState(false);

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
      const stock = typeof product?.stock === 'number' ? product.stock : undefined;
      if (!(typeof stock === 'number' && stock <= 0)) {
        setShowBuy(true);
      }
      // Remove ?buy=1 from the URL immediately so closing and re-visiting don't reopen the modal
      navigate({ search: '' }, { replace: true });
    }
  }, [searchParams, product, navigate]);

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
      stock: typeof product.stock === 'number' ? product.stock : 1,
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
  const isOutOfStock = typeof product.stock === 'number' && product.stock <= 0;

  const handleOpenBuy = () => {
    if (!token) {
      navigate(`/login?redirect=/products/${product.id}?buy=1`);
      return;
    }
    if (isOwnListing) return;
    if (isOutOfStock) return;
    setOrderStage('idle');
    setOrderQuantity(1);
    setSubmitError(null);
    setShowBuy(true);
  };

  const closeModal = () => {
    setShowBuy(false);
    setOrderStage('idle');
    setOrderQuantity(1);
    setSubmitError(null);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !token || isOwnListing) return;
    setSubmitError(null);
    setOrderStage('placing');
    try {
      const session = await createCheckoutSession(
        {
          items: [{ productId: product.id, quantity: orderQuantity }],
          buyerName: deliveryName,
          buyerPhone: deliveryPhone,
          deliveryAddress,
          deliveryCity,
          deliveryPincode,
        },
        token
      );
      if (!session.url) throw new Error('Stripe checkout URL missing');
      window.location.assign(session.url);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      const msg =
        axiosErr?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to start checkout');
      if (axiosErr?.response?.status === 409) {
        setSubmitError('This item just went out of stock. Please reduce quantity or remove it from cart.');
      } else if (axiosErr?.response?.status === 400 && msg.toLowerCase().includes('reservation')) {
        setSubmitError('Your reservation expired. Please try again.');
      } else {
        setSubmitError(msg);
      }
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
            <p className="mt-1 text-sm text-artisan-stone">
              Stock left:{' '}
              <span className="font-medium text-artisan-bark">
                {typeof product.stock === 'number' ? product.stock : 0}
              </span>
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
                isOutOfStock ? (
                  <span className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-600">
                    Out of stock
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
                    <button
                      type="button"
                      onClick={() => {
                        if (!token) {
                          navigate(`/login?redirect=/cart`);
                          return;
                        }
                        setAddingToCart(true);
                        addToCartWithStock(product.id, 1, {
                          maxStock: typeof product.stock === 'number' ? product.stock : undefined,
                        });
                        const destination = '/cart';
                        setTimeout(() => {
                          navigate(destination);
                        }, 250);
                      }}
                      className="rounded-lg border border-artisan-terracotta/60 px-4 py-2 text-sm font-medium text-artisan-terracotta hover:bg-artisan-terracotta/10"
                      disabled={addingToCart}
                    >
                      {addingToCart ? 'Added ✓' : 'Add to cart'}
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
                )
              )}
            </div>
            {product.sellerEmail && (
              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-medium text-artisan-stone">Seller</p>
                <p className="mt-1 text-artisan-bark">{product.sellerEmail}</p>
              </div>
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
                  <label className="block text-sm font-medium text-artisan-stone">Stock</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={typeof editForm.stock === 'number' ? editForm.stock : 1}
                    onChange={(e) =>
                      setEditForm((p) =>
                        p ? { ...p, stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : null
                      )
                    }
                    required
                    className="mt-1 w-24 rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
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

        <CheckoutModal
          isOpen={showBuy && !isOwnListing}
          stage={orderStage}
          title="Delivery details"
          description={`Share your delivery details so the seller can arrange payment and shipping for ${product.title}.`}
          submitButtonText={`Proceed to payment (Qty ${orderQuantity}) · ₹${(price * orderQuantity).toLocaleString('en-IN')}`}
          submitError={submitError}
          deliveryName={deliveryName}
          deliveryPhone={deliveryPhone}
          deliveryAddress={deliveryAddress}
          deliveryCity={deliveryCity}
          deliveryPincode={deliveryPincode}
          onDeliveryNameChange={setDeliveryName}
          onDeliveryPhoneChange={setDeliveryPhone}
          onDeliveryAddressChange={setDeliveryAddress}
          onDeliveryCityChange={setDeliveryCity}
          onDeliveryPincodeChange={setDeliveryPincode}
          onSubmit={handleSubmitOrder}
          onClose={closeModal}
        >
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-artisan-stone">Quantity</label>
              <input
                type="number"
                min={1}
                step={1}
                value={orderQuantity}
                onChange={(e) => {
                  const next = Math.max(1, Math.floor(Number(e.target.value) || 1));
                  if (typeof product.stock === 'number' && product.stock > 0) {
                    setOrderQuantity(Math.min(product.stock, next));
                  } else {
                    setOrderQuantity(next);
                  }
                }}
                max={typeof product.stock === 'number' ? product.stock : undefined}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
              />
              {typeof product.stock === 'number' && (
                <p className="mt-1 text-xs text-artisan-stone/70">Max available: {product.stock}</p>
              )}
            </div>
          </div>
        </CheckoutModal>
      </article>
    </div>
  );
}
