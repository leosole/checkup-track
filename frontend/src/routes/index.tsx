import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../auth-context";
import { AnalyticsChart } from "../components/analytics-chart";
import { CalendarGrid } from "../components/calendar-grid";
import { DashboardExamList } from "../components/dashboard/exam-list";
import { DashboardMedicationSummary } from "../components/dashboard/medication-summary";
import { DashboardSymptomSummary } from "../components/dashboard/symptom-summary";
import { useDashboardState } from "../components/dashboard/provider";
import { StatCard } from "../components/dashboard/stat-card";
import { Button } from "../components/ui/button";

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
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!user?.capabilities.create_records}
          onClick={() => dash.set_upload_exam_open(true)}
        >
          Upload exam
        </Button>
        <Button
          variant="secondary"
          disabled={!user?.capabilities.create_records}
          onClick={() => {
            dash.set_editing_med(null);
            dash.set_modal_open(true);
          }}
        >
          Add medication
        </Button>
        <Button
          variant="secondary"
          disabled={!user?.capabilities.create_records}
          onClick={() => {
            dash.set_editing_symptom(null);
            dash.set_symptom_modal_open(true);
          }}
        >
          Log symptom
        </Button>
        <Button variant="secondary" onClick={() => void navigate({ to: "/share" })}>
          Share data
        </Button>
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
    </main>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
