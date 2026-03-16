import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChatProduct, CreateProductPayload } from '../services/api';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  product?: ChatProduct | null;
  imageUrl?: string | null;
  isLoggedIn?: boolean;
  onCreateListing?: (product: CreateProductPayload, imageUrl?: string | null) => void;
  onUploadImage?: (file: File) => Promise<string>;
  createLoading?: boolean;
  uploadLoading?: boolean;
}

export default function MessageBubble({
  role,
  content,
  product,
  imageUrl,
  isLoggedIn = false,
  onCreateListing,
  onUploadImage,
  createLoading = false,
  uploadLoading = false,
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hasProduct = !isUser && product && Object.keys(product).length > 0;
  const canCreate =
    hasProduct &&
    product!.title &&
    product!.description != null &&
    product!.price != null &&
    product!.category;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadImage) return;
    setUploadError(null);
    try {
      await onUploadImage(file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  const handleCreate = () => {
    if (!canCreate || !onCreateListing) return;
    const payload: CreateProductPayload = {
      title: product!.title!,
      description: String(product!.description ?? ''),
      price: Number(product!.price),
      category: String(product!.category ?? ''),
      imageUrl: imageUrl ?? undefined,
    };
    onCreateListing(payload, imageUrl ?? undefined);
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-artisan-terracotta text-white'
            : 'bg-white border border-stone-200 text-artisan-bark shadow-sm'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        {hasProduct && (
          <div className="mt-3 rounded-lg bg-artisan-cream p-3 text-xs">
            <p className="font-medium text-artisan-stone">Suggested listing</p>
            <ul className="mt-1 space-y-0.5 text-artisan-bark">
              {product!.title != null && <li><strong>Title:</strong> {product!.title}</li>}
              {product!.description != null && <li><strong>Description:</strong> {product!.description}</li>}
              {product!.price != null && <li><strong>Price:</strong> ₹{product!.price}</li>}
              {product!.category != null && <li><strong>Category:</strong> {product!.category}</li>}
            </ul>
            {imageUrl && (
              <p className="mt-2 text-artisan-stone">Image: attached</p>
            )}
            {canCreate && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {onUploadImage && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <button
                      type="button"
                      disabled={uploadLoading || createLoading}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-artisan-bark hover:bg-stone-50 disabled:opacity-50"
                    >
                      {uploadLoading ? 'Uploading…' : 'Add image'}
                    </button>
                  </>
                )}
                {onCreateListing && (
                  isLoggedIn ? (
                    <button
                      type="button"
                      disabled={createLoading}
                      onClick={handleCreate}
                      className="rounded-lg bg-artisan-terracotta px-3 py-1.5 text-xs font-medium text-white hover:bg-artisan-terracotta/90 disabled:opacity-50"
                    >
                      {createLoading ? 'Creating…' : 'Create listing'}
                    </button>
                  ) : (
                    <Link
                      to="/login?redirect=/list-product"
                      className="inline-block rounded-lg bg-artisan-terracotta px-3 py-1.5 text-xs font-medium text-white hover:bg-artisan-terracotta/90"
                    >
                      Log in to create listing
                    </Link>
                  )
                )}
                {uploadError && <span className="text-red-600 text-xs">{uploadError}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
