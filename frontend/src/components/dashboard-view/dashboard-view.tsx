import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "../ui/button";
import { useNavigate } from "@tanstack/react-router";
import {
  api,
  type CalendarData,
  type Exam,
  type Medication,
} from "../../api-client";
import { use_auth } from "../../auth-context";
import { apply_theme, init_theme, type Theme } from "../../theme";
import {
  has_marker,
  use_plot_markers,
} from "../analytics-chart/marker-selection";
import {
  CalendarItemModal,
  type CalendarSelection,
} from "../modal/calendar-item-modal";
import { ExamRenameModal } from "../modal/exam-rename-modal";
import { ManualExamModal } from "../modal/manual-exam-modal";
import { MedicationModal } from "../modal/medication-modal";
import { UploadExamModal } from "../modal/upload-exam-modal";
import { DashboardHeader } from "./header";
import type {
  DashboardOverviewActions,
  DashboardOverviewData,
} from "./overview";
import type { DashboardRoute } from "./types";

export interface DashboardRouteContent {
  overview_data: DashboardOverviewData;
  overview_actions: DashboardOverviewActions;    exams: {
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
    uploading: boolean;
    upload_progress: number;
    notice: { kind: "ok" | "err"; text: string } | null;
  };
  medications: {
    medications: Medication[];
    on_back: () => void;
    on_changed: () => Promise<void>;
    on_deleted: (id: number) => Promise<void>;
  };
  loading: boolean;
  on_back: () => void;
}

