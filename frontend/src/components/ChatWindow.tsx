import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  sendChatMessage,
  createProduct,
  uploadProductImage,
  transcribeAudio,
  type ChatProduct,
  type CreateProductPayload,
} from '../services/api';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  product?: ChatProduct | null;
  speech?: string | null;
}

const CHAT_DRAFT_STORAGE_KEY = 'list-product-chat-draft:v1';

interface ChatWindowProps {
  token?: string;
}

/** Speak text via the Web Speech API; cancels any in-progress speech first */
function speakText(text: string) {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'hi-IN';
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export default function ChatWindow({ token }: ChatWindowProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [imageUrlByMessageId, setImageUrlByMessageId] = useState<Record<string, string>>({});
  const [createLoadingMessageId, setCreateLoadingMessageId] = useState<string | null>(null);
  const [uploadLoadingMessageId, setUploadLoadingMessageId] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(CHAT_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHAT_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        messages?: ChatMessage[];
        imageUrlByMessageId?: Record<string, string>;
      };
      if (Array.isArray(parsed.messages) && parsed.messages.length) {
        setMessages(parsed.messages);
      }
      if (parsed.imageUrlByMessageId && typeof parsed.imageUrlByMessageId === 'object') {
        setImageUrlByMessageId(parsed.imageUrlByMessageId);
      }
    } catch {
      // ignore corrupted drafts
    }
    // load once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const payload = JSON.stringify({ messages, imageUrlByMessageId });
      sessionStorage.setItem(CHAT_DRAFT_STORAGE_KEY, payload);
    } catch {
      // ignore storage errors (quota / privacy mode)
    }
  }, [messages, imageUrlByMessageId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string) => {
    setError(null);
    setCreateSuccess(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await sendChatMessage(content, token, history);
      if (res.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: res.error || 'Something went wrong',
          },
        ]);
        return;
      }
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.ai.text,
        product: res.ai.product ?? undefined,
        speech: res.ai.speech ?? null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (speechEnabled && res.ai.speech) speakText(res.ai.speech);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I couldn’t reach the server. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async (messageId: string, file: File): Promise<string> => {
    if (!token) throw new Error('Log in to upload images');
    setUploadLoadingMessageId(messageId);
    try {
      const url = await uploadProductImage(file, token);
      setImageUrlByMessageId((prev) => ({ ...prev, [messageId]: url }));
      return url;
    } finally {
      setUploadLoadingMessageId(null);
    }
  };

  const handleCreateListing = async (
    _messageId: string,
    product: CreateProductPayload,
    imageUrl?: string | null
  ) => {
    if (!token) return;
    setCreateLoadingMessageId(_messageId);
    setError(null);
    try {
      const newProduct = await createProduct(
        { ...product, imageUrl: imageUrl ?? product.imageUrl ?? null },
        token
      );
      setCreateSuccess(`Listing created!`);
      clearDraft();
      setTimeout(() => navigate(`/products/${newProduct.id}`), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create listing';
      setError(message);
    } finally {
      setCreateLoadingMessageId(null);
    }
  };

  const handleVoiceReady = async (blob: Blob, mimeType: string) => {
    setError(null);
    try {
      const text = await transcribeAudio(blob, mimeType);
      if (text) await handleSend(text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    }
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-stone-200 bg-artisan-cream shadow-sm">
      {/* Header bar with mute toggle */}
      {'speechSynthesis' in window && (
        <div className="flex items-center justify-end border-b border-stone-200 bg-white px-4 py-2">
          <button
            type="button"
            onClick={() => {
              if (speechEnabled) window.speechSynthesis.cancel();
              setSpeechEnabled((v) => !v);
            }}
            title={speechEnabled ? 'Mute voice responses' : 'Unmute voice responses'}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-artisan-stone hover:bg-stone-100"
          >
            {speechEnabled ? (
              <>
                {/* speaker on */}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 010 14.14" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                </svg>
                Voice on
              </>
            ) : (
              <>
                {/* speaker off */}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
                Voice off
              </>
            )}
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 py-8 text-center text-artisan-stone">
            <p className="font-medium">List your product with AI</p>
            <p className="mt-1 text-sm">
              Tell me what you want to sell (e.g. “I want to sell handmade wooden bowls”) and I’ll ask a few questions to build your listing.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            product={m.product}
            speech={m.speech}
            imageUrl={m.role === 'assistant' ? imageUrlByMessageId[m.id] : undefined}
            isLoggedIn={!!token}
            onCreateListing={
              m.role === 'assistant' && m.product
                ? (product, imageUrl) => handleCreateListing(m.id, product, imageUrl)
                : undefined
            }
            onUploadImage={
              token && m.role === 'assistant'
                ? (file) => handleUploadImage(m.id, file)
                : undefined
            }
            createLoading={createLoadingMessageId === m.id}
            uploadLoading={uploadLoadingMessageId === m.id}
          />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-artisan-stone">
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
        {createSuccess && (
          <p className="text-center text-sm font-medium text-artisan-sage">{createSuccess}</p>
        )}
        <div ref={bottomRef} />
      </div>
      {error && (
        <p className="px-4 text-sm text-red-600">{error}</p>
      )}
      <ChatInput onSend={handleSend} disabled={loading} onVoiceReady={handleVoiceReady} />
    </div>
  );
}
