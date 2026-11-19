import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HiMiniShare } from "react-icons/hi2";
import { useAuth } from "../auth-context";
import { AnalyticsChart } from "../components/analytics-chart";
import { CalendarGrid } from "../components/calendar-grid";
import { DashboardExamList } from "../components/dashboard/exam-list";
import { DashboardMedicationSummary } from "../components/dashboard/medication-summary";
import { DashboardSymptomSummary } from "../components/dashboard/symptom-summary";
import { useDashboardState } from "../components/dashboard/provider";
import { DashboardQuickActions } from "../components/dashboard/quick-actions";
import { StatCard } from "../components/dashboard/stat-card";

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dash = useDashboardState();
  const {
    exams,
    medications,
    calendar,
    loading,
    load_error,
    plot_markers,
    abnormal_count,
    active_meds,
  } = dash;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-end">
        <button
          type="button"
          aria-label="Share data"
          title="Share data"
          onClick={() => void navigate({ to: "/share" })}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-600 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <HiMiniShare className="h-5 w-5" aria-hidden="true" />
        </button>
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
          hint={`${medications.length} use${medications.length === 1 ? "" : "s"} on file`}
          tone="gray"
        />
      </div>

      <section>          
        <CalendarGrid
          data={calendar}
          onClick={(item) => {
            if (item.kind === "exam") {
              dash.showCalendarExam(item.id);
            } else if (item.kind === "medication") {
              dash.showCalendarMedication(item.id);
            } else {
              dash.showCalendarSymptom(item.id);
            }
          }}
          on_day_click={dash.set_calendar_day}
        />
      </section>
      
      <section>
        <AnalyticsChart
          exams={exams}
          exams_loading={loading}
          selected={plot_markers}
          on_toggle_spec={dash.toggleMarker}
        />
      </section>

      <DashboardExamList />

      <DashboardMedicationSummary />

      <DashboardSymptomSummary />

      <DashboardQuickActions
        can_create_records={Boolean(user?.capabilities.create_records)}
        on_upload_exam={() => dash.set_upload_exam_open(true)}
        on_add_medication={() => {
          dash.set_editing_med(null);
          dash.set_modal_open(true);
        }}
        on_log_symptom={() => {
          dash.set_editing_symptom(null);
          dash.set_symptom_modal_open(true);
        }}
      />
    </main>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
