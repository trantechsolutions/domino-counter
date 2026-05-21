import { useEffect, useRef } from 'react';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cdlg-title"
      aria-describedby="cdlg-msg"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-[rgba(20,17,15,0.55)]" aria-hidden="true" />

      <div
        className="scale-in relative w-full max-w-sm surface-bone border border-[rgb(var(--rule))] rounded-3xl p-6 shadow-pip-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {variant === 'danger' && (
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--brand-soft))]">
            <svg className="h-6 w-6 text-[rgb(var(--brand))]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        )}

        <h2 id="cdlg-title" className="text-center t-h2 text-[rgb(var(--ink))] mb-2">
          {title}
        </h2>
        <p id="cdlg-msg" className="text-center t-body text-[rgb(var(--ink-muted))] mb-6">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="tap flex-1 rounded-2xl border border-[rgb(var(--rule))] surface-paper px-4 t-body font-semibold text-[rgb(var(--ink))] hover:bg-[rgb(var(--rule-soft))] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="tap flex-1 rounded-2xl fill-brand px-4 t-body font-bold shadow-pip-brand transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
