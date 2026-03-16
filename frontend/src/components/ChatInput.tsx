import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Describe what you want to sell…',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && inputRef.current) inputRef.current.focus();
  }, [disabled]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2 border-t border-stone-200 bg-white p-3">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="flex-1 resize-none rounded-xl border border-stone-300 px-4 py-3 text-artisan-bark placeholder:text-artisan-stone/70 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta disabled:bg-stone-100 disabled:opacity-70"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className="self-end rounded-xl bg-artisan-terracotta px-5 py-3 font-medium text-white transition hover:bg-artisan-terracotta/90 disabled:opacity-50 disabled:hover:bg-artisan-terracotta"
      >
        Send
      </button>
    </div>
  );
}
