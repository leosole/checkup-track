import type { IconType } from "react-icons";
import { FiAlertCircle, FiBell, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";
import { toast as sonner_toast } from "sonner";

export type ToastKind = "success" | "error" | "info" | "default";

interface ToastStyle {
  Icon: IconType;
  wrapper: string;
  icon_class: string;
}

// Project palette: success uses the brand purple, error rose, info amber,
// plain messages the neutral gray scale.
const TOAST_STYLES: Record<ToastKind, ToastStyle> = {
  success: {
    Icon: FiCheckCircle,
    wrapper:
      "bg-brand-50 text-brand-900 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/30",
    icon_class: "text-brand-600 dark:text-brand-300",
  },
  error: {
    Icon: FiAlertCircle,
    wrapper:
      "bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-500/30",
    icon_class: "text-rose-600 dark:text-rose-300",
  },
  info: {
    Icon: FiInfo,
    wrapper:
      "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30",
    icon_class: "text-amber-600 dark:text-amber-300",
  },
  default: {
    Icon: FiBell,
    wrapper:
      "bg-gray-100 text-gray-900 ring-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700",
    icon_class: "text-gray-500 dark:text-gray-400",
  },
};

function ToastCard({
  kind,
  message,
  on_close,
}: {
  kind: ToastKind;
  message: string;
  on_close: () => void;
}) {
  const { Icon, wrapper, icon_class } = TOAST_STYLES[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`relative flex w-[var(--width)] max-w-[calc(100vw_-_2rem)] items-start gap-2.5 rounded-xl px-4 py-3 pr-10 text-sm font-medium shadow-untitled ring-1 ${wrapper}`}
    >
      <Icon
        aria-hidden="true"
        className={`mt-0.5 h-4 w-4 shrink-0 ${icon_class}`}
      />
      <p className="min-w-0 flex-1 break-words leading-5">{message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        title="Dismiss"
        onClick={on_close}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
      >
        <FiX aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function show(kind: ToastKind, message: string): string | number {
  return sonner_toast.custom(
    (id) => (
      <ToastCard
        kind={kind}
        message={message}
        on_close={() => sonner_toast.dismiss(id)}
      />
    ),
    { duration: kind === "error" ? 6000 : 4000 },
  );
}

export const notify = {
  success: (message: string) => show("success", message),
  error: (message: string) => show("error", message),
  info: (message: string) => show("info", message),
  default: (message: string) => show("default", message),
};
