import { formatDate } from "../../date-utils";
import { useAuth } from "../../auth-context";
import { useNavigate } from "@tanstack/react-router";
import type { Exam } from "../../types";
import { Badge, Card, EmptyState, Spinner } from "../ui/badge";
import { Button } from "../ui/button";
import { DASHBOARD_FIELD } from "./field";
import { hasMarker } from "../analytics-chart/marker-selection";
import { useDashboardState } from "./provider";

export function DashboardExamList() {
  const { user } = useAuth();
  const dash = useDashboardState();
  const navigate = useNavigate();
  const exams = dash.exams;
  const displayed = dash.displayed;
  const loading = dash.loading;
  const search_query = dash.search_query;
  const search_results = dash.search_results;
  const searching = dash.searching;
  const set_search_query = dash.set_search_query;
  const renaming_id = dash.renaming_id;
  const rename_value = dash.rename_value;
  const plot_markers = dash.plot_markers;
  const retrying_exam_id = dash.retrying_exam_id;
  const retry_error = dash.retry_error;
  const toggleMarker = dash.toggleMarker;
  const openExamPdf = (id: number) => void dash.openExamPdf(id);
  const showExam = (id: number) => dash.showCalendarExam(id);
  const submitRename = dash.submitRename;
  const cancelRename = () => dash.set_renaming_id(null);
  const startRename = (exam: Exam) => {
    dash.set_renaming_id(exam.id);
    dash.set_rename_value(exam.title);
  };
  const renameValueChange = dash.set_rename_value;
  const deleteExam = (exam: Exam) => void dash.deleteExam(exam);
  const retryExam = (id: number) => void dash.retryExam(id);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {search_query.trim() ? "Search results" : "Recent exams"}
          </h2>
          {!search_query.trim() && (
            <Button
              size="sm"
              disabled={!user?.capabilities.create_records}
              onClick={() => dash.set_upload_exam_open(true)}
            >
              + Upload
            </Button>
          )}
        </div>
        <div className="relative w-full sm:w-72 sm:shrink-0">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={search_query}
            onChange={(event) => set_search_query(event.target.value)}
            placeholder="Search exams, biomarkers, ranges…"
            aria-label="Search exams"
            className="w-full rounded-lg border-0 bg-gray-100 py-2 pl-9 pr-9 text-sm text-gray-900 ring-1 ring-inset ring-transparent placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-900"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {search_query.trim() ? (
            <button
              type="button"
              onClick={() => set_search_query("")}
              className="text-sm font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Clear search
              {search_results
                ? ` (${search_results.length} result${search_results.length === 1 ? "" : "s"})`
                : ""}
            </button>
          ) : (
            exams.length > 0 && (
              <button
                type="button"
                onClick={() => void navigate({ to: "/exams" })}
                className="text-sm font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
              >
                View more
              </button>
            )
          )}
        </div>
      </div>

      {displayed.length > 0 && (
        <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">
          Click a marker to add it to the trend plot.
        </p>
      )}

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
        <div className="space-y-4">
          {displayed.map((exam) => {
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
                        : processing.total_chunks > 0
                          ? `Extracting · ${processing.completed_chunks} of ${processing.total_chunks} chunks`
                          : "Preparing extraction";
            return (
              <Card key={exam.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {renaming_id === exam.id ? (
                      <form
                        onSubmit={(event) => void submitRename(event, exam)}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          autoFocus
                          value={rename_value}
                          onChange={(event) =>
                            renameValueChange(event.target.value)
                          }
                          aria-label="New exam name"
                          className={`${DASHBOARD_FIELD} flex-1 min-w-[200px] py-1 text-sm`}
                        />
                        <Button type="submit" size="sm">
                          Save
                        </Button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => showExam(exam.id)}
                          aria-label={`View details for ${exam.title}`}
                          className="truncate text-left text-sm font-semibold text-gray-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                        >
                          {exam.title}
                        </button>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Performed {formatDate(exam.date_performed)}
                      </p>
                      {status_label ? (
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
                      ) : (
                        <Badge
                          tone={
                            exam.biomarkers.length === 0
                              ? "gray"
                              : exam.biomarkers.some(
                              (biomarker) => biomarker.is_abnormal,
                            )
                              ? "danger"
                              : "success"
                          }
                        >
                          {exam.biomarkers.filter(
                            (biomarker) => biomarker.is_abnormal,
                          ).length > 0
                            ? `${exam.biomarkers.filter((biomarker) => biomarker.is_abnormal).length} out of range`
                            : exam.biomarkers.length === 0
                              ? "No results"
                              : "All in range"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-row flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
                    {renaming_id !== exam.id && (
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          aria-label={`Rename ${exam.title}`}
                          title="Rename exam"
                          onClick={() => startRename(exam)}
                          className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
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
                        <button
                          type="button"
                          aria-label={`Delete ${exam.title}`}
                          title="Delete exam and PDF"
                          disabled={!user?.capabilities.delete_records}
                          onClick={() => void deleteExam(exam)}
                          className="rounded-md p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
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
                      </div>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openExamPdf(exam.id)}
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M4 3a2 2 0 00-2 2v2.5a.75.75 0 001.5 0V5a.5.5 0 01.5-.5h3.25a.75.75 0 000-1.5H4zM16 3h-3.25a.75.75 0 000 1.5H16a.5.5 0 01.5.5v2.5a.75.75 0 001.5 0V5a2 2 0 00-2-2zM3.5 12.5a.75.75 0 00-1.5 0V15a2 2 0 002 2h3.25a.75.75 0 000-1.5H4a.5.5 0 01-.5-.5v-2.5zM17.5 12.5a.75.75 0 00-1.5 0V15a.5.5 0 01-.5.5h-3.25a.75.75 0 000 1.5H16a2 2 0 002-2v-2.5z" />
                      </svg>
                      Open file
                    </Button>
                    {processing?.retry_allowed && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={retrying_exam_id === exam.id}
                        disabled={!user?.capabilities.retry_extraction}
                        onClick={() => retryExam(exam.id)}
                      >
                        Retry extraction
                      </Button>
                    )}
                    {retry_error && processing?.status === "failed" && (
                      <p role="alert" className="w-full text-xs text-rose-600 dark:text-rose-400">
                        {retry_error}
                      </p>
                    )}
                  </div>
                </div>

                <details className="mt-3 [&[open]>summary>svg]:rotate-180">
                  <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-gray-500 marker:hidden hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-gray-400 dark:hover:text-gray-200 [&::-webkit-details-marker]:hidden">
                    Results ({exam.biomarkers.length})
                    <svg
                      className="h-3.5 w-3.5 transition-transform"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {exam.biomarkers.length === 0 &&
                      processing?.status !== "queued" &&
                      processing?.status !== "processing" && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          No biomarkers extracted.
                        </span>
                      )}
                    {exam.biomarkers.length === 0 &&
                      (processing?.status === "queued" ||
                        processing?.status === "processing") && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Results will appear here when extraction finishes.
                        </span>
                      )}
                    {exam.biomarkers.map((biomarker) => {
                      const plotted = hasMarker(
                        plot_markers,
                        biomarker.biomarker_name,
                      );
                      const range_label = biomarker.reference_range
                        ? `normal range ${biomarker.reference_range}`
                        : "no reference range";
                      return (
                        <button
                          key={biomarker.id}
                          type="button"
                          onClick={() =>
                            toggleMarker(biomarker.biomarker_name)
                          }
                          aria-pressed={plotted}
                          aria-label={`${biomarker.biomarker_name}: ${biomarker.value}${
                            biomarker.unit ? ` ${biomarker.unit}` : ""
                          }, ${range_label}. ${
                            plotted
                              ? "Remove from trend plot"
                              : "Add to trend plot"
                          }`}
                          className={[
                            "group/marker relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
                            plotted
                              ? "bg-brand-50 text-brand-700 ring-brand-400 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/50"
                              : biomarker.is_abnormal
                                ? "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30 dark:hover:bg-rose-500/20"
                                : "bg-gray-50 text-gray-700 ring-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700",
                          ].join(" ")}
                        >
                          {plotted && (
                            <svg
                              className="h-3 w-3 shrink-0"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 011.415-1.415L8.5 12.085l6.79-6.795a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          {biomarker.biomarker_name}
                          <span className="font-semibold">
                            {biomarker.value}
                            {biomarker.unit ? ` ${biomarker.unit}` : ""}
                          </span>
                          {biomarker.is_abnormal && (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          )}
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover/marker:block group-focus-visible/marker:block dark:bg-gray-700"
                          >
                            {biomarker.reference_range
                              ? `Normal range: ${biomarker.reference_range}`
                              : "No reference range"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </details>

                {exam.extraction_error && (
                  <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    {exam.extraction_error}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
