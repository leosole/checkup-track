import type { ExamFiltersProps, ExamSort, ExamStatus } from "./types";

/** Search, range and sort controls for the exam list. */
export function ExamFilters({
  query,
  status,
  start_date,
  end_date,
  sort,
  on_query_change,
  on_status_change,
  on_start_date_change,
  on_end_date_change,
  on_sort_change,
}: ExamFiltersProps) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="sm:col-span-2 lg:col-span-2">
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Search
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => on_query_change(event.target.value)}
          placeholder="Exam or biomarker"
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Results
        </span>
        <select
          value={status}
          onChange={(event) =>
            on_status_change(event.target.value as ExamStatus)
          }
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
        >
          <option value="all">Any range</option>
          <option value="abnormal">Out of range</option>
          <option value="normal">All in range</option>
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          From
        </span>
        <input
          type="date"
          value={start_date}
          max={end_date || undefined}
          onChange={(event) => on_start_date_change(event.target.value)}
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          To
        </span>
        <input
          type="date"
          value={end_date}
          min={start_date || undefined}
          onChange={(event) => on_end_date_change(event.target.value)}
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
          Sort by
        </span>
        <select
          value={sort}
          onChange={(event) => on_sort_change(event.target.value as ExamSort)}
          className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title-asc">Name A to Z</option>
          <option value="title-desc">Name Z to A</option>
        </select>
      </label>
    </div>
  );
}
