import type React from 'react';

export type CheckoutStage = 'idle' | 'placing' | 'placed' | 'failed';

interface CheckoutModalProps {
  isOpen: boolean;
  stage: CheckoutStage;
  title?: string;
  description?: string;
  submitButtonText: string;
  submitError?: string | null;
  submitSuccess?: string | null;
  submitFailure?: string | null;
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPincode: string;
  onDeliveryNameChange: (value: string) => void;
  onDeliveryPhoneChange: (value: string) => void;
  onDeliveryAddressChange: (value: string) => void;
  onDeliveryCityChange: (value: string) => void;
  onDeliveryPincodeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitDisabled?: boolean;
  children?: React.ReactNode;
}

export default function CheckoutModal({
  isOpen,
  stage,
  title = 'Delivery details',
  description = 'Provide delivery details so sellers can confirm payment and shipping.',
  submitButtonText,
  submitError,
  submitSuccess,
  submitFailure,
  deliveryName,
  deliveryPhone,
  deliveryAddress,
  deliveryCity,
  deliveryPincode,
  onDeliveryNameChange,
  onDeliveryPhoneChange,
  onDeliveryAddressChange,
  onDeliveryCityChange,
  onDeliveryPincodeChange,
  onSubmit,
  onClose,
  submitDisabled = false,
  children,
}: CheckoutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm transition-all">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {stage === 'placing' && (
          <div className="flex flex-col items-center justify-center gap-4 px-8 py-16">
            <div className="relative h-16 w-16">
              <svg className="absolute inset-0 animate-spin" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke="#e7e5e4" strokeWidth="6" />
                <path d="M32 4 a28 28 0 0 1 28 28" stroke="#c0604a" strokeWidth="6" strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl">🛍️</span>
            </div>
            <p className="text-base font-semibold text-artisan-bark animate-pulse">Placing your order...</p>
            <p className="text-sm text-artisan-stone">Hang tight, this won't take long.</p>
          </div>
        )}

        {stage === 'placed' && (
          <div className="flex flex-col items-center gap-4 px-8 py-14 text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50"
              style={{ animation: 'orderSuccess 0.4s cubic-bezier(.22,1,.36,1) both' }}
            >
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                  className="[stroke-dasharray:30] [stroke-dashoffset:30] animate-[drawCheck_0.5s_0.2s_ease-out_forwards]"
                  style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'drawCheck 0.5s 0.25s ease-out forwards' }}
                />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-artisan-bark">Orders Placed!</p>
              <p className="mt-2 text-sm text-artisan-stone leading-relaxed">
                {submitSuccess || 'Redirecting to your orders...'}
              </p>
            </div>
          </div>
        )}

        {stage === 'failed' && (
          <div className="flex flex-col items-center gap-4 px-8 py-14 text-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 ring-8 ring-red-50"
              style={{ animation: 'orderSuccess 0.4s cubic-bezier(.22,1,.36,1) both' }}
            >
              <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6l12 12M18 6L6 18"
                  className="[stroke-dasharray:40] [stroke-dashoffset:40] animate-[drawCheck_0.45s_0.15s_ease-out_forwards]"
                  style={{ strokeDasharray: 40, strokeDashoffset: 40, animation: 'drawCheck 0.45s 0.15s ease-out forwards' }}
                />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-artisan-bark">Order Failed</p>
              <p className="mt-2 text-sm text-artisan-stone leading-relaxed">
                {submitFailure || 'Could not process your order.'}
              </p>
            </div>
          </div>
        )}

        {stage === 'idle' && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-artisan-bark">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1 text-artisan-stone hover:bg-stone-100 hover:text-artisan-bark transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mb-4 text-sm text-artisan-stone">{description}</p>

            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-artisan-stone">Full name</label>
                <input
                  type="text"
                  value={deliveryName}
                  onChange={(e) => onDeliveryNameChange(e.target.value)}
                  required
                  placeholder="e.g. Priya Sharma"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-artisan-stone">Phone number</label>
                <input
                  type="tel"
                  value={deliveryPhone}
                  onChange={(e) => onDeliveryPhoneChange(e.target.value)}
                  required
                  placeholder="10-digit mobile number"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-artisan-stone">Address (street, area)</label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => onDeliveryAddressChange(e.target.value)}
                  required
                  rows={2}
                  placeholder="House no., street, area / locality"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-artisan-stone">City</label>
                  <input
                    type="text"
                    value={deliveryCity}
                    onChange={(e) => onDeliveryCityChange(e.target.value)}
                    required
                    placeholder="Mumbai"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-artisan-stone">Pincode</label>
                  <input
                    type="text"
                    value={deliveryPincode}
                    onChange={(e) => onDeliveryPincodeChange(e.target.value)}
                    required
                    placeholder="400001"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-artisan-bark placeholder:text-stone-300 focus:border-artisan-terracotta focus:outline-none focus:ring-1 focus:ring-artisan-terracotta"
                  />
                </div>
              </div>

              {children}

              {submitError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitDisabled}
                className="mt-2 w-full rounded-lg bg-artisan-terracotta px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-artisan-terracotta/90 active:scale-95 transition-transform disabled:opacity-60"
              >
                {submitButtonText}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-artisan-stone hover:bg-stone-100"
              >
                Cancel
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

