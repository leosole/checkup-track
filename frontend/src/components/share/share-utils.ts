export const EXPIRY_OPTIONS = [1, 3, 7, 30];

export const STATUS_TONES = {
  active: "success",
  used: "info",
  expired: "gray",
  revoked: "danger",
} as const;

export const SELECT_CLASS =
  "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset " +
  "ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700";

export const CHECKBOX_CLASS =
  "h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-600 " +
  "dark:border-gray-600 dark:bg-gray-800";

export function guestUrl(): string {
  if (typeof window === "undefined") return "/guest";
  return `${window.location.origin}/guest`;
}

export function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
