import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  api,
  type CalendarData,
  type Exam,
  type Medication,
} from "../api-client";
import { TbMoonFilled, TbSunLowFilled } from "react-icons/tb";
import { format_date } from "../date-utils";
import { use_auth } from "../auth-context";
import { apply_theme, init_theme, type Theme } from "../theme";
import { AnalyticsChart } from "./analytics-chart";
import { CalendarItemModal, type CalendarSelection } from "./calendar-item-modal";
import { CalendarGrid } from "./calendar-grid";
import { ExamRenameModal } from "./exam-rename-modal";
import { ExamsView } from "./exams-view";
import { MedicationModal } from "./medication-modal";
import { MedicationsView } from "./medications-view";
import { Badge, Card, EmptyState, Spinner } from "./ui/badge";
import { Button } from "./ui/button";

/** Small text field styling shared by the inline inputs in this view. */
const FIELD =
  "rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 " +
  "ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset " +
  "focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700 " +
  "dark:placeholder:text-gray-500";

type DashboardRoute = "/" | "/exams" | "/medications";

function route_from_path(pathname: string): DashboardRoute {
  if (pathname === "/exams" || pathname === "/medications") return pathname;
  return "/";
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
      {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </Card>
  );
}

export function DashboardView() {
  const { user, sign_out } = use_auth();

  const [route, set_route] = useState<DashboardRoute>(() =>
    route_from_path(window.location.pathname),
  );
  const [exams, set_exams] = useState<Exam[]>([]);
  const [medications, set_medications] = useState<Medication[]>([]);
  const [calendar_item, set_calendar_item] = useState<CalendarSelection | null>(null);
  const [calendar_item_error, set_calendar_item_error] = useState<string | null>(null);
  const [calendar_action_busy, set_calendar_action_busy] = useState(false);
  const [rename_modal_exam, set_rename_modal_exam] = useState<Exam | null>(null);
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
  const [exam_name, set_exam_name] = useState("");
  const [notice, set_notice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [modal_open, set_modal_open] = useState(false);
  const [editing_med, set_editing_med] = useState<Medication | null>(null);
  const [renaming_id, set_renaming_id] = useState<number | null>(null);
  const [rename_value, set_rename_value] = useState("");
  const [theme, set_theme] = useState<Theme>(() => init_theme());
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

  useEffect(() => {
    const sync_route = () => {
      const next_route = route_from_path(window.location.pathname);
      if (next_route !== window.location.pathname) {
        window.history.replaceState(null, "", next_route);
      }
      set_route(next_route);
    };
    window.addEventListener("popstate", sync_route);
    return () => window.removeEventListener("popstate", sync_route);
  }, []);

  function navigate(next_route: DashboardRoute) {
    if (window.location.pathname !== next_route) {
      window.history.pushState(null, "", next_route);
    }
    set_route(next_route);
  }

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

  function toggle_theme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    apply_theme(next);
    set_theme(next);
  }

  async function open_exam_pdf(exam_id: number) {
    try {
      const blob = await api.exam_pdf(exam_id);
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        set_notice({
          kind: "err",
          text: "The browser blocked the PDF tab. Allow pop-ups and retry.",
        });
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      set_notice({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not open the PDF.",
      });
    }
  }

  function show_calendar_exam(exam_id: number) {
    const exam = exams.find((item) => item.id === exam_id);
    if (exam) {
      set_calendar_item_error(null);
      set_calendar_item({ kind: "exam", exam });
    }
  }

  function show_calendar_medication(medication_id: number) {
    const medication = medications.find((item) => item.id === medication_id);
    if (medication) {
      set_calendar_item_error(null);
      set_calendar_item({ kind: "medication", medication });
    }
  }

  async function download_exam_file(exam: Exam) {
    set_calendar_action_busy(true);
    set_calendar_item_error(null);
    try {
      const blob = await api.exam_pdf(exam.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stem = exam.title.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[_\.]+|[_\.]+$/g, "");
      anchor.href = url;
      anchor.download = `${stem || "exam"}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      set_calendar_item_error(err instanceof Error ? err.message : "Could not download the PDF.");
    } finally {
      set_calendar_action_busy(false);
    }
  }

  async function delete_calendar_item() {
    if (!calendar_item) return;
    const item_name = calendar_item.kind === "exam"
      ? calendar_item.exam.title
      : calendar_item.medication.name;
    const confirmation = calendar_item.kind === "exam"
      ? `Delete "${item_name}" and its uploaded PDF? This cannot be undone.`
      : `Delete "${item_name}"? This cannot be undone.`;
    if (!window.confirm(confirmation)) return;

    set_calendar_action_busy(true);
    set_calendar_item_error(null);
    try {
      if (calendar_item.kind === "exam") {
        const exam_id = calendar_item.exam.id;
        await api.delete_exam(exam_id);
        set_exams((current) => current.filter((exam) => exam.id !== exam_id));
        set_calendar((current) => ({
          ...current,
          exams: current.exams.filter((exam) => exam.id !== exam_id),
        }));
      } else {
        const medication_id = calendar_item.medication.id;
        await api.delete_medication(medication_id);
        set_medications((current) =>
          current.filter((medication) => medication.id !== medication_id),
        );
        set_calendar((current) => ({
          ...current,
          medications: current.medications.filter((med) => med.id !== medication_id),
        }));
      }
      set_calendar_item(null);
      await refresh();
    } catch (err) {
      set_calendar_item_error(err instanceof Error ? err.message : "Could not delete the item.");
    } finally {
      set_calendar_action_busy(false);
    }
  }

  function edit_calendar_item() {
    if (!calendar_item) return;
    if (calendar_item.kind === "exam") {
      set_rename_modal_exam(calendar_item.exam);
    } else {
      set_editing_med(calendar_item.medication);
      set_modal_open(true);
    }
    set_calendar_item(null);
  }

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
      const exam = await api.upload_exam(file, exam_name);
      window.clearInterval(ticker);
      set_upload_progress(100);
      set_exam_name("");
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

  async function submit_rename(e: FormEvent, exam: Exam) {
    e.preventDefault();
    const value = rename_value.trim();
    if (!value || value === exam.title) {
      set_renaming_id(null);
      return;
    }
    try {
      await api.rename_exam(exam.id, value);
      set_renaming_id(null);
      await refresh();
    } catch (err) {
      set_notice({
        kind: "err",
        text: err instanceof Error ? err.message : "Rename failed.",
      });
    }
  }

  async function delete_exam(exam: Exam) {
    if (!window.confirm(`Delete "${exam.title}" and its uploaded PDF? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete_exam(exam.id);
      set_exams((current) => current.filter((item) => item.id !== exam.id));
      set_search_results((current) => current?.filter((item) => item.id !== exam.id) ?? null);
      set_calendar((current) => ({
        ...current,
        exams: current.exams.filter((item) => item.id !== exam.id),
      }));
      await refresh();
    } catch (err) {
      set_notice({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not delete the exam.",
      });
    }
  }

  const displayed = search_query.trim() ? (search_results ?? []) : exams.slice(0, 5);

  const abnormal_count = exams.reduce(
    (sum, exam) => sum + exam.biomarkers.filter((b) => b.is_abnormal).length,
    0,
  );
  const active_meds = medications.filter(
    (m) => !m.end_date || m.end_date >= new Date().toISOString().slice(0, 10),
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <input
        ref={file_input_ref}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handle_upload}
      />
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Go to dashboard home"
            onClick={() => navigate("/")}
            className="flex shrink-0 items-center gap-2.5 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h4l2-6 4 12 2-6h6" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                CheckUpTrack
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Health dashboard</p>
            </div>
          </button>

          <div
            className={`relative w-full max-w-md ${route !== "/" ? "hidden" : ""}`}
          >
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
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
              className="w-full rounded-lg border-0 bg-gray-100 py-2 pl-9 pr-9 text-sm text-gray-900 ring-1 ring-inset ring-transparent placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-900"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner className="h-4 w-4" />
              </span>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggle_theme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              {theme === "dark" ? (
                <TbSunLowFilled className="h-5 w-5" aria-hidden="true" />
              ) : (
                <TbMoonFilled className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
            <div className="group relative">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 ring-2 ring-transparent transition group-hover:ring-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:group-hover:ring-brand-500/40"
                aria-label="Account menu"
              >
                {(user?.name || "?").charAt(0).toUpperCase()}
              </button>
              <div className="invisible absolute right-0 top-full z-40 w-56 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <div className="rounded-xl bg-white p-3 shadow-untitled-lg ring-1 ring-gray-900/5 dark:bg-gray-900 dark:shadow-none dark:ring-white/10">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                  <button
                    type="button"
                    onClick={sign_out}
                    className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 ${route !== "/" ? "hidden" : ""}`}
      >
        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={exam_name}
            onChange={(e) => set_exam_name(e.target.value)}
            placeholder="Exam name (optional)"
            aria-label="Exam name for the next upload"
            className={`${FIELD} w-56`}
          />
          <Button onClick={() => file_input_ref.current?.click()} loading={uploading}>
            {uploading ? `Parsing PDF… ${upload_progress}%` : "Upload lab report PDF"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              set_editing_med(null);
              set_modal_open(true);
            }}
          >
            + Add medication
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
              onClick={() => set_search_query("")}
              className="ml-auto text-sm font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Clear search ({displayed.length} result{displayed.length === 1 ? "" : "s"})
            </button>
          )}
        </div>
        <p className="-mt-1 text-xs text-gray-400 dark:text-gray-500">
          Leave the exam name empty to use the report&apos;s own title, falling back to the
          PDF file name.
        </p>

        {load_error && (
          <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {search_query.trim() ? "Search results" : "Recent exams"}
            </h2>
            <div className="flex items-center gap-3">
              {searching && <Spinner className="h-4 w-4" />}
              {!search_query.trim() && exams.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/exams")}
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
              {displayed.map((exam) => (
                <Card key={exam.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {renaming_id === exam.id ? (
                        <form
                          onSubmit={(e) => void submit_rename(e, exam)}
                          className="flex items-center gap-2"
                        >
                          <input
                            autoFocus
                            value={rename_value}
                            onChange={(e) => set_rename_value(e.target.value)}
                            aria-label="New exam name"
                            className={`${FIELD} py-1 text-sm`}
                          />
                          <Button type="submit" size="sm">
                            Save
                          </Button>
                          <button
                            type="button"
                            onClick={() => set_renaming_id(null)}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {exam.title}
                          </h3>
                          <button
                            type="button"
                            aria-label={`Rename ${exam.title}`}
                            title="Rename exam"
                            onClick={() => {
                              set_renaming_id(exam.id);
                              set_rename_value(exam.title);
                            }}
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
                            onClick={() => void delete_exam(exam)}
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
                        <Badge
                          tone={exam.biomarkers.some((b) => b.is_abnormal) ? "danger" : "success"}
                        >
                          {exam.biomarkers.filter((b) => b.is_abnormal).length > 0
                            ? `${exam.biomarkers.filter((b) => b.is_abnormal).length} out of range`
                            : "All in range"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {exam.biomarkers.length === 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        No biomarkers extracted.
                      </span>
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
                            ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
                            : "bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
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
                    <p className="mt-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      {exam.extraction_error}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void open_exam_pdf(exam.id)}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4 3a2 2 0 00-2 2v2.5a.75.75 0 001.5 0V5a.5.5 0 01.5-.5h3.25a.75.75 0 000-1.5H4zM16 3h-3.25a.75.75 0 000 1.5H16a.5.5 0 01.5.5v2.5a.75.75 0 001.5 0V5a2 2 0 00-2-2zM3.5 12.5a.75.75 0 00-1.5 0V15a2 2 0 002 2h3.25a.75.75 0 000-1.5H4a.5.5 0 01-.5-.5v-2.5zM17.5 12.5a.75.75 0 00-1.5 0V15a.5.5 0 01-.5.5h-3.25a.75.75 0 000 1.5H16a2 2 0 002-2v-2.5z" />
                      </svg>
                      Open PDF
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Calendar */}
        <section>
          <CalendarGrid
            data={calendar}
            on_exam_click={show_calendar_exam}
            on_medication_click={show_calendar_medication}
          />
        </section>

        {/* Chart */}
        <section>
          <AnalyticsChart exams={exams} />
        </section>

        {/* Medications list */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Medications
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  set_editing_med(null);
                  set_modal_open(true);
                }}
              >
                + Add
              </Button>
              <button
                type="button"
                onClick={() => navigate("/medications")}
                className="text-sm font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
              >
                View more
              </button>
            </div>
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
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {med.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {med.dosage} · {med.frequency_per_day}×/day
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {format_date(med.start_date)} →{" "}
                      {med.end_date ? format_date(med.end_date) : "ongoing"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${med.name}`}
                      title="Edit medication"
                      onClick={() => {
                        set_editing_med(med);
                        set_modal_open(true);
                      }}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.695 14.763l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                      </svg>
                    </button>
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
                            text: err instanceof Error ? err.message : "Delete failed.",
                          });
                        }
                      }}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A2.75 2.75 0 006 3.75V4H3.75a.75.75 0 000 1.5h.616l.74 10.5A2.75 2.75 0 007.846 18.5h4.308a2.75 2.75 0 002.744-2.5l.74-10.5h.616a.75.75 0 000-1.5H14v-.25A2.75 2.75 0 0011.25 1h-2.5zM7.5 4v.25c0 .69.56 1.25 1.25 1.25h2.5c.69 0 1.25-.56 1.25-1.25V4h-5zm1.5 4.5a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0v-5zm3.75-.75a.75.75 0 000 1.5v5a.75.75 0 001.5 0v-5a.75.75 0 00-1.5 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      {route === "/exams" && (
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
          ) : (
            <ExamsView
              exams={exams}
              on_back={() => navigate("/")}
              on_open_pdf={(id) => void open_exam_pdf(id)}
              on_edit={set_rename_modal_exam}
              on_upload={() => file_input_ref.current?.click()}
              uploading={uploading}
              upload_progress={upload_progress}
              notice={notice}
              on_deleted={async (id) => {
                set_exams((current) => current.filter((exam) => exam.id !== id));
                set_calendar((current) => ({
                  ...current,
                  exams: current.exams.filter((exam) => exam.id !== id),
                }));
                await refresh();
              }}
            />
          )}
        </main>
      )}

      {route === "/medications" && (
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
          ) : (
            <MedicationsView
              medications={medications}
              on_back={() => navigate("/")}
              on_changed={refresh}
              on_deleted={async (id) => {
                set_medications((current) => current.filter((med) => med.id !== id));
                set_calendar((current) => ({
                  ...current,
                  medications: current.medications.filter((med) => med.id !== id),
                }));
                await refresh();
              }}
            />
          )}
        </main>
      )}

      <MedicationModal
        open={modal_open}
        med={editing_med}
        onClose={() => {
          set_modal_open(false);
          set_editing_med(null);
        }}
        on_saved={() => void refresh()}
      />
      <ExamRenameModal
        exam={rename_modal_exam}
        on_close={() => set_rename_modal_exam(null)}
        on_saved={refresh}
      />
      <CalendarItemModal
        item={calendar_item}
        error={calendar_item_error}
        busy={calendar_action_busy}
        on_close={() => set_calendar_item(null)}
        on_edit={edit_calendar_item}
        on_delete={() => void delete_calendar_item()}
        on_download={() => {
          if (calendar_item?.kind === "exam") {
            void download_exam_file(calendar_item.exam);
          }
        }}
      />
    </div>
  );
}
