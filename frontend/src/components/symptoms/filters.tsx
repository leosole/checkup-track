import type { SymptomFiltersProps, SymptomStatus } from "./types";

const FIELD_CLASS =
  "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm " +
  "ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 " +
  "dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700";

/** Search and status controls for the symptom list. */
export function SymptomFilters({
  query,
  status,
  on_query_change,
  on_status_change,
}: SymptomFiltersProps) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Search
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => on_query_change(event.target.value)}
          placeholder="Symptom or observation"
          className={FIELD_CLASS}
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Status
        </span>
        <select
          value={status}
          onChange={(event) =>
            on_status_change(event.target.value as SymptomStatus)
          }
          className={FIELD_CLASS}
        >
          <option value="all">All symptoms</option>
          <option value="ongoing">Ongoing</option>
          <option value="past">Past</option>
        </select>
      </label>
    </div>
  );
}
