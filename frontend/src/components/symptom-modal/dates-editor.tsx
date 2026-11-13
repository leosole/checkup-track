import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { DatesEditorProps } from "./types";
import { emptyDraft } from "./utils";

const TEXTAREA =
  "block w-full rounded-lg border-0 px-3.5 py-2.5 text-sm text-gray-900 " +
  "shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600 transition-shadow " +
  "dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700 dark:placeholder:text-gray-500";

/** Editable list of dated occurrences, each with its own observation. */
export function DatesEditor({
  drafts,
  onChange,
  single = false,
}: DatesEditorProps) {
  function update(index: number, patch: Partial<(typeof drafts)[number]>) {
    onChange(
      drafts.map((draft, position) =>
        position === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Dates
        </span>
        {drafts.length > 1 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {drafts.length} occurrences
          </span>
        )}
      </div>

      {drafts.map((draft, index) => (
        <div
          key={index}
          className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Start date"
              type="date"
              value={draft.start_date}
              required
              onChange={(event) =>
                update(index, { start_date: event.target.value })
              }
            />
            <Input
              label="End date (optional)"
              type="date"
              min={draft.start_date}
              value={draft.ongoing ? "" : draft.end_date}
              disabled={draft.ongoing}
              onChange={(event) =>
                update(index, { end_date: event.target.value })
              }
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={draft.ongoing}
              onChange={(event) =>
                update(index, {
                  ongoing: event.target.checked,
                  end_date: event.target.checked ? "" : draft.end_date,
                })
              }
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-900"
            />
            Ongoing — no end date
          </label>
          <div className="space-y-1.5">
            <label
              htmlFor={`symptom-observation-${index}`}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Observation (optional)
            </label>
            <textarea
              id={`symptom-observation-${index}`}
              rows={2}
              maxLength={2000}
              value={draft.observation}
              onChange={(event) =>
                update(index, { observation: event.target.value })
              }
              placeholder="What did you notice?"
              className={TEXTAREA}
            />
          </div>
          {!single && drafts.length > 1 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange(drafts.filter((_, position) => position !== index))
                }
              >
                Remove this date
              </Button>
            </div>
          )}
        </div>
      ))}

      {!single && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...drafts, emptyDraft()])}
        >
          Add another date
        </Button>
      )}
    </div>
  );
}
