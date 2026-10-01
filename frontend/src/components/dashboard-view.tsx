import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  api,
  type CalendarData,
  type Exam,
  type Medication,
} from "../api-client";
import { format_date } from "../date-utils";
import { use_auth } from "../auth-context";
import { AnalyticsChart } from "./analytics-chart";
import { CalendarGrid } from "./calendar-grid";
import { MedicationModal } from "./medication-modal";
import { Badge, Card, EmptyState, Spinner } from "./ui/badge";
import { Button } from "./ui/button";

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
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </Card>
  );
}

export function DashboardView() {
  const { user, sign_out } = use_auth();

  const [exams, set_exams] = useState<Exam[]>([]);
  const [medications, set_medications] = useState<Medication[]>([]);
  const [calendar, set_calendar] = useState<CalendarData>({
    exams: [],
    medications: [],
  });
  const [search_query, set_search_query] = useState("");
  const [search_results, set_search_results] = useState<Exam[] | null>(null);
  const [searching, set_searching] = useState(false);
  const [loading, set_loading] = useState(true);
  const [load_error, set_load_error] = useState<string | null>(null);
  const [uploading, set_uploading] = useState(false);
  const [upload_progress, set_upload_progress] = useState(0);
  const [notice, set_notice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [modal_open, set_modal_open] = useState(false);
  const file_input_ref = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [exam_list, med_list, cal] = await Promise.all([
        api.list_exams(),
        api.list_medications(),
        api.calendar(),
      ]);
      set_exams(exam_list);
      set_medications(med_list);
      set_calendar(cal);
      set_load_error(null);
    } catch (err) {
      set_load_error(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      set_loading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Debounced global search against GET /api/exams/search?q=
  useEffect(() => {
    const q = search_query.trim();
    if (!q) {
      set_search_results(null);
      set_searching(false);
      return;
    }
    set_searching(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await api.search_exams(q);
        set_search_results(results);
      } catch {
        set_search_results([]);
      } finally {
        set_searching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search_query]);

  async function handle_upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    set_uploading(true);
    set_upload_progress(10);
    set_notice(null);
    try {
      // Progress can't be observed with fetch, so simulate incremental progress
      // while the parse+LLM pipeline runs server-side.
      const ticker = window.setInterval(() => {
        set_upload_progress((p) => (p < 90 ? p + 6 : p));
      }, 350);
      const exam = await api.upload_exam(file);
      window.clearInterval(ticker);
      set_upload_progress(100);
      await refresh();
      if (exam.extraction_error) {
        set_notice({
          kind: "err",
          text: `Saved, but extraction had a problem: ${exam.extraction_error}`,
        });
      } else {
        set_notice({
          kind: "ok",
          text: `“${exam.title}” ingested — ${exam.biomarkers.length} biomarkers extracted.`,
        });
      }
    } catch (err) {
      set_notice({
        kind: "err",
        text: err instanceof Error ? err.message : "Upload failed.",
      });
    } finally {
      set_uploading(false);
      window.setTimeout(() => set_upload_progress(0), 800);
    }
  }

  const displayed = search_query.trim() ? (search_results ?? []) : exams;

  const abnormal_count = exams.reduce(
    (sum, exam) => sum + exam.biomarkers.filter((b) => b.is_abnormal).length,
    0,
  );
  const active_meds = medications.filter(
    (m) => !m.end_date || m.end_date >= new Date().toISOString().slice(0, 10),
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h4l2-6 4 12 2-6h6" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-gray-900">Vitals</p>
              <p className="text-xs text-gray-500">Health dashboard</p>
            </div>
          </div>

          <div className="relative ml-auto w-full max-w-md">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
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
              onChange={(e) => set_search_query(e.target.value)}
              placeholder="Search exams, biomarkers, ranges…"
              aria-label="Global search"
              className="w-full rounded-lg border-0 bg-gray-100 py-2 pl-9 pr-9 text-sm text-gray-900 ring-1 ring-inset ring-transparent placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-600"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner className="h-4 w-4" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => set_modal_open(true)}
            >
              + Medication
            </Button>
            <div className="group relative">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 ring-2 ring-transparent transition group-hover:ring-brand-300"
                aria-label="Account menu"
              >
                {(user?.name || "?").charAt(0).toUpperCase()}
              </button>
              <div className="invisible absolute right-0 top-full z-40 w-56 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <div className="rounded-xl bg-white p-3 shadow-untitled-lg ring-1 ring-gray-900/5">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">{user?.email}</p>
                  <button
                    type="button"
                    onClick={sign_out}
                    className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={file_input_ref}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handle_upload}
          />
          <Button
            onClick={() => file_input_ref.current?.click()}
            loading={uploading}
          >
            {uploading ? `Parsing PDF… ${upload_progress}%` : "Upload lab report PDF"}
          </Button>
          <Button variant="secondary" onClick={() => set_modal_open(true)}>
            + Add medication
          </Button>
          {uploading && (
            <div className="h-2 w-40 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${upload_progress}%` }}
              />
            </div>
          )}
          {notice && (
            <p
              className={[
                "rounded-lg px-3 py-1.5 text-sm",
                notice.kind === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700",
              ].join(" ")}
            >
              {notice.text}
            </p>
          )}
          {search_query.trim() && (
            <button
              type="button"
              onClick={() => set_search_query("")}
              className="ml-auto text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              Clear search ({displayed.length} result{displayed.length === 1 ? "" : "s"})
            </button>
          )}
        </div>

        {load_error && (
          <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {load_error}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Exams on file" value={exams.length} hint="Parsed lab reports" tone="brand" />
          <StatCard
            label="Biomarkers tracked"
            value={exams.reduce((s, e) => s + e.biomarkers.length, 0)}
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

        {/* Exam list */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              {search_query.trim() ? "Search results" : "Recent exams"}
            </h2>
            {searching && <Spinner className="h-4 w-4" />}
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
              {displayed.map((exam) => (
                <Card key={exam.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {exam.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Performed {format_date(exam.date_performed)}
                      </p>
                    </div>
                    <Badge tone={exam.biomarkers.some((b) => b.is_abnormal) ? "danger" : "success"}>
                      {exam.biomarkers.filter((b) => b.is_abnormal).length > 0
                        ? `${exam.biomarkers.filter((b) => b.is_abnormal).length} out of range`
                        : "All in range"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {exam.biomarkers.length === 0 && (
                      <span className="text-xs text-gray-400">No biomarkers extracted.</span>
                    )}
                    {exam.biomarkers.map((b) => (
                      <span
                        key={b.id}
                        title={
                          b.reference_range
                            ? `Reference: ${b.reference_range}`
                            : "No reference range"
                        }
                        className={[
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
                          b.is_abnormal
                            ? "bg-rose-50 text-rose-700 ring-rose-200"
                            : "bg-gray-50 text-gray-700 ring-gray-200",
                        ].join(" ")}
                      >
                        {b.biomarker_name}
                        <span className="font-semibold">
                          {b.value}
                          {b.unit ? ` ${b.unit}` : ""}
                        </span>
                        {b.is_abnormal && (
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        )}
                      </span>
                    ))}
                  </div>

                  {exam.extraction_error && (
                    <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                      {exam.extraction_error}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Calendar */}
        <section>
          <CalendarGrid data={calendar} />
        </section>

        {/* Chart */}
        <section>
          <AnalyticsChart exams={exams} />
        </section>

        {/* Medications list */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Medications</h2>
            <Button variant="secondary" size="sm" onClick={() => set_modal_open(true)}>
              + Add
            </Button>
          </div>
          {medications.length === 0 ? (
            <EmptyState
              title="No medications tracked"
              hint="Add a regimen to see it span across the calendar timeline."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {medications.map((med) => (
                <Card key={med.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{med.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {med.dosage} · {med.frequency_per_day}×/day
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {format_date(med.start_date)} →{" "}
                      {med.end_date ? format_date(med.end_date) : "ongoing"}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${med.name}`}
                    onClick={async () => {
                      try {
                        await api.delete_medication(med.id);
                        await refresh();
                      } catch (err) {
                        set_notice({
                          kind: "err",
                          text:
                            err instanceof Error ? err.message : "Delete failed.",
                        });
                      }
                    }}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 006 3.75V4H3.75a.75.75 0 000 1.5h.616l.74 10.5A2.75 2.75 0 007.846 18.5h4.308a2.75 2.75 0 002.744-2.5l.74-10.5h.616a.75.75 0 000-1.5H14v-.25A2.75 2.75 0 0011.25 1h-2.5zM7.5 4v.25c0 .69.56 1.25 1.25 1.25h2.5c.69 0 1.25-.56 1.25-1.25V4h-5zm1.5 4.5a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0v-5zm3.75-.75a.75.75 0 000 1.5v5a.75.75 0 001.5 0v-5a.75.75 0 00-1.5 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      <MedicationModal
        open={modal_open}
        onClose={() => set_modal_open(false)}
        on_created={() => void refresh()}
      />
    </div>
  );
}
