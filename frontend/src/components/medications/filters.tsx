import type { MedicationFiltersProps, MedicationStatus } from "./types";

/** Search, status and date controls for the medication list. */
export function MedicationFilters({
  query,
  status,
  start_from,
  start_to,
  on_query_change,
  on_status_change,
  on_start_from_change,
  on_start_to_change,
}: MedicationFiltersProps) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="sm:col-span-2 lg:col-span-2">
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Search
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => on_query_change(event.target.value)}
          placeholder="Medication or dosage"
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Status
        </span>
        <select
          value={status}
          onChange={(event) =>
            on_status_change(event.target.value as MedicationStatus)
          }
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
        >
          <option value="all">All medications</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Started from
        </span>
        <input
          type="date"
          value={start_from}
          max={start_to || undefined}
          onChange={(event) => on_start_from_change(event.target.value)}
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Started to
        </span>
        <input
          type="date"
          value={start_to}
          min={start_from || undefined}
          onChange={(event) => on_start_to_change(event.target.value)}
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
        />
      </label>
    </div>
  );
}
