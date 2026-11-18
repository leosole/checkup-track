import { PiPillFill } from "react-icons/pi";
import type { ButtonProps, ButtonSize, ButtonVariant } from "./types";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-xs hover:bg-brand-700 focus-visible:outline-brand-600",
  secondary:
    "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline-gray-400 " +
    "dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-800",
  danger:
    "bg-rose-600 text-white shadow-xs hover:bg-rose-700 focus-visible:outline-rose-600",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-gray-400 " +
    "dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold",
        "transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        SIZES[size],
        VARIANTS[variant],
        className,
      ].join(" ")}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <PiPillFill
          className="h-4 w-4 shrink-0 animate-spin text-current"
          aria-hidden="true"
        />
      )}
      {children ?? null}
    </button>
  );
}
