import { FiArrowDown, FiArrowUp, FiTrash2 } from "react-icons/fi";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { ProviderRowProps } from "./types";

/** One provider in the ordered credential list, with its key controls. */
export function ProviderRow({
  item,
  index,
  total,
  label,
  can_manage,
  busy,
  ordering,
  api_key,
  on_key_change,
  on_save,
  on_remove,
  on_move,
}: ProviderRowProps) {
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {index + 1}
        </span>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {label}
        </h2>
        <Badge tone={item.configured ? "success" : "gray"}>
          {item.configured ? "Configured" : "Not configured"}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label={`Move ${label} earlier`}
            title="Move earlier"
            disabled={!can_manage || ordering || index === 0}
            onClick={() => on_move(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <FiArrowUp aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${label} later`}
            title="Move later"
            disabled={!can_manage || ordering || index === total - 1}
            onClick={() => on_move(1)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <FiArrowDown aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{label} API key</span>
          <input
            type="password"
            autoComplete="new-password"
            value={api_key}
            disabled={!can_manage}
            onChange={(event) => on_key_change(event.target.value)}
            placeholder={
              item.configured
                ? "Enter a new key to replace"
                : "Paste API key"
            }
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-950 dark:text-gray-100 dark:ring-gray-700 dark:placeholder:text-gray-500"
          />
        </label>
        <Button
          size="sm"
          loading={busy}
          disabled={!can_manage || !api_key.trim() || ordering}
          onClick={on_save}
        >
          Save key
        </Button>
        {item.configured && (
          <button
            type="button"
            aria-label={`Remove ${label} key`}
            title="Remove saved key"
            disabled={!can_manage || busy || ordering}
            onClick={on_remove}
            className="flex h-9 w-9 items-center justify-center self-end rounded-lg text-gray-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 sm:self-auto"
          >
            <FiTrash2 aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}
