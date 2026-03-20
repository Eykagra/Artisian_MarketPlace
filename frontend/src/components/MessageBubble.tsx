import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChatProduct, CreateProductPayload } from '../services/api';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  product?: ChatProduct | null;
  imageUrl?: string | null;
  isLoggedIn?: boolean;
  speech?: string | null;
  onCreateListing?: (product: CreateProductPayload, imageUrl?: string | null) => void;
  onUploadImage?: (file: File) => Promise<string>;
  createLoading?: boolean;
  uploadLoading?: boolean;
}

/** Strip metadata lines from AI messages — rendered as card/speech instead */
function cleanContent(text: string, hasProduct: boolean): string {
  // Strip SPEECH: line (first line, handled by Web Speech API)
  let cleaned = text.replace(/^SPEECH:\s*.+\n?/m, '');

  // Strip leading blank line left after removing SPEECH: line
  cleaned = cleaned.replace(/^\n/, '');

  // Remove the STRUCTURED_PRODUCT: line and everything after it
  const markerIdx = cleaned.indexOf('STRUCTURED_PRODUCT:');
  if (markerIdx !== -1) return cleaned.slice(0, markerIdx).trimEnd();

  // Heuristic: if the backend detected a product via fallback, strip any JSON object
  // that looks like the product listing so it doesn't leak into the visible text.
  if (hasProduct) {
    return cleaned.replace(/\{[\s\S]*?"title"[\s\S]*?"price"[\s\S]*?\}/g, '').trimEnd();
  }

  return cleaned.trimEnd();
}

export default function MessageBubble({
  role,
  content,
  product,
  imageUrl,
  isLoggedIn = false,
  speech,
  onCreateListing,
  onUploadImage,
  createLoading = false,
  uploadLoading = false,
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const handleReplayVoice = () => {
    if (!speech || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speech);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const hasProduct = !isUser && product && Object.keys(product).length > 0;
  const displayText = isUser ? content : cleanContent(content, !!hasProduct);
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
      stock: product!.stock != null ? Number(product!.stock) : 1,
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
        {displayText && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{displayText}</p>
        )}
        {/* Voice replay button — only on assistant messages that have speech */}
        {!isUser && speech && 'speechSynthesis' in window && (
          <button
            type="button"
            onClick={handleReplayVoice}
            title="Replay voice"
            className="mt-1.5 flex items-center gap-1 text-xs text-artisan-stone/60 hover:text-artisan-terracotta transition-colors"
          >
            {speaking ? (
              <>
                <svg className="h-3.5 w-3.5 animate-pulse text-artisan-terracotta" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="4" height="16" rx="1" />
                  <rect x="10" y="7" width="4" height="10" rx="1" />
                  <rect x="16" y="10" width="4" height="4" rx="1" />
                </svg>
                <span>Speaking…</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                </svg>
                <span>Replay</span>
              </>
            )}
          </button>
        )}
        {hasProduct && (
          <div className="mt-3 rounded-xl border border-artisan-terracotta/20 bg-artisan-cream p-4 text-xs">
            <p className="mb-2 text-sm font-semibold text-artisan-bark">Your listing is ready</p>
            <ul className="space-y-1 text-artisan-stone">
              {product!.title != null && (
                <li className="flex gap-2">
                  <span className="w-20 shrink-0 font-medium text-artisan-bark">Title</span>
                  <span>{product!.title}</span>
                </li>
              )}
              {product!.category != null && (
                <li className="flex gap-2">
                  <span className="w-20 shrink-0 font-medium text-artisan-bark">Category</span>
                  <span>{product!.category}</span>
                </li>
              )}
              {product!.price != null && (
                <li className="flex gap-2">
                  <span className="w-20 shrink-0 font-medium text-artisan-bark">Price</span>
                  <span>₹{product!.price}</span>
                </li>
              )}
              {product!.stock != null && (
                <li className="flex gap-2">
                  <span className="w-20 shrink-0 font-medium text-artisan-bark">Stock</span>
                  <span>{product!.stock} unit{product!.stock !== 1 ? 's' : ''} available</span>
                </li>
              )}
              {product!.description != null && (
                <li className="flex gap-2">
                  <span className="w-20 shrink-0 font-medium text-artisan-bark">Description</span>
                  <span className="line-clamp-3">{product!.description}</span>
                </li>
              )}
            </ul>
            {imageUrl && (
              <div className="mt-3 flex items-center gap-2 text-artisan-stone">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Image attached
              </div>
            )}
            {canCreate && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
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
                      {uploadLoading ? 'Uploading…' : imageUrl ? '↺ Change image' : '+ Add image'}
                    </button>
                  </>
                )}
                {onCreateListing && (
                  isLoggedIn ? (
                    <button
                      type="button"
                      disabled={createLoading || uploadLoading}
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
