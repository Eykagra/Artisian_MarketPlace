import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  confirmCheckoutSession,
  createCheckoutSession,
  fetchProducts,
  getRoleFromToken,
  type Product,
} from '../services/api';
import CheckoutModal, { type CheckoutStage } from '../components/CheckoutModal';
import {
  clearCart,
  loadCart,
  removeFromCart,
  updateCartQuantity,
  type CartItem,
} from '../services/cart';

export default function CartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem('token');
  const role = getRoleFromToken(token);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadCart());
  const [productsById, setProductsById] = useState<Record<number, Product | null>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [stockWarnings, setStockWarnings] = useState<Record<number, string>>({});

  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState<CheckoutStage>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitFailure, setSubmitFailure] = useState<string | null>(null);

  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');

  const mapCheckoutError = (status?: number, message?: string) => {
    if (status === 409) {
      return 'This item just went out of stock. Please reduce quantity or remove it from cart.';
    }
    if (status === 400 && message?.toLowerCase().includes('reservation')) {
      return 'Your reservation expired. Please review cart quantities and try again.';
    }
    return message || 'Payment verification failed';
  };

  useEffect(() => {
    if (!token || role !== 'buyer') {
      navigate('/login?redirect=/cart', { replace: true });
      return;
    }
  }, [navigate, token, role]);

  useEffect(() => {
    const refresh = () => setCartItems(loadCart());
    window.addEventListener('cartUpdated', refresh);
    return () => window.removeEventListener('cartUpdated', refresh);
  }, []);

  useEffect(() => {
    if (!cartItems.length) {
      setProductsById({});
      return;
    }

    let cancelled = false;
    setLoadingProducts(true);
    fetchProducts()
      .then((all) => {
        if (cancelled) return;
        const map: Record<number, Product | null> = {};
        for (const item of cartItems) {
          map[item.productId] = all.find((p) => p.id === item.productId) ?? null;
        }
        setProductsById(map);
      })
      .catch(() => {
        if (cancelled) return;
        setProductsById({});
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingProducts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cartItems]);

  useEffect(() => {
    const checkoutState = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    if (checkoutState !== 'success' || !sessionId || !token) return;

    let cancelled = false;
    setShowCheckout(true);
    setCheckoutStage('placing');
    setSubmitError(null);
    setSubmitFailure(null);

    let attempts = 0;
    const maxAttempts = 8;
    const runConfirm = () => {
      confirmCheckoutSession(sessionId, token)
        .then((result) => {
          if (cancelled) return;
          if (result.processing && attempts < maxAttempts) {
            attempts += 1;
            setTimeout(() => {
              if (!cancelled) runConfirm();
            }, 600);
            return;
          }
          clearCart();
          setCheckoutStage('placed');
          setSubmitSuccess('Payment successful. Redirecting to your orders…');
          setTimeout(() => {
            if (!cancelled) {
              closeCheckout();
              navigate('/my-orders', { replace: true });
            }
          }, 1800);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
          const msg =
            axiosErr?.response?.data?.error ||
            (err instanceof Error ? err.message : 'Payment verification failed');
          setCheckoutStage('failed');
          setSubmitFailure(mapCheckoutError(axiosErr?.response?.status, msg));
          setTimeout(() => {
            if (!cancelled) closeCheckout();
          }, 1800);
        });
    };

    runConfirm();

    return () => {
      cancelled = true;
    };
    // Intentionally tied to URL + auth state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token, navigate]);

  const cartLines = useMemo(() => {
    return cartItems.map((item) => ({
      ...item,
      product: productsById[item.productId] ?? null,
    }));
  }, [cartItems, productsById]);

  const cartTotal = useMemo(() => {
    return cartLines.reduce((sum, line) => {
      if (!line.product) return sum;
      const price = typeof line.product.price === 'number' ? line.product.price : Number(line.product.price);
      const maxQty = typeof line.product.stock === 'number' ? line.product.stock : undefined;
      const qty =
        typeof maxQty === 'number'
          ? maxQty > 0
            ? Math.min(maxQty, line.quantity)
            : 0
          : line.quantity;
      return sum + (Number.isFinite(price) ? price * qty : 0);
    }, 0);
  }, [cartLines]);

  const hasOutOfStockItem = useMemo(() => {
    return cartLines.some((line) => typeof line.product?.stock === 'number' && line.product.stock <= 0);
  }, [cartLines]);

  const openCheckout = () => {
    if (!cartItems.length) return;
    for (const item of cartItems) {
      const product = productsById[item.productId];
      const maxQty = typeof product?.stock === 'number' ? product?.stock : undefined;
      if (typeof maxQty === 'number' && maxQty <= 0) {
        setSubmitError('Some items are out of stock. Please remove them from your cart.');
        return;
      }
    }
    setCheckoutStage('idle');
    setSubmitError(null);
    setSubmitSuccess(null);
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    setShowCheckout(false);
    setCheckoutStage('idle');
    setSubmitError(null);
    setSubmitSuccess(null);
    setSubmitFailure(null);
  };

  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitError(null);
    setSubmitFailure(null);
    setCheckoutStage('placing');

    try {
      const items = cartItems
        .map((item) => {
          const product = productsById[item.productId];
          if (!product) return null;
          const maxQty = typeof product.stock === 'number' ? product.stock : undefined;
          if (typeof maxQty === 'number' && maxQty <= 0) return null;
          const qty = typeof maxQty === 'number' ? Math.min(maxQty, item.quantity) : Math.max(1, item.quantity);
          return { productId: item.productId, quantity: qty };
        })
        .filter((x): x is { productId: number; quantity: number } => !!x);

      if (!items.length) {
        throw new Error('No valid items to checkout');
      }

      const session = await createCheckoutSession(
        {
          items,
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
      const status = axiosErr?.response?.status;
      const msg =
        axiosErr?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to place order');

      if (status === 409) {
        // Stock changed between opening checkout and submitting.
        // Show failure animation, then close modal and refresh stock so cart shows "Out of stock".
        setCheckoutStage('failed');
        setSubmitFailure('Order failed: item is out of stock.');

        try {
          const all = await fetchProducts();
          const map: Record<number, Product | null> = {};
          for (const item of cartItems) {
            map[item.productId] = all.find((p) => p.id === item.productId) ?? null;
          }
          setProductsById(map);
        } catch {
          // ignore refresh failures; we still close modal after failure animation
        }

        setTimeout(() => {
          closeCheckout();
        }, 1800);
        return;
      }

      setSubmitError(mapCheckoutError(status, msg));
      setCheckoutStage('idle');
    }
  };

  if (!token || role !== 'buyer') return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white py-8">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-3xl font-bold text-artisan-bark">Cart</h1>
          <p className="mt-1 text-artisan-stone">Add items and choose quantities before checkout.</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {!cartItems.length ? (
          <div className="rounded-xl border border-stone-200 bg-stone-50 py-16 text-center text-artisan-stone">
            <p className="text-4xl">🛒</p>
            <p className="mt-4 font-medium">Your cart is empty.</p>
            <Link to="/" className="mt-3 inline-block text-artisan-terracotta hover:underline">
              Browse products →
            </Link>
          </div>
        ) : (
          <>
            {loadingProducts && <div className="py-4 text-sm text-artisan-stone">Loading cart items…</div>}

            <ul className="space-y-4">
              {cartLines.map((line) => {
                const product = line.product;
                const maxQty = typeof product?.stock === 'number' ? product.stock : undefined;
                const clampedQty =
                  typeof maxQty === 'number'
                    ? maxQty > 0
                      ? Math.min(maxQty, line.quantity)
                      : 0
                    : line.quantity;
                return (
                  <li key={line.productId} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-stone-100 bg-stone-100">
                        {product?.imageUrl ? (
                          <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-stone-300 text-2xl">◇</div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {product ? (
                            <Link
                              to={`/products/${product.id}`}
                              className="font-semibold text-artisan-bark hover:text-artisan-terracotta"
                            >
                              {product.title}
                            </Link>
                          ) : (
                            <span className="font-semibold text-artisan-bark">Unavailable item</span>
                          )}
                          {typeof product?.stock === 'number' && product.stock > 0 && (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                              Stock: {product.stock}
                            </span>
                          )}
                          {typeof product?.stock === 'number' && product.stock <= 0 && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                              Out of stock
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-artisan-stone">Qty</span>
                            {typeof maxQty === 'number' && maxQty <= 0 ? (
                              <span className="text-sm font-medium text-red-700">Out of stock</span>
                            ) : (
                              <div className="inline-flex items-center overflow-hidden rounded-lg border border-stone-300 bg-white">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStockWarnings((prev) => {
                                      const next = { ...prev };
                                      delete next[line.productId];
                                      return next;
                                    });
                                    // Allow going down to 0, which removes the item.
                                    const nextQty = line.quantity - 1;
                                    updateCartQuantity(line.productId, nextQty);
                                  }}
                                  disabled={!product}
                                  className="px-3 py-2 text-sm text-artisan-stone hover:bg-stone-50 disabled:opacity-50"
                                >
                                  -
                                </button>
                                <span className="px-3 py-2 text-sm font-medium text-artisan-bark">
                                  {clampedQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const maxStockQty = typeof maxQty === 'number' ? maxQty : undefined;
                                    const nextQty = line.quantity + 1;

                                    if (typeof maxStockQty === 'number' && nextQty > maxStockQty) {
                                      setStockWarnings((prev) => ({
                                        ...prev,
                                        [line.productId]: `Only ${maxStockQty} in stock.`,
                                      }));
                                      return;
                                    }

                                    setStockWarnings((prev) => {
                                      const next = { ...prev };
                                      delete next[line.productId];
                                      return next;
                                    });

                                    updateCartQuantity(line.productId, Math.max(1, nextQty));
                                  }}
                                  disabled={!product}
                                  className="px-3 py-2 text-sm text-artisan-stone hover:bg-stone-50 disabled:opacity-50"
                                >
                                  +
                                </button>
                              </div>
                            )}

                            {stockWarnings[line.productId] && (
                              <p className="text-xs text-red-600">{stockWarnings[line.productId]}</p>
                            )}
                          </div>

                          <span className="text-sm text-artisan-stone">
                            Line total:{' '}
                            <strong className="text-artisan-bark">
                              ₹
                              {product
                                ? (
                                    (typeof product.price === 'number' ? product.price : Number(product.price)) *
                                    clampedQty
                                  ).toLocaleString('en-IN')
                                : '0'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.productId)}
                          className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-medium text-artisan-stone hover:bg-stone-100 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-sm text-artisan-stone">Total</p>
                <p className="text-2xl font-bold text-artisan-bark">₹{cartTotal.toLocaleString('en-IN')}</p>
                {hasOutOfStockItem && (
                  <p className="mt-1 text-xs font-medium text-red-700">
                    Remove out-of-stock items to continue checkout.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={openCheckout}
                disabled={hasOutOfStockItem}
                className="rounded-lg bg-artisan-terracotta px-5 py-2.5 text-sm font-semibold text-white hover:bg-artisan-terracotta/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Checkout
              </button>
            </div>
          </>
        )}

        <CheckoutModal
          isOpen={showCheckout}
          stage={checkoutStage}
          title="Delivery details"
          description="Provide delivery details so sellers can confirm payment and shipping."
          submitButtonText={`Checkout (₹${cartTotal.toLocaleString('en-IN')})`}
          submitError={submitError}
          submitSuccess={submitSuccess}
          submitFailure={submitFailure}
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
          onSubmit={handleSubmitCheckout}
          onClose={closeCheckout}
        />
      </main>
    </div>
  );
}

