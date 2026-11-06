import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, subtitle, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const on_key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", on_key);
    return () => document.removeEventListener("keydown", on_key);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 p-4 backdrop-blur-sm sm:items-center dark:bg-black/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-untitled-lg sm:p-8 dark:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="mt-6 flex shrink-0 justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
