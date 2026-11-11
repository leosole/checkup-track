import { Link } from "@tanstack/react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Logo } from "../logo";
import type { CodeEntryProps } from "./types";

/** Signed-out screen: redeem a one-time share code. */
export function CodeEntry({
  code,
  error,
  submitting,
  on_code_change,
  on_submit,
}: CodeEntryProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-brand-50/40 to-gray-100 px-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-untitled-lg ring-1 ring-gray-900/5 dark:bg-gray-900 dark:shadow-none dark:ring-white/10">
          <div className="flex flex-col items-center text-center">
            <Logo className="h-12 w-12 rounded-2xl shadow-sm" />
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
              View shared records
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Enter the one-time code you received. You will be able to view the
              shared exams and medications, but not change anything.
            </p>
          </div>

          <form className="mt-7 space-y-3" onSubmit={on_submit}>
            <Input
              label="Share code"
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              onChange={(event) => on_code_change(event.target.value)}
            />
            <Button
              type="submit"
              className="w-full"
              loading={submitting}
              disabled={!code.trim()}
            >
              Open shared records
            </Button>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
            Codes are single use. Ask the owner for a new one if this one
            expired.
          </p>
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
            Owner?{" "}
            <Link
              to="/"
              className="font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Sign in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
