import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { MedicationUseDraft, UsesEditorProps } from "./types";
import { emptyUseDraft } from "./utils";

/** Editable list of medication uses, each with dosage, frequency and dates. */
export function UsesEditor({
  drafts,
  onChange,
  single = false,
}: UsesEditorProps) {
  function update(index: number, patch: Partial<MedicationUseDraft>) {
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
          Uses
        </span>
        {drafts.length > 1 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {drafts.length} uses
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
              label="Dosage"
              placeholder="e.g., 500 mg"
              value={draft.dosage}
              required
              onChange={(event) =>
                update(index, { dosage: event.target.value })
              }
            />
            <Input
              label="Frequency per day"
              type="number"
              min={1}
              max={32}
              step={1}
              value={draft.frequency_per_day}
              required
              onChange={(event) =>
                update(index, { frequency_per_day: event.target.value })
              }
            />
          </div>
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
                Remove this use
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
          onClick={() => onChange([...drafts, emptyUseDraft()])}
        >
          Add another use
        </Button>
      )}
    </div>
  );
}
