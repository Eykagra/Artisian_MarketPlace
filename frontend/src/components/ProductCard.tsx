import { Link } from 'react-router-dom';
import type { Product } from '../services/api';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const price = typeof product.price === 'number' ? product.price : parseFloat(String(product.price));

  return (
    <Link
      to={`/products/${product.id}`}
      className="group block overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:border-artisan-terracotta/30 hover:shadow-md"
    >
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
      <div className="p-4">
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
      </div>
    </Link>
  );
}
