import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
}

const BASE =
  "block w-full rounded-lg border-0 px-3.5 py-2.5 text-sm text-gray-900 " +
  "shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 " +
  "focus:ring-2 focus:ring-inset focus:ring-brand-600 transition-shadow " +
  "disabled:bg-gray-50 disabled:text-gray-500 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700 " +
  "dark:placeholder:text-gray-500 dark:disabled:bg-gray-800";

export function Input({
  label,
  error,
  className = "",
  id,
  ...rest
}: InputProps): ReactNode {
  const input_id =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={input_id}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>
      )}
      <input
        id={input_id}
        className={`${BASE} ${error ? "ring-rose-400 focus:ring-rose-500" : ""} ${className}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
