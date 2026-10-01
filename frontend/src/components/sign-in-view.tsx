import { useEffect, useRef, useState } from "react";
import { use_auth } from "../auth-context";
import { Spinner } from "./ui/badge";

/** Untitled UI-styled "Sign in with Google" screen. */
export function SignInView() {
  const { google_client_id, sign_in_with_credential, loading } = use_auth();
  const button_ref = useRef<HTMLDivElement | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [submitting, set_submitting] = useState(false);

  useEffect(() => {
    if (loading || !google_client_id || !button_ref.current) return;

    const render = () => {
      const google = (
        window as unknown as {
          google?: {
            accounts?: {
              id?: {
                initialize: (opts: Record<string, unknown>) => void;
                renderButton: (
                  el: HTMLElement,
                  opts: Record<string, unknown>,
                ) => void;
              };
            };
          };
        }
      ).google;
      if (!google?.accounts?.id || !button_ref.current) return false;

      google.accounts.id.initialize({
        client_id: google_client_id,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            set_error("Google did not return a credential. Try again.");
            return;
          }
          set_submitting(true);
          set_error(null);
          try {
            await sign_in_with_credential(response.credential);
          } catch (err) {
            set_error(
              err instanceof Error ? err.message : "Sign-in failed on the server.",
            );
          } finally {
            set_submitting(false);
          }
        },
      });

      google.accounts.id.renderButton(button_ref.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "signin_with",
        shape: "rectangular",
      });
      return true;
    };

    if (render()) return;
    // GIS script loads async — poll briefly until available.
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (render() || attempts > 40) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [loading, google_client_id, sign_in_with_credential]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-brand-50/40 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-untitled-lg ring-1 ring-gray-900/5">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12h4l2-6 4 12 2-6h6" />
              </svg>
            </span>
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-gray-900">
              Welcome to Vitals
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Your lab reports, medications, and biomarker trends — one secure
              health dashboard.
            </p>
          </div>

          <div className="mt-7 flex flex-col items-center space-y-4">
            {submitting && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Spinner className="h-4 w-4" />
                Verifying with the server…
              </div>
            )}

            {!google_client_id && !loading ? (
              <div className="w-full rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                <p className="font-semibold">Google sign-in is not configured</p>
                <p className="mt-1">
                  Set <code className="rounded bg-amber-100 px-1">GOOGLE_CLIENT_ID</code>{" "}
                  in the backend environment, then restart.
                </p>
              </div>
            ) : (
              <div ref={button_ref} className="min-h-[44px]" />
            )}

            {error && (
              <p className="w-full rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {error}
              </p>
            )}
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-gray-100 pt-5 text-center">
            {[
              ["PDF", "Parse lab reports"],
              ["Chart", "Track biomarkers"],
              ["Plan", "Manage meds"],
            ].map(([title, sub]) => (
              <div key={title}>
                <p className="text-xs font-semibold text-brand-700">{title}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Protected by Google OAuth 2.0 · API-first for web and mobile clients
        </p>
      </div>
    </div>
  );
}