export function DashboardLayout({
  route,
  children,
}: {
  route: DashboardRoute;
  children: (content: DashboardRouteContent) => ReactNode;
}) {
  const { user, sign_out } = use_auth();
  const router_navigate = useNavigate();
  const [exams, set_exams] = useState<Exam[]>([]);
  const [medications, set_medications] = useState<Medication[]>([]);
  const [calendar_item, set_calendar_item] = useState<CalendarSelection | null>(
    null,
  );
  const [calendar_item_error, set_calendar_item_error] = useState<
    string | null
  >(null);
  const [calendar_action_busy, set_calendar_action_busy] = useState(false);
  const [rename_modal_exam, set_rename_modal_exam] = useState<Exam | null>(
    null,
  );
  const [manual_exam, set_manual_exam] = useState<Exam | null>(null);
  const [calendar, set_calendar] = useState<CalendarData>({
    exams: [],
    medications: [],
  });
  const [search_query, set_search_query] = useState("");
  const [search_results, set_search_results] = useState<Exam[] | null>(null);
  const [searching, set_searching] = useState(false);
  const [loading, set_loading] = useState(true);
  const [load_error, set_load_error] = useState<string | null>(null);
  const [upload_progress, _set_upload_progress] = useState(0);
  const [uploading, set_uploading] = useState(false);

  const [retrying_exam_id, set_retrying_exam_id] = useState<number | null>(
    null,
  );
  const [retry_error, _set_retry_error] = useState<string | null>(null);
  const [exam_name, set_exam_name] = useState("");
  const [notice, set_notice] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [modal_open, set_modal_open] = useState(false);
  const [editing_med, set_editing_med] = useState<Medication | null>(null);
  const [upload_exam, set_upload_exam] = useState<Exam | null>(null);
  const [renaming_id, set_renaming_id] = useState<number | null>(null);
  const [rename_value, set_rename_value] = useState("");
  const [theme, set_theme] = useState<Theme>(() => init_theme());
  const { selected: plot_markers, toggle: toggle_plot_marker } =
    use_plot_markers();

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
      set_load_error(
        err instanceof Error ? err.message : "Failed to load data.",
      );
    } finally {
      set_loading(false);
    }
  }, []);

  useEffect(() => {
    if (route !== "/profile") void refresh();
  }, [refresh, route]);

  const has_active_extractions = exams.some(
    (exam) =>
      exam.processing?.status === "queued" ||
      exam.processing?.status === "processing",
  );

  useEffect(() => {
    if (!has_active_extractions || route === "/profile") return;
    let active = true;
    const poll = () => {
      void api
        .list_exams()
        .then((updated) => {
          if (active) {
            set_exams(updated);
            set_calendar((current) => ({
              ...current,
              exams: updated.map((exam) => ({
                id: exam.id,
                title: exam.title,
                date: exam.date_performed,
              })),
            }));
          }
        })
        .catch(() => undefined);
      const query = search_query.trim();
      if (query) {
        void api
          .search_exams(query)
          .then((updated) => {
            if (active) set_search_results(updated);
          })
          .catch(() => undefined);
      }
    };
    const interval = window.setInterval(poll, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [has_active_extractions, route, search_query]);

  function navigate(next_route: DashboardRoute) {
    void router_navigate({ to: next_route });
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

  // Clicking a marker in any exam card or the exam modal toggles its series.
  function toggle_marker(name: string) {
    const plotted = has_marker(plot_markers, name);
    toggle_plot_marker(name);
    set_notice({
      kind: "ok",
      text: plotted
        ? `“${name}” removed from the trend plot.`
        : `“${name}” added to the trend plot.`,
    });
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
      const stem = exam.title
        .replace(/[^A-Za-z0-9._-]+/g, "_")
        .replace(/^[_\.]+|[_\.]+$/g, "");
      anchor.href = url;
      anchor.download = `${stem || "exam"}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      set_calendar_item_error(
        err instanceof Error ? err.message : "Could not download the PDF.",
      );
    } finally {
      set_calendar_action_busy(false);
    }
  }

  async function delete_calendar_item() {
    if (!calendar_item || !user?.capabilities.delete_records) return;
    const item_name =
      calendar_item.kind === "exam"
        ? calendar_item.exam.title
        : calendar_item.medication.name;
    const confirmation =
      calendar_item.kind === "exam"
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
          medications: current.medications.filter(
            (med) => med.id !== medication_id,
          ),
        }));
      }
      set_calendar_item(null);
      await refresh();
    } catch (err) {
      set_calendar_item_error(
        err instanceof Error ? err.message : "Could not delete the item.",
      );
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

  function keep_pdf_only() {
    if (manual_exam) {
      set_notice({
        kind: "ok",
        text: `Saved “${manual_exam.title}” as a PDF-only exam in your calendar.`,
      });
    }
    set_manual_exam(null);
  }

  async function submit_rename(e: FormEvent, exam: Exam) {
    e.preventDefault();
    const value = rename_value.trim();
    if (!value || value === exam.title) {
      set_renaming_id(null);
      return;
    }
    try {
      await api.update_exam(exam.id, { title: value });
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
    if (!user?.capabilities.delete_records) return;
    if (
      !window.confirm(
        `Delete "${exam.title}" and its uploaded PDF? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await api.delete_exam(exam.id);
      set_exams((current) => current.filter((item) => item.id !== exam.id));
      set_search_results(
        (current) => current?.filter((item) => item.id !== exam.id) ?? null,
      );
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

  async function retry_exam(id: number) {
    if (!user?.capabilities.retry_extraction) return;
    set_retrying_exam_id(id);
    try {
      const updated = await api.retry_exam_extraction(id);
      set_exams((current) =>
        current.map((exam) => (exam.id === id ? updated : exam)),
      );
      set_search_results(
        (current) =>
          current?.map((exam) => (exam.id === id ? updated : exam)) ?? null,
      );
    } catch (err) {
      set_notice({
        kind: "err",
        text:
          err instanceof Error ? err.message : "Could not retry extraction.",
      });
    } finally {
      set_retrying_exam_id(null);
    }
  }

  const displayed = search_query.trim()
    ? (search_results ?? [])
    : exams.slice(0, 5);

  const abnormal_count = exams.reduce(
    (sum, exam) => sum + exam.biomarkers.filter((b) => b.is_abnormal).length,
    0,
  );
  const active_meds = medications.filter(
    (m) => !m.end_date || m.end_date >= new Date().toISOString().slice(0, 10),
  ).length;
  const on_back = () => navigate("/");
  const content: DashboardRouteContent = {
    overview_data: {
      route,
      exams,
      medications,
      calendar,
      displayed,
      loading,
      load_error,
      uploading,
      upload_progress,
      exam_name,
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
    },
    overview_actions: {
      on_upload: () => set_upload_exam((current) => (current ? null : null)),
      on_add_medication: () => {
        if (!user?.capabilities.create_records) return;
        set_editing_med(null);
        set_modal_open(true);
      },
      on_exam_name_change: set_exam_name,
      on_clear_search: () => set_search_query(""),
      on_navigate: navigate,
      on_show_calendar_exam: show_calendar_exam,
      on_show_calendar_medication: show_calendar_medication,
      on_submit_rename: submit_rename,
      on_cancel_rename: () => set_renaming_id(null),
      on_start_rename: (exam) => {
        set_renaming_id(exam.id);
        set_rename_value(exam.title);
      },
      on_rename_value_change: set_rename_value,
      on_delete_exam: delete_exam,
      on_retry_exam: (id) => void retry_exam(id),
      retry_error,
      on_open_exam_pdf: (id) => void open_exam_pdf(id),
      on_toggle_plot_marker: toggle_marker,
      on_edit_medication: (medication) => {
        set_editing_med(medication);
        set_modal_open(true);
      },
      on_delete_medication: async (medication) => {
        if (!user?.capabilities.delete_records) return;
        try {
          await api.delete_medication(medication.id);
          await refresh();
        } catch (err) {
          set_notice({
            kind: "err",
            text: err instanceof Error ? err.message : "Delete failed.",
          });
        }
      },
    },
    exams: {
      exams,
      on_back,
      on_open_pdf: (id) => void open_exam_pdf(id),
      on_select_exam: (exam) => show_calendar_exam(exam.id),
      on_edit: (exam) => set_rename_modal_exam(exam),
      on_deleted: async (id) => {
        set_exams((current) => current.filter((exam) => exam.id !== id));
        set_calendar((current) => ({
          ...current,
          exams: current.exams.filter((exam) => exam.id !== id),
        }));
        await refresh();
      },
      on_upload: () => set_upload_exam((current) => (current ? null : null)),
      on_retry_exam: (id) => void retry_exam(id),
      retrying_exam_id,
      retry_error,
      uploading,
      upload_progress,
      notice,
    },
    medications: {
      medications,
      on_back,
      on_changed: refresh,
      on_deleted: async (id) => {
        set_medications((current) =>
          current.filter((medication) => medication.id !== id),
        );
        set_calendar((current) => ({
          ...current,
          medications: current.medications.filter(
            (medication) => medication.id !== id,
          ),
        }));
        await refresh();
      },
    },
    loading,
    on_back,
  };    return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {user?.capabilities.create_records && (
        <Button
          type="button"
          onClick={() => set_upload_exam((current) => (current ? null : null))}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm bg-brand-600 hover:bg-brand-700 transition focus-visible:outline-brand-600"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
            <path
              fillRule="evenodd"
              d="M4.22 14.78a.75.75 0 011.06 0L8.5 17.94l3.22-3.16a.75.75 0 111.06 1.06l-4.5-4.5a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
          Upload lab report
        </Button>
      )}
      <DashboardHeader
        user={user}
        route={route}
        search_query={search_query}
        searching={searching}
        theme={theme}
        on_search_query_change={set_search_query}
        on_navigate={navigate}
        on_toggle_theme={toggle_theme}
        on_sign_out={sign_out}
      />

      {children(content)}

      <UploadExamModal
        open={upload_exam !== null}
        on_close={() => set_upload_exam(null)}
        on_saved={(saved) => {
          set_upload_exam(null);
          set_uploading(false);
          set_notice({
            kind: "ok",
            text: `“${saved.title}” uploaded. Extraction queued.`,
          });
          void refresh();
        }}
      />
      <MedicationModal
        open={
          modal_open &&
          (editing_med !== null || Boolean(user?.capabilities.create_records))
        }
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
      <ManualExamModal
        exam={user?.capabilities.edit_results ? manual_exam : null}
        on_close={keep_pdf_only}
        on_keep_pdf={keep_pdf_only}
        on_saved={(saved) => {
          set_manual_exam(null);
          set_notice({
            kind: "ok",
            text: `“${saved.title}” saved with manual results.`,
          });
          void refresh();
        }}
      />
      <CalendarItemModal
        item={calendar_item}
        error={calendar_item_error}
        busy={calendar_action_busy}
        plot_markers={plot_markers}
        on_toggle_marker={toggle_marker}
        on_close={() => set_calendar_item(null)}
        on_edit={edit_calendar_item}
        on_delete={() => void delete_calendar_item()}
        on_download={() => {
          if (calendar_item?.kind === "exam") {
            void download_exam_file(calendar_item.exam);
          }
        }}
        on_retry_exam={(id) => void retry_exam(id)}
        retry_error={retry_error}
      />
    </div>
  );
}
