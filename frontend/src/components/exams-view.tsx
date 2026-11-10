import { useState } from "react";
import { notify } from "./ui/toast";
import { api, type Exam } from "../api-client";
import { use_auth } from "../auth-context";
import { format_date } from "../date-utils";
import { Badge, EmptyState } from "./ui/badge";
import { Button } from "./ui/button";

type ExamStatus = "all" | "abnormal" | "normal";
type ExamSort = "newest" | "oldest" | "title-asc" | "title-desc";

export function ExamsView({
  exams,
  on_back,
  on_open_pdf,
  on_select_exam,
  on_edit,
  on_deleted,
  on_upload,
  on_retry_exam,
  retrying_exam_id,
  retry_error,
}: {
  exams: Exam[];
  on_back: () => void;
  on_open_pdf: (id: number) => void;
  on_select_exam: (exam: Exam) => void;
  on_edit: (exam: Exam) => void;
  on_deleted: (id: number) => Promise<void>;
  on_upload: () => void;
  on_retry_exam: (id: number) => void;
  retrying_exam_id: number | null;
  retry_error: string | null;
}) {
  const { user } = use_auth();
  const [query, set_query] = useState("");
  const [status, set_status] = useState<ExamStatus>("all");
  const [start_date, set_start_date] = useState("");
  const [end_date, set_end_date] = useState("");
  const [sort, set_sort] = useState<ExamSort>("newest");
  const [deleting_id, set_deleting_id] = useState<number | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const normalized_query = query.trim().toLowerCase();
  const visible_exams = exams
    .filter((exam) => {
      const has_abnormal = exam.biomarkers.some(
        (biomarker) => biomarker.is_abnormal,
      );
      const saved_without_parsing =
        !exam.processing && exam.biomarkers.length === 0 && !exam.markdown_path;
      const has_extracted_results =
        !saved_without_parsing &&
        (!exam.processing || exam.processing.status === "completed");
      const matches_query =
        !normalized_query ||
        exam.title.toLowerCase().includes(normalized_query) ||
        exam.biomarkers.some((biomarker) =>
          biomarker.biomarker_name.toLowerCase().includes(normalized_query),
        );
      return (
        matches_query &&
        (status === "all" ||
          (has_extracted_results &&
            (status === "abnormal") === has_abnormal)) &&
        (!start_date || exam.date_performed >= start_date) &&
        (!end_date || exam.date_performed <= end_date)
      );
    })
    .sort((left, right) => {
      if (sort === "title-asc") return left.title.localeCompare(right.title);
      if (sort === "title-desc") return right.title.localeCompare(left.title);
      const date_order = left.date_performed.localeCompare(
        right.date_performed,
      );
      return sort === "newest" ? -date_order : date_order;
    });

  async function delete_exam(exam: Exam) {
    if (!user?.capabilities.delete_records) return;
    if (
      !window.confirm(
        `Delete "${exam.title}" and its uploaded PDF? This cannot be undone.`,
      )
    ) {
      return;
    }
    set_deleting_id(exam.id);
    set_error(null);
    try {
      await api.delete_exam(exam.id);
      await on_deleted(exam.id);
      notify.success(`“${exam.title}” deleted.`);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not delete the exam.",
      );
    } finally {
      set_deleting_id(null);
    }
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Back to dashboard"
            title="Back to dashboard"
            onClick={on_back}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.56l3.22 3.22a.75.75 0 11-1.06 1.06l-4.5-4.5a.75.75 0 010-1.06l4.5-4.5a.75.75 0 111.06 1.06l-3.22 3.22h10.69A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              All exams
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {exams.length} exam{exams.length === 1 ? "" : "s"} on file
            </p>
          </div>
        </div>
        {user?.capabilities.create_records && (
          <Button onClick={on_upload}>
            Add exam
          </Button>
        )}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="sm:col-span-2 lg:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => set_query(event.target.value)}
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
            onChange={(event) => set_status(event.target.value as ExamStatus)}
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
            onChange={(event) => set_start_date(event.target.value)}
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
            onChange={(event) => set_end_date(event.target.value)}
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Sort by
          </span>
          <select
            value={sort}
            onChange={(event) => set_sort(event.target.value as ExamSort)}
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title-asc">Name A to Z</option>
            <option value="title-desc">Name Z to A</option>
          </select>
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <p
        className="mb-2 text-xs text-gray-500 dark:text-gray-400"
        aria-live="polite"
      >
        Showing {visible_exams.length} of {exams.length}
      </p>
      {visible_exams.length === 0 ? (
        <EmptyState
          title={
            exams.length === 0 ? "No exams yet" : "No exams match these filters"
          }
          hint={
            exams.length === 0
              ? "Uploaded lab reports will appear here."
              : undefined
          }
        />
      ) : (
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
              {visible_exams.map((exam) => {
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
                      {format_date(exam.date_performed)}
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
                          title="Edit exam name"
                          onClick={() => on_edit(exam)}
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
                        {user?.capabilities.delete_records && (
                          <button
                            type="button"
                            aria-label={`Delete ${exam.title}`}
                            title="Delete exam and PDF"
                            disabled={deleting_id === exam.id}
                            onClick={() => void delete_exam(exam)}
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
                          onClick={() => on_open_pdf(exam.id)}
                        >
                          Open file
                        </Button>
                        {user?.capabilities.retry_extraction &&
                          processing?.retry_allowed && (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={retrying_exam_id === exam.id}
                              onClick={() => on_retry_exam(exam.id)}
                            >
                              Retry extraction
                            </Button>
                          )}
                        {retry_error && processing?.status === "failed" && (
                          <p role="alert" className="max-w-xs text-left text-xs text-rose-600 dark:text-rose-400">
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
      )}
    </section>
  );
}
