import { formatOccurrenceRange } from "./utils";
import type { SymptomGroup } from "./types";
import type { SymptomOccurrence } from "../../types";
import { Card } from "../ui/badge";

interface SymptomListProps {
  groups: SymptomGroup[];
  can_edit: boolean;
  can_delete: boolean;
  on_edit: (occurrence: SymptomOccurrence) => void;
  on_delete: (occurrence: SymptomOccurrence) => void;
}

/** Grouped symptom list: each title with its occurrences underneath. */
export function SymptomList({
  groups,
  can_edit,
  can_delete,
  on_edit,
  on_delete,
}: SymptomListProps) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {group.title}
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {group.occurrences.length} occurrence
              {group.occurrences.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {group.occurrences.map((occurrence) => (
              <li
                key={occurrence.id}
                className="flex flex-wrap items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatOccurrenceRange(occurrence)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-xs text-gray-500 dark:text-gray-400">
                    {occurrence.observation || "No observation."}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${group.title} occurrence`}
                    title="Edit occurrence"
                    disabled={!can_edit}
                    onClick={() => on_edit(occurrence)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M2.695 14.763l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${group.title} occurrence`}
                    title="Delete occurrence"
                    disabled={!can_delete}
                    onClick={() => on_delete(occurrence)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 006 3.75V4H3.75a.75.75 0 000 1.5h.616l.74 10.5A2.75 2.75 0 007.846 18.5h4.308a2.75 2.75 0 002.744-2.5l.74-10.5h.616a.75.75 0 000-1.5H14v-.25A2.75 2.75 0 0011.25 1h-2.5zM7.5 4v.25c0 .69.56 1.25 1.25 1.25h2.5c.69 0 1.25-.56 1.25-1.25V4h-5zm1.5 4.5a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0v-5zm3.75-.75a.75.75 0 000 1.5v5a.75.75 0 001.5 0v-5a.75.75 0 00-1.5 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
