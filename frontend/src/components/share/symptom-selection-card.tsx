import { Card } from "../ui/badge";
import { formatDate } from "../../date-utils";
import { CHECKBOX_CLASS, plural } from "./share-utils";
import type { SymptomSelectionCardProps } from "./types";

function occurrence_label(start_date: string, end_date: string | null): string {
  if (end_date === null) return `${formatDate(start_date)} — ongoing`;
  if (end_date === start_date) return formatDate(start_date);
  return `${formatDate(start_date)} — ${formatDate(end_date)}`;
}

/**
 * Nested symptom picker: the symptom selects all its occurrences, while each
 * occurrence can also be checked on its own (the parent then shows a dash).
 */
export function SymptomSelectionCard({
  symptoms,
  selected,
  on_toggle,
  on_toggle_group,
}: SymptomSelectionCardProps) {
  const total_occurrences = symptoms.reduce(
    (sum, symptom) => sum + symptom.occurrences.length,
    0,
  );
  const all_selected =
    total_occurrences > 0 &&
    symptoms.every((symptom) =>
      symptom.occurrences.every((occurrence) => selected.has(occurrence.id)),
    );

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Symptoms
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {selected.size} of {plural(total_occurrences, "occurrence")} selected
          </p>
        </div>
        {symptoms.length > 0 && (
          <button
            type="button"
            onClick={() =>
              on_toggle_group(
                symptoms.flatMap((symptom) =>
                  symptom.occurrences.map((occurrence) => occurrence.id),
                ),
                all_selected,
              )
            }
            className="text-xs font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
          >
            {all_selected ? "Clear" : "Select all"}
          </button>
        )}
      </div>

      {symptoms.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          No symptoms to share yet.
        </p>
      ) : (
        <ul className="mt-3 max-h-72 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
          {symptoms.map((symptom) => {
            const occurrence_ids = symptom.occurrences.map(
              (occurrence) => occurrence.id,
            );
            const selected_count = occurrence_ids.filter((id) =>
              selected.has(id),
            ).length;
            const group_all =
              occurrence_ids.length > 0 &&
              selected_count === occurrence_ids.length;
            const group_some = selected_count > 0 && !group_all;
            return (
              <li key={symptom.id} className="py-2.5">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    checked={group_all}
                    ref={(element) => {
                      if (element) element.indeterminate = group_some;
                    }}
                    onChange={() =>
                      on_toggle_group(occurrence_ids, group_all)
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                      {symptom.title}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {selected_count} of{" "}
                      {plural(occurrence_ids.length, "occurrence")} selected
                    </span>
                  </span>
                </label>

                <ul className="ml-7 mt-1.5 space-y-1">
                  {symptom.occurrences.map((occurrence) => (
                    <li key={occurrence.id}>
                      <label className="flex cursor-pointer items-start gap-2.5 py-1">
                        <input
                          type="checkbox"
                          className={CHECKBOX_CLASS}
                          checked={selected.has(occurrence.id)}
                          onChange={() => on_toggle(occurrence.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            {occurrence_label(
                              occurrence.start_date,
                              occurrence.end_date,
                            )}
                          </span>
                          {occurrence.observation && (
                            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                              {occurrence.observation}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
