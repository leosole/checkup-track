import { Toaster as SonnerToaster } from "sonner";

/**
 * Toasts are rendered by `notify` in `./toast`, so the Toaster only owns the
 * stack position. Colors come from the project's Tailwind tokens on the card.
 */
export function Toaster() {
  return <SonnerToaster position="top-center" offset={16} />;
}
