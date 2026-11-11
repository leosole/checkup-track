import { PiPillFill } from "react-icons/pi";
import type {
  BadgeProps,
  BadgeTone,
  CardProps,
  EmptyStateProps,
  SpinnerProps,
} from "./types";

const TONES: Record<BadgeTone, string> = {
  gray: "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
  brand:
    "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30",
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  warning:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  danger:
    "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  info: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
};

export function Badge({
  tone = "gray",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

export function Card({ className = "", children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl bg-white shadow-untitled ring-1 ring-gray-900/5 dark:bg-gray-900 dark:shadow-none dark:ring-white/10 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }: SpinnerProps = {}) {
  return (
    <PiPillFill
      className={`animate-spin text-brand-600 dark:text-brand-400 ${className}`}
      role="status"
      aria-label="Loading"
    ></PiPillFill>
  );
}

export function EmptyState({ title, hint, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-900/40">
      {icon && (
        <div className="mb-3 text-gray-400 dark:text-gray-500">{icon}</div>
      )}
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </p>
      {hint && (
        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}
