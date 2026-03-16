import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchMyProducts,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  type Product,
  type UpdateProductPayload,
} from '../services/api';

const CATEGORIES = ['Handcrafted', 'Jewelry', 'Textiles', 'Pottery', 'Woodwork', 'Other'];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UpdateProductPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  /** Latest uploaded image URL during this edit session; used on save so we don't lose it to stale state */
  const pendingImageUrlRef = useRef<string | null>(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login?redirect=/dashboard', { replace: true });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMyProducts(token)
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load your products');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const startEdit = (p: Product) => {
    pendingImageUrlRef.current = null;
    setEditingId(p.id);
    setEditForm({
      title: p.title,
      description: p.description,
      price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price)),
      category: p.category,
      imageUrl: p.imageUrl ?? undefined,
    });
  };

  const cancelEdit = () => {
    pendingImageUrlRef.current = null;
    setImageUploading(false);
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (!token || !editingId || !editForm) return;
    setSaving(true);
    try {
      const imageUrl = editForm.imageUrl ?? pendingImageUrlRef.current;
      const payload: UpdateProductPayload = {
        ...editForm,
        imageUrl: imageUrl || null,
      };
      const updated = await updateProduct(editingId, payload, token);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      pendingImageUrlRef.current = null;
      setEditingId(null);
      setEditForm(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    setSaving(true);
    try {
      await deleteProduct(id, token);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !editForm) return;
    setImageUploading(true);
    try {
      const url = await uploadProductImage(file, token);
      pendingImageUrlRef.current = url;
      setEditForm((prev) => (prev ? { ...prev, imageUrl: url } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-3xl font-bold text-artisan-bark">Seller Dashboard</h1>
          <p className="mt-2 text-artisan-stone">Manage your listings.</p>
          <Link
            to="/list-product"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-artisan-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-artisan-terracotta/90"
          >
            Create product via chat
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {loading && (
          <div className="py-16 text-center text-artisan-stone">Loading your products…</div>
        )}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 py-4 text-center text-red-700">
            {error}
          </div>
        )}
        {!loading && products.length === 0 && !error && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 py-16 text-center text-artisan-stone">
            <p className="font-medium">You have no products yet.</p>
            <Link
              to="/list-product"
              className="mt-4 inline-block text-artisan-terracotta hover:underline"
            >
              Create one with chat →
            </Link>
          </div>
        )}
        {!loading && products.length > 0 && (
          <ul className="space-y-6">
            {products.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                {editingId === p.id && editForm ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-artisan-stone">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) =>
                            setEditForm((prev) => (prev ? { ...prev, title: e.target.value } : null))
                          }
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-artisan-stone">
                          Category
                        </label>
                        <select
                          value={editForm.category}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev ? { ...prev, category: e.target.value } : null
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-artisan-stone">
                        Description
                      </label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm((prev) =>
                            prev ? { ...prev, description: e.target.value } : null
                          )
                        }
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <label className="block text-sm font-medium text-artisan-stone">
                          Price (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.price}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null
                            )
                          }
                          className="mt-1 w-32 rounded-lg border border-stone-300 px-3 py-2 text-artisan-bark focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-artisan-stone">
                          Image
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="mt-1 block w-full text-sm text-artisan-stone file:mr-2 file:rounded file:border-0 file:bg-artisan-terracotta/10 file:px-3 file:py-1 file:text-artisan-terracotta"
                        />
                        {editForm.imageUrl && (
                          <img
                            src={editForm.imageUrl}
                            alt="Preview"
                            className="mt-2 h-24 w-24 rounded object-cover"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={saving || imageUploading}
                        className="rounded-lg bg-artisan-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-artisan-terracotta/90 disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : imageUploading ? 'Uploading image…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving || imageUploading}
                        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-artisan-stone hover:bg-stone-100 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-artisan-stone/50">
                              <span className="text-2xl">◇</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-medium uppercase tracking-wide text-artisan-terracotta">
                            {p.category}
                          </span>
                          <h2 className="font-semibold text-artisan-bark">{p.title}</h2>
                          <p className="mt-1 line-clamp-2 text-sm text-artisan-stone">
                            {p.description}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-artisan-bark">
                            ₹{(typeof p.price === 'number' ? p.price : parseFloat(String(p.price))).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-artisan-stone hover:bg-stone-100"
                        >
                          Edit
                        </button>
                        {deleteConfirmId === p.id ? (
                          <>
                            <span className="text-sm text-artisan-stone">Delete?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              disabled={saving}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(p.id)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                        <Link
                          to={`/products/${p.id}`}
                          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-artisan-stone hover:bg-stone-100"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
