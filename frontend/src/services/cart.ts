export type CartItem = {
  productId: number;
  quantity: number;
};

const CART_STORAGE_KEY = 'artisan_marketplace_cart:v1';

function safeParseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items: CartItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as { productId?: unknown; quantity?: unknown };
      const productId = typeof e.productId === 'number' ? e.productId : Number(e.productId);
      const quantity = typeof e.quantity === 'number' ? e.quantity : Number(e.quantity);
      if (!Number.isFinite(productId) || productId <= 0) continue;
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      items.push({ productId: Math.floor(productId), quantity: Math.floor(quantity) });
    }
    return items;
  } catch {
    return [];
  }
}

export function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return safeParseCart(raw);
  } catch {
    // localStorage might be blocked (private mode)
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cartUpdated'));
    }
  } catch {
    // ignore write errors (quota / privacy mode)
  }
}

export function getCartCount(): number {
  return loadCart().reduce((sum, i) => sum + i.quantity, 0);
}

export function addToCart(productId: number, quantity = 1): CartItem[] {
  // Backwards compat for existing call sites (no stock clamp)
  return addToCartWithStock(productId, quantity, undefined);
}

export function addToCartWithStock(
  productId: number,
  quantity = 1,
  options?: { maxStock?: number }
): CartItem[] {
  const qty = Math.max(1, Math.floor(quantity || 1));
  const maxStock =
    typeof options?.maxStock === 'number' && Number.isFinite(options.maxStock) ? Math.floor(options.maxStock) : undefined;

  const items = loadCart();
  const idx = items.findIndex((i) => i.productId === productId);
  if (idx >= 0) {
    const currentQty = items[idx].quantity;
    const nextQtyRaw = currentQty + qty;
    const nextQty = typeof maxStock === 'number' ? Math.min(maxStock, nextQtyRaw) : nextQtyRaw;
    // If maxStock is 0, don't add more.
    items[idx] = { ...items[idx], quantity: Math.max(0, Math.floor(nextQty)) };
  } else {
    if (typeof maxStock === 'number') {
      if (maxStock <= 0) return items;
      items.push({ productId, quantity: Math.min(maxStock, qty) });
    } else {
      items.push({ productId, quantity: qty });
    }
  }
  saveCart(items);
  return items;
}

export function updateCartQuantity(productId: number, quantity: number): CartItem[] {
  const qty = Math.max(0, Math.floor(quantity || 0));
  const items = loadCart();
  const next = items
    .map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    .filter((i) => i.quantity > 0);
  saveCart(next);
  return next;
}

export function removeFromCart(productId: number): CartItem[] {
  const items = loadCart();
  const next = items.filter((i) => i.productId !== productId);
  saveCart(next);
  return next;
}

export function clearCart(): void {
  saveCart([]);
}

