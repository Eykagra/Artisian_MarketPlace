import { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchProducts, getRoleFromToken, type Product } from '../services/api';
import ProductGrid from '../components/ProductGrid';

const CATEGORY_BUTTON_MAX = 6;

function normalizeCategory(input: string) {
  return String(input || '').trim().toLowerCase();
}

export default function Home() {
  const role = getRoleFromToken(localStorage.getItem('token'));
  if (role === 'seller') return <Navigate to="/dashboard" replace />;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryKey, setCategoryKey] = useState<'All' | 'Others' | string>('All');

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

  const topCategoryFilters = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        count: number;
      }
    >();

    for (const p of products) {
      const key = normalizeCategory(p.category);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key, label: p.category, count: 1 });
      }
    }

    const arr = Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

    const top = arr.slice(0, CATEGORY_BUTTON_MAX);
    const topKeys = new Set(top.map((t) => t.key));
    const hasOthers = arr.length > top.length;
    return { top, topKeys, hasOthers };
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (categoryKey !== 'All') {
      if (categoryKey === 'Others') {
        list = list.filter((p) => {
          const key = normalizeCategory(p.category);
          return !topCategoryFilters.topKeys.has(key);
        });
      } else {
        list = list.filter((p) => normalizeCategory(p.category) === categoryKey);
      }
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
  }, [products, categoryKey, search, topCategoryFilters]);

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
              <button
                onClick={() => setCategoryKey('All')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  categoryKey === 'All'
                    ? 'bg-artisan-terracotta text-white'
                    : 'bg-stone-200 text-artisan-stone hover:bg-stone-300'
                }`}
              >
                All
              </button>

              {topCategoryFilters.top.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setCategoryKey(t.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    categoryKey === t.key
                      ? 'bg-artisan-terracotta text-white'
                      : 'bg-stone-200 text-artisan-stone hover:bg-stone-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}

              {topCategoryFilters.hasOthers && (
                <button
                  onClick={() => setCategoryKey('Others')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    categoryKey === 'Others'
                      ? 'bg-artisan-terracotta text-white'
                      : 'bg-stone-200 text-artisan-stone hover:bg-stone-300'
                  }`}
                >
                  Others
                </button>
              )}
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
