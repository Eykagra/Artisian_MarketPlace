import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Called with the recorded audio blob + mime type when the user stops recording */
  onVoiceReady?: (blob: Blob, mimeType: string) => Promise<void>;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Describe what you want to sell…',
  onVoiceReady,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!disabled && !recording && !transcribing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, recording, transcribing]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (onVoiceReady) {
          setTranscribing(true);
          try {
            await onVoiceReady(blob, mimeType);
          } finally {
            setTranscribing(false);
          }
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      alert('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  const handleMicClick = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  const isBusy = disabled || transcribing;

  return (
    <div className="flex gap-2 border-t border-stone-200 bg-white p-3">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={transcribing ? 'Transcribing…' : placeholder}
        disabled={isBusy || recording}
        rows={2}
        className="flex-1 resize-none rounded-xl border border-stone-300 px-4 py-3 text-artisan-bark placeholder:text-artisan-stone/70 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta disabled:bg-stone-100 disabled:opacity-70"
      />

      {/* Mic button — only shown when onVoiceReady is wired up */}
      {onVoiceReady && (
        <button
          type="button"
          onClick={handleMicClick}
          disabled={isBusy}
          title={recording ? 'Stop recording' : 'Record voice'}
          className={`self-end rounded-xl px-4 py-3 transition disabled:opacity-50 ${
            recording
              ? 'animate-pulse bg-red-500 text-white hover:bg-red-600'
              : 'border border-stone-300 bg-white text-artisan-stone hover:bg-stone-50'
          }`}
        >
          {transcribing ? (
            /* spinner */
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : recording ? (
            /* stop square */
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            /* mic icon */
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0014 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="9" y1="22" x2="15" y2="22" />
            </svg>
          )}
        </button>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isBusy || recording || !value.trim()}
        className="self-end rounded-xl bg-artisan-terracotta px-5 py-3 font-medium text-white transition hover:bg-artisan-terracotta/90 disabled:opacity-50 disabled:hover:bg-artisan-terracotta"
      >
        Send
      </button>
    </div>
  );
}
