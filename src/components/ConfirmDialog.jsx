import { useEffect, useRef } from 'react';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title
 * @param {string} props.message
 * @param {string} [props.confirmLabel]
 * @param {'danger'|'brand'} [props.variant]
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
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

  const confirmCls =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-500 active:bg-red-700 focus-visible:ring-red-500'
      : 'grad-brand hover:opacity-90 focus-visible:ring-violet-500';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cdlg-title"
      aria-describedby="cdlg-msg"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div
        className="glass scale-in relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        {variant === 'danger' && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        )}

        <h2
          id="cdlg-title"
          className="text-center text-base font-bold text-[rgb(var(--text-base))] mb-1"
        >
          {title}
        </h2>
        <p
          id="cdlg-msg"
          className="text-center text-sm text-[rgb(var(--text-muted))] mb-6 leading-relaxed"
        >
          {message}
        </p>

        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[rgba(var(--border),0.8)] bg-[rgb(var(--surface-raised))] px-4 py-2.5 text-sm font-semibold text-[rgb(var(--text-base))] hover:bg-[rgb(var(--border))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[rgb(var(--brand))] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 transition-all ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
