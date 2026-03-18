import { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchProducts, getRoleFromToken, type Product } from '../services/api';
import ProductGrid from '../components/ProductGrid';

const CATEGORIES = ['All', 'Handcrafted', 'Jewelry', 'Textiles', 'Pottery', 'Woodwork', 'Other'];

export default function Home() {
  const role = getRoleFromToken(localStorage.getItem('token'));
  if (role === 'seller') return <Navigate to="/dashboard" replace />;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load products');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (category !== 'All') {
      list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, category, search]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-3xl font-bold text-artisan-bark">Discover local artisans</h1>
          <p className="mt-2 text-artisan-stone">
            Handcrafted goods from your community.
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-artisan-bark placeholder:text-artisan-stone/70 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
            />
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    category === cat
                      ? 'bg-artisan-terracotta text-white'
                      : 'bg-stone-200 text-artisan-stone hover:bg-stone-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {loading && (
          <div className="py-16 text-center text-artisan-stone">Loading products…</div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 py-4 text-center text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && <ProductGrid products={filtered} />}
      </main>
    </div>
  );
}
