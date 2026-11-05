import type { FormEvent } from "react";
import { format_date } from "../../date-utils";
import type { Exam } from "../../api-client";
import type { DashboardRoute } from "./types";
import { Badge, Card, EmptyState, Spinner } from "../ui/badge";
import { Button } from "../ui/button";
import { DASHBOARD_FIELD } from "./field";

interface DashboardExamListProps {
  exams: Exam[];
  displayed: Exam[];
  loading: boolean;
  search_query: string;
  searching: boolean;
  renaming_id: number | null;
  rename_value: string;
  on_navigate: (route: DashboardRoute) => void;
  on_show_exam: (id: number) => void;
  on_submit_rename: (event: FormEvent<HTMLFormElement>, exam: Exam) => void;
  on_cancel_rename: () => void;
  on_start_rename: (exam: Exam) => void;
  on_rename_value_change: (value: string) => void;
  on_delete_exam: (exam: Exam) => void;
  on_retry_exam: (id: number) => void;
  retrying_exam_id: number | null;
  on_open_exam_pdf: (id: number) => void;
}

export function DashboardExamList({
  exams,
  displayed,
  loading,
  search_query,
  searching,
  renaming_id,
  rename_value,
  on_navigate,
  on_show_exam,
  on_submit_rename,
  on_cancel_rename,
  on_start_rename,
  on_rename_value_change,
  on_delete_exam,
  on_retry_exam,
  retrying_exam_id,
  on_open_exam_pdf,
}: DashboardExamListProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {search_query.trim() ? "Search results" : "Recent exams"}
        </h2>
        <div className="flex items-center gap-3">
          {searching && <Spinner className="h-4 w-4" />}
          {!search_query.trim() && exams.length > 0 && (
            <button
              type="button"
              onClick={() => on_navigate("/exams")}
              className="text-sm font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
            >
              View more
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          title={search_query.trim() ? "No matching exams" : "No exams yet"}
          hint={
            search_query.trim()
              ? "Try a different term — search covers titles, dates, biomarker names, units, and reference ranges."
              : "Upload your first lab-report PDF and it will be parsed into structured biomarkers automatically."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {displayed.map((exam) => {
            const processing = exam.processing;
            const status_label = !processing || processing.status === "completed"
              ? null
              : processing.stage === "waiting_for_provider"
                ? "Waiting for provider limit"
              : processing.status === "queued"
                ? "Extraction queued"
                : processing.status === "failed"
                  ? "Extraction failed"
                  : processing.stage === "converting"
                    ? "Reading PDF"
                    : processing.total_chunks > 0
                      ? `Extracting · ${processing.completed_chunks} of ${processing.total_chunks} chunks`
                      : "Preparing extraction";
            return (
            <Card key={exam.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {renaming_id === exam.id ? (
                    <form
                      onSubmit={(event) => void on_submit_rename(event, exam)}
                      className="flex items-center gap-2"
                    >
                      <input
                        autoFocus
                        value={rename_value}
                        onChange={(event) => on_rename_value_change(event.target.value)}
                        aria-label="New exam name"
                        className={`${DASHBOARD_FIELD} py-1 text-sm`}
                      />
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                      <button
                        type="button"
                        onClick={on_cancel_rename}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => on_show_exam(exam.id)}
                        aria-label={`View details for ${exam.title}`}
                        className="truncate text-left text-sm font-semibold text-gray-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                      >
                        {exam.title}
                      </button>
                      <button
                        type="button"
                        aria-label={`Rename ${exam.title}`}
                        title="Rename exam"
                        onClick={() => on_start_rename(exam)}
                        className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2.695 14.763l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${exam.title}`}
                        title="Delete exam and PDF"
                        onClick={() => void on_delete_exam(exam)}
                        className="rounded-md p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H3.75a.75.75 0 000 1.5h.616l.74 10.5A2.75 2.75 0 007.846 18.5h4.308a2.75 2.75 0 002.744-2.5l.74-10.5h.616a.75.75 0 000-1.5H14v-.25A2.75 2.75 0 0011.25 1h-2.5zM7.5 4v.25c0 .69.56 1.25 1.25 1.25h2.5c.69 0 1.25-.56 1.25-1.25V4h-5zm1.5 4.5a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0v-5zm3.75-.75a.75.75 0 000 1.5v5a.75.75 0 001.5 0v-5a.75.75 0 00-1.5 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Performed {format_date(exam.date_performed)}
                    </p>
                    {status_label ? (
                      <Badge tone={processing?.status === "failed" ? "warning" : "info"}>
                        {status_label}
                      </Badge>
                    ) : (
                      <Badge
                        tone={exam.biomarkers.some((biomarker) => biomarker.is_abnormal) ? "danger" : "success"}
                      >
                        {exam.biomarkers.filter((biomarker) => biomarker.is_abnormal).length > 0
                          ? `${exam.biomarkers.filter((biomarker) => biomarker.is_abnormal).length} out of range`
                          : "All in range"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {exam.biomarkers.length === 0 && processing?.status !== "queued" && processing?.status !== "processing" && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    No biomarkers extracted.
                  </span>
                )}
                {exam.biomarkers.length === 0 && (processing?.status === "queued" || processing?.status === "processing") && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Results will appear here when extraction finishes.
                  </span>
                )}
                {exam.biomarkers.map((biomarker) => (
                  <span
                    key={biomarker.id}
                    title={
                      biomarker.reference_range
                        ? `Reference: ${biomarker.reference_range}`
                        : "No reference range"
                    }
                    className={[
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                      biomarker.is_abnormal
                        ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
                        : "bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
                    ].join(" ")}
                  >
                    {biomarker.biomarker_name}
                    <span className="font-semibold">
                      {biomarker.value}{biomarker.unit ? ` ${biomarker.unit}` : ""}
                    </span>
                    {biomarker.is_abnormal && (
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    )}
                  </span>
                ))}
              </div>

              {exam.extraction_error && (
                <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  {exam.extraction_error}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => on_open_exam_pdf(exam.id)}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 3a2 2 0 00-2 2v2.5a.75.75 0 001.5 0V5a.5.5 0 01.5-.5h3.25a.75.75 0 000-1.5H4zM16 3h-3.25a.75.75 0 000 1.5H16a.5.5 0 01.5.5v2.5a.75.75 0 001.5 0V5a2 2 0 00-2-2zM3.5 12.5a.75.75 0 00-1.5 0V15a2 2 0 002 2h3.25a.75.75 0 000-1.5H4a.5.5 0 01-.5-.5v-2.5zM17.5 12.5a.75.75 0 00-1.5 0V15a.5.5 0 01-.5.5h-3.25a.75.75 0 000 1.5H16a2 2 0 002-2v-2.5z" />
                  </svg>
                  Open PDF
                </Button>
                {processing?.retry_allowed && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={retrying_exam_id === exam.id}
                    onClick={() => on_retry_exam(exam.id)}
                  >
                    Retry extraction
                  </Button>
                )}
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}