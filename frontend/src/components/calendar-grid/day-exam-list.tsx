import type { DayExamListProps } from "./types";

/** The exams made on one day, listed inside the calendar dialog. */
export function DayExamList({ exams, on_select_exam }: DayExamListProps) {
  return (
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
      {exams.map((exam) => (
        <li key={exam.id}>
          <button
            type="button"
            onClick={() => on_select_exam(exam.id)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 dark:text-gray-200 dark:hover:bg-gray-800/60"
          >
            <span className="min-w-0 truncate">{exam.title}</span>
            <svg
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}