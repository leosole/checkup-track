import type { FormEvent } from "react";
import type { CalendarData, Exam, Medication } from "../../api-client";
import { use_auth } from "../../auth-context";
import { AnalyticsChart } from "../analytics-chart/analytics-chart";
import { CalendarGrid } from "../calendar-grid";
import type { DashboardRoute } from "./types";
import { Card } from "../ui/badge";
import { Button } from "../ui/button";
import { DashboardExamList } from "./exam-list";
import { DashboardMedicationSummary } from "./medication-summary";
interface Notice {
  kind: "ok" | "err";
  text: string;
}

export interface DashboardOverviewData {
  route: DashboardRoute;
  exams: Exam[];
  medications: Medication[];
  calendar: CalendarData;
  displayed: Exam[];
  loading: boolean;
  load_error: string | null;
  notice: Notice | null;
  search_query: string;
  searching: boolean;
  abnormal_count: number;
  active_meds: number;
  renaming_id: number | null;
  rename_value: string;
  retrying_exam_id: number | null;
  retry_error: string | null;
  plot_markers: string[];
}

export interface DashboardOverviewActions {
  on_upload: () => void;
  on_add_medication: () => void;
  on_clear_search: () => void;
  on_navigate: (route: DashboardRoute) => void;
  on_show_calendar_exam: (id: number) => void;
  on_show_calendar_medication: (id: number) => void;
  on_submit_rename: (event: FormEvent<HTMLFormElement>, exam: Exam) => void;
  on_cancel_rename: () => void;
  on_start_rename: (exam: Exam) => void;
  on_rename_value_change: (value: string) => void;
  on_delete_exam: (exam: Exam) => void;
  on_retry_exam: (id: number) => void;
  retry_error: string | null;
  on_open_exam_pdf: (id: number) => void;
  on_edit_medication: (medication: Medication) => void;
  on_delete_medication: (medication: Medication) => void;
  on_toggle_plot_marker: (name: string) => void;
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "brand" | "danger" | "success" | "gray";
}) {
  const dot =
    tone === "danger"
      ? "bg-rose-500"
      : tone === "success"
        ? "bg-emerald-500"
        : tone === "brand"
          ? "bg-brand-500"
          : "bg-gray-400";
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </Card>
  );
}

export function DashboardOverview({
  data,
  actions,
}: {
  data: DashboardOverviewData;
  actions: DashboardOverviewActions;
}) {
  const { user } = use_auth();
  const {
    route,
    exams,
    medications,
    calendar,
    displayed,
    loading,
    load_error,
    notice,
    search_query,
    searching,
    abnormal_count,
    active_meds,
    renaming_id,
    rename_value,
    retrying_exam_id,
    retry_error,
    plot_markers,
  } = data;
  const {
    on_upload,
    on_add_medication,
    on_clear_search,
    on_navigate,
    on_show_calendar_exam,
    on_show_calendar_medication,
    on_submit_rename,
    on_cancel_rename,
    on_start_rename,
    on_rename_value_change,
    on_delete_exam,
    on_retry_exam,
    on_open_exam_pdf,
    on_edit_medication,
    on_delete_medication,
    on_toggle_plot_marker,
  } = actions;

  return (
    <main
      className={`mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 ${route !== "/" ? "hidden" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {user?.capabilities.create_records && (
          <>
            <Button onClick={on_upload}>
              Upload exam
            </Button>
            <Button variant="secondary" onClick={on_add_medication}>
              + Add medication
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={() => on_navigate("/share")}>
          Share data
        </Button>
        {notice && (
          <p
            className={[
              "rounded-lg px-3 py-1.5 text-sm",
              notice.kind === "ok"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
            ].join(" ")}
          >
            {notice.text}
          </p>
        )}
        {search_query.trim() && (
          <button
            type="button"
            onClick={on_clear_search}
            className="ml-auto text-sm font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
          >
            Clear search ({displayed.length} result
            {displayed.length === 1 ? "" : "s"})
          </button>
        )}
      </div>
      {load_error && (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {load_error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Exams on file"
          value={exams.length}
          hint="Uploaded records"
          tone="brand"
        />
        <StatCard
          label="Biomarkers tracked"
          value={exams.reduce((sum, exam) => sum + exam.biomarkers.length, 0)}
          hint="Across all panels"
        />
        <StatCard
          label="Out-of-range results"
          value={abnormal_count}
          hint="Flagged for review"
          tone={abnormal_count > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Active medications"
          value={active_meds}
          hint={`${medications.length} total tracked`}
          tone="gray"
        />
      </div>

      <DashboardExamList
        exams={exams}
        displayed={displayed}
        loading={loading}
        search_query={search_query}
        searching={searching}
        renaming_id={renaming_id}
        rename_value={rename_value}
        plot_markers={plot_markers}
        on_toggle_marker={on_toggle_plot_marker}
        on_navigate={on_navigate}
        on_show_exam={on_show_calendar_exam}
        on_submit_rename={on_submit_rename}
        on_cancel_rename={on_cancel_rename}
        on_start_rename={on_start_rename}
        on_rename_value_change={on_rename_value_change}
        on_delete_exam={on_delete_exam}
        on_retry_exam={on_retry_exam}
        retrying_exam_id={retrying_exam_id}
        retry_error={retry_error}
        on_open_exam_pdf={on_open_exam_pdf}
      />

      <section>
        <CalendarGrid
          data={calendar}
          on_exam_click={on_show_calendar_exam}
          on_medication_click={on_show_calendar_medication}
        />
      </section>

      <section>
        <AnalyticsChart
          exams={exams}
          exams_loading={loading}
          selected={plot_markers}
          on_toggle_spec={on_toggle_plot_marker}
        />
      </section>

      <DashboardMedicationSummary
        medications={medications}
        on_add={on_add_medication}
        on_navigate={on_navigate}
        on_edit={on_edit_medication}
        on_delete={on_delete_medication}
      />
    </main>
  );
}
