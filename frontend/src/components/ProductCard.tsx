import { Link, useNavigate } from 'react-router-dom';
import type { Product } from '../services/api';
import { getCurrentUserIdFromToken, getRoleFromToken } from '../services/api';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const price = typeof product.price === 'number' ? product.price : parseFloat(String(product.price));
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const role = getRoleFromToken(token);
  const isSeller = role === 'seller';
  const currentUserId = getCurrentUserIdFromToken(token);
  const isOwnListing = currentUserId != null && currentUserId === product.sellerId;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:border-artisan-terracotta/30 hover:shadow-md">
      <Link to={`/products/${product.id}`} className="block">
        <div className="aspect-square overflow-hidden bg-stone-100">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-artisan-stone/50">
              <span className="text-4xl">◇</span>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/products/${product.id}`} className="flex-1">
          <span className="text-xs font-medium uppercase tracking-wide text-artisan-terracotta">
            {product.category}
          </span>
          <h3 className="mt-1 font-semibold text-artisan-bark line-clamp-2 group-hover:text-artisan-terracotta">
            {product.title}
          </h3>
          <p className="mt-1 text-sm text-artisan-stone line-clamp-2">{product.description}</p>
          <p className="mt-2 text-lg font-semibold text-artisan-bark">
            ₹{price.toLocaleString('en-IN')}
          </p>
          {product.sellerEmail && (
            <p className="mt-1 text-xs text-artisan-stone">by {product.sellerEmail}</p>
          )}
        </Link>
        <div className="mt-3">
          {isSeller ? (
            /* Sellers see no buy button — product page is view-only for them */
            <span className="inline-block rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-artisan-stone">
              {isOwnListing ? 'Your listing' : 'View only'}
            </span>
          ) : (
            <button
              type="button"
              onClick={() =>
                token
                  ? navigate(`/products/${product.id}?buy=1`)
                  : navigate(`/login?redirect=/products/${product.id}?buy=1`)
              }
              className="w-full rounded-lg bg-artisan-terracotta px-3 py-1.5 text-xs font-medium text-white hover:bg-artisan-terracotta/90"
            >
              Buy now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
