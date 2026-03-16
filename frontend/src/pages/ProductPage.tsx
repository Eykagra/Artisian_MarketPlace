import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchProduct, type Product } from '../services/api';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            {product.sellerEmail && (
              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-medium text-artisan-stone">Seller</p>
                <p className="mt-1 text-artisan-bark">{product.sellerEmail}</p>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
