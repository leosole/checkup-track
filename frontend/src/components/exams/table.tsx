import { formatDate } from "../../date-utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { ExamTableProps } from "./types";

/** Exam rows with extraction status and per-row actions. */
export function ExamTable({
  exams,
  can_delete,
  can_retry,
  retrying_exam_id,
  retry_error,
  deleting_id,
  on_select_exam,
  on_edited_exam,
  on_deleted_exam,
  on_opened_exam_pdf,
  on_retried_exam,
}: ExamTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
      <table className="w-full min-w-[620px] border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 text-xs font-medium uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th scope="col" className="px-4 py-3">
              Exam
            </th>
            <th scope="col" className="px-4 py-3">
              Date
            </th>
            <th scope="col" className="px-4 py-3">
              Biomarkers
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {exams.map((exam) => {
            const abnormal_count = exam.biomarkers.filter(
              (biomarker) => biomarker.is_abnormal,
            ).length;
            const processing = exam.processing;
            const saved_without_parsing =
              !processing && exam.biomarkers.length === 0 && !exam.markdown_path;
            const status_label =
              saved_without_parsing
                ? "Saved without parsing"
                : !processing || processing.status === "completed"
                  ? null
                  : processing.stage === "waiting_for_provider"
                    ? "Waiting for provider limit"
                    : processing.status === "queued"
                      ? "Extraction queued"
                      : processing.status === "failed"
                        ? "Extraction failed"
                        : processing.stage === "converting"
                          ? "Reading PDF"
                          : `Extracting ${processing.completed_chunks} of ${processing.total_chunks} chunks`;
            return (
              <tr key={exam.id} className="text-sm">
                <th
                  scope="row"
                  className="max-w-[360px] px-4 py-3 font-medium text-gray-900 dark:text-white"
                >
                  <button
                    type="button"
                    onClick={() => on_select_exam(exam)}
                    className="block max-w-full truncate text-left hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:text-brand-300"
                    aria-label={`View details for ${exam.title}`}
                  >
                    {exam.title}
                  </button>
                </th>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                  {formatDate(exam.date_performed)}
                </td>
                <td className="px-4 py-3">
                  {status_label ? (
                    <div className="space-y-1">
                      <Badge
                        tone={
                          saved_without_parsing
                            ? "gray"
                            : processing?.status === "failed"
                              ? "warning"
                              : "info"
                        }
                      >
                        {status_label}
                      </Badge>
                      {exam.extraction_error && (
                        <p className="max-w-xs text-xs text-amber-700 dark:text-amber-300">
                          {exam.extraction_error}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Badge
                      tone={
                        saved_without_parsing || exam.biomarkers.length === 0
                          ? "gray"
                          : abnormal_count
                            ? "danger"
                            : "success"
                      }
                    >
                      {abnormal_count
                        ? `${abnormal_count} out of range`
                        : exam.biomarkers.length === 0
                          ? "No results"
                          : "All in range"}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      aria-label={`Edit ${exam.title}`}
                      title="Edit exam name"                        onClick={() => on_edited_exam(exam.id)}

                      className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M2.695 14.763l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                      </svg>
                    </button>
                    {can_delete && (
                      <button
                        type="button"
                        aria-label={`Delete ${exam.title}`}
                        title="Delete exam and PDF"
                        disabled={deleting_id === exam.id}
                        onClick={() => on_deleted_exam(exam.id)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 006 3.75V4H3.75a.75.75 0 000 1.5h.616l.74 10.5A2.75 2.75 0 007.846 18.5h4.308a2.75 2.75 0 002.744-2.5l.74-10.5h.616a.75.75 0 000-1.5H14v-.25A2.75 2.75 0 0011.25 1h-2.5zM7.5 4v.25c0 .69.56 1.25 1.25 1.25h2.5c.69 0 1.25-.56 1.25-1.25V4h-5zm1.5 4.5a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0v-5zm3.75-.75a.75.75 0 000 1.5v5a.75.75 0 001.5 0v-5a.75.75 0 00-1.5 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => on_opened_exam_pdf(exam.id)}
                    >
                      Open file
                    </Button>
                    {can_retry && processing?.retry_allowed && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={retrying_exam_id === exam.id}
                        onClick={() => on_retried_exam(exam.id)}
                      >
                        Retry extraction
                      </Button>
                    )}
                    {retry_error && processing?.status === "failed" && (
                      <p
                        role="alert"
                        className="max-w-xs text-left text-xs text-rose-600 dark:text-rose-400"
                      >
                        {retry_error}
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
