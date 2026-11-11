import { Card } from "../ui/badge";
import { Button } from "../ui/button";
import { formatTimestamp, guestUrl } from "./share-utils";
import type { CreatedCodeProps } from "./types";

/** Banner showing the one-time code that was just generated. */
export function CreatedCode({
  created,
  copied,
  on_copy,
  on_dismiss,
}: CreatedCodeProps) {
  if (!created.share.code) return null;
  return (
    <Card className="mb-5 border border-brand-200 p-5 dark:border-brand-500/30">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            Share code
          </p>
          <p className="mt-2 break-all font-mono text-2xl font-semibold tracking-[0.15em] text-gray-900 dark:text-white">
            {created.share.code}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Expires {formatTimestamp(created.share.expires_at)} · single use ·
            read-only
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => on_copy(created.share.code ?? "", "code")}
          >
            {copied === "code" ? "Copied" : "Copy code"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => on_copy(guestUrl(), "link")}
          >
            {copied === "link" ? "Copied" : "Copy guest link"}
          </Button>
          <Button size="sm" variant="ghost" onClick={on_dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
      <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
        Send the code, or this link:{" "}
        <span className="font-mono text-xs">{guestUrl()}</span>. The code is
        shown only once and works for a single guest.
      </p>
    </Card>
  );
}
