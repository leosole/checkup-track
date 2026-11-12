import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "../api-client";
import { AnalyticsChart } from "../components/analytics-chart";
import { useAuth } from "../auth-context";
import { useDashboardState } from "../components/dashboard/provider";
import { ExamStatus, ExamSort } from "../components/exams/types";
import { toggleSort } from "../sort-utils";
import { EmptyState, Spinner } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { notify } from "../components/ui/toast";
import { ExamFilters } from "../components/exams/filters";
import { ExamTable } from "../components/exams/table";
import type { Exam } from "../types";

function ExamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dash = useDashboardState();
  const exams = dash.exams;
  const [query, set_query] = useState("");
  const [status, set_status] = useState<ExamStatus>("all");
  const [start_date, set_start_date] = useState("");
  const [end_date, set_end_date] = useState("");
  const [sort, set_sort] = useState<ExamSort>({
    field: "date_performed",
    direction: "desc",
  });
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
        Boolean(exam.laboratory?.toLowerCase().includes(normalized_query)) ||
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
      const factor = sort.direction === "asc" ? 1 : -1;
      if (sort.field === "title") {
        return factor * left.title.localeCompare(right.title);
      }
      return factor * left.date_performed.localeCompare(right.date_performed);
    });

  async function deleteExam(exam: Exam) {
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
      await api.deleteExam(exam.id);
      await dash.refresh();
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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {dash.loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Back to dashboard"
                title="Back to dashboard"
                onClick={() => void navigate({ to: "/" })}
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
            <Button
              disabled={!user?.capabilities.create_records}
              onClick={() => dash.set_upload_exam_open(true)}
            >
              Add exam
            </Button>
          </div>

          <ExamFilters
            query={query}
            status={status}
            start_date={start_date}
            end_date={end_date}
            on_query_change={set_query}
            on_status_change={set_status}
            on_start_date_change={set_start_date}
            on_end_date_change={set_end_date}
          />

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
                exams.length === 0
                  ? "No exams yet"
                  : "No exams match these filters"
              }
              hint={
                exams.length === 0
                  ? "Uploaded lab reports will appear here."
                  : undefined
              }
            />
          ) : (
            <ExamTable
              exams={visible_exams}
              can_delete={Boolean(user?.capabilities.delete_records)}
              can_retry={Boolean(user?.capabilities.retry_extraction)}
              retrying_exam_id={dash.retrying_exam_id}
              retry_error={dash.retry_error}
              deleting_id={deleting_id}
              sort={sort}
              on_sort_change={(field) =>
                set_sort((current) => toggleSort(current, field))
              }
              on_select_exam={(exam: Exam) => void dash.showCalendarExam(exam.id)}
              on_edited_exam={(examId: number) => {
                const exam = exams.find((item) => item.id === examId);
                if (exam) dash.set_rename_modal_exam(exam);
              }}
              on_deleted_exam={(examId: number) => {
                const examToDelete = exams.find((item) => item.id === examId);
                if (examToDelete) void deleteExam(examToDelete);
              }}
              on_opened_exam_pdf={(id) => void dash.openExamPdf(id)}
              on_retried_exam={(id) => dash.retryExam(id)}
            />
          )}

          <div className="mt-6">
            <AnalyticsChart
              exams={exams}
              exams_loading={dash.loading}
              selected={dash.plot_markers}
              on_toggle_spec={dash.toggleMarker}
            />
          </div>
        </section>
      )}
    </main>
  );
}

export const Route = createFileRoute("/exams")({
  component: ExamsPage,
});