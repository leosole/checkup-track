import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { notify } from "../ui/toast";
import { api } from "../../api-client";
import type {
  CalendarData,
  Exam,
  MedicationUse,
  SymptomOccurrence,
  User,
} from "../../types";
import { applyTheme, initTheme, type Theme } from "../../theme";
import {
  hasMarker,
  usePlotMarkers,
} from "../analytics-chart/marker-selection";
import type { CalendarSelection } from "../calendar-item-modal";
import type { DashboardRoute } from "./types";

/** All data, dialog and derived state behind the dashboard layout. */
export function useDashboard(route: DashboardRoute, user: User | null) {
  const [exams, set_exams] = useState<Exam[]>([]);
  const [medications, set_medications] = useState<MedicationUse[]>([]);
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
    symptoms: [],
  });
  const [search_query, set_search_query] = useState("");
  const [search_results, set_search_results] = useState<Exam[] | null>(null);
  const [searching, set_searching] = useState(false);
  const [loading, set_loading] = useState(true);
  const [load_error, set_load_error] = useState<string | null>(null);
  const [retrying_exam_id, set_retrying_exam_id] = useState<number | null>(
    null,
  );
  const [retry_error, _set_retry_error] = useState<string | null>(null);
  const [modal_open, set_modal_open] = useState(false);
  const [editing_med, set_editing_med] = useState<MedicationUse | null>(null);
  const [symptom_modal_open, set_symptom_modal_open] = useState(false);
  const [editing_symptom, set_editing_symptom] =
    useState<SymptomOccurrence | null>(null);
  const [upload_exam_open, set_upload_exam_open] = useState(false);
  const [renaming_id, set_renaming_id] = useState<number | null>(null);
  const [rename_value, set_rename_value] = useState("");
  const [theme, set_theme] = useState<Theme>(() => initTheme());
  const { selected: plot_markers, toggle: toggle_plot_marker } =
    usePlotMarkers();

  const refresh = useCallback(async () => {
    try {
      const [exam_list, med_list, cal] = await Promise.all([
        api.listExams(),
        api.listMedications(),
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
        .listExams()
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
          .searchExams(query)
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
        const results = await api.searchExams(q);
        set_search_results(results);
      } catch {
        set_search_results([]);
      } finally {
        set_searching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search_query]);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set_theme(next);
  }

  async function openExamPdf(exam_id: number) {
    try {
      const blob = await api.exam_pdf(exam_id);
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        notify.error(
          "The browser blocked the file tab. Allow pop-ups and retry.",
        );
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Could not open the exam file.",
      );
    }
  }

  function showCalendarExam(exam_id: number) {
    const exam = exams.find((item) => item.id === exam_id);
    if (exam) {
      set_calendar_item_error(null);
      _set_retry_error(null);
      set_calendar_item({ kind: "exam", exam });
    }
  }

  // Clicking a marker in any exam card or the exam modal toggles its series.
  function toggleMarker(name: string) {
    const plotted = hasMarker(plot_markers, name);
    toggle_plot_marker(name);
    notify.success(
      plotted
        ? `“${name}” removed from the trend plot.`
        : `“${name}” added to the trend plot.`,
    );
  }

  function showCalendarSymptom(occurrence_id: number) {
    const symptom = calendar.symptoms.find((item) => item.id === occurrence_id);
    if (symptom) {
      set_calendar_item_error(null);
      _set_retry_error(null);
      set_calendar_item({ kind: "symptom", symptom });
    }
  }

  function showCalendarMedication(medication_id: number) {
    const medication = medications.find((item) => item.id === medication_id);
    if (medication) {
      set_calendar_item_error(null);
      _set_retry_error(null);
      set_calendar_item({ kind: "medication", medication });
    }
  }

  async function downloadExamFile(exam: Exam) {
    set_calendar_action_busy(true);
    set_calendar_item_error(null);
    try {
      const blob = await api.exam_pdf(exam.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stem = exam.title
        .replace(/[^A-Za-z0-9._-]+/g, "_")
        .replace(/^[_\\.]+|[_\\.]+$/g, "");
      anchor.href = url;
      const suffix = exam.pdf_path.split(".").pop()?.toLowerCase();
      const extension = ["pdf", "jpg", "jpeg", "png", "webp"].includes(
        suffix ?? "",
      )
        ? suffix
        : "pdf";
      anchor.download = `${stem || "exam"}.${extension}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      set_calendar_item_error(
        err instanceof Error ? err.message : "Could not download the exam file.",
      );
    } finally {
      set_calendar_action_busy(false);
    }
  }

  async function deleteCalendarItem() {
    if (!calendar_item || !user?.capabilities.delete_records) return;
    const item_name =
      calendar_item.kind === "exam"
        ? calendar_item.exam.title
        : calendar_item.kind === "medication"
          ? calendar_item.medication.name
          : calendar_item.symptom.title;
    const confirmation =
      calendar_item.kind === "exam"
        ? `Delete "${item_name}" and its uploaded PDF? This cannot be undone.`
        : calendar_item.kind === "symptom"
          ? `Delete this "${item_name}" occurrence? This cannot be undone.`
          : `Delete "${item_name}"? This cannot be undone.`;
    if (!window.confirm(confirmation)) return;

    set_calendar_action_busy(true);
    set_calendar_item_error(null);
    try {
      if (calendar_item.kind === "exam") {
        const exam_id = calendar_item.exam.id;
        await api.deleteExam(exam_id);
        set_exams((current) => current.filter((exam) => exam.id !== exam_id));
        set_calendar((current) => ({
          ...current,
          exams: current.exams.filter((exam) => exam.id !== exam_id),
        }));
      } else if (calendar_item.kind === "medication") {
        const use_id = calendar_item.medication.id;
        await api.deleteMedicationUse(use_id);
        set_medications((current) =>
          current.filter((medication) => medication.id !== use_id),
        );
        set_calendar((current) => ({
          ...current,
          medications: current.medications.filter((med) => med.id !== use_id),
        }));
      } else {
        const occurrence_id = calendar_item.symptom.id;
        await api.deleteSymptomOccurrence(occurrence_id);
        set_calendar((current) => ({
          ...current,
          symptoms: current.symptoms.filter(
            (item) => item.id !== occurrence_id,
          ),
        }));
      }
      notify.success(`“${item_name}” deleted.`);
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

  function editCalendarItem() {
    if (!calendar_item) return;
    if (calendar_item.kind === "exam") {
      set_rename_modal_exam(calendar_item.exam);
    } else if (calendar_item.kind === "medication") {
      set_editing_med(calendar_item.medication);
      set_modal_open(true);
    } else {
      set_editing_symptom(calendar_item.symptom);
      set_symptom_modal_open(true);
    }
    set_calendar_item(null);
  }

  function keepPdfOnly() {
    if (manual_exam) {
      notify.success(
        `Saved “${manual_exam.title}” as a PDF-only exam in your calendar.`,
      );
    }
    set_manual_exam(null);
  }

  async function submitRename(e: FormEvent, exam: Exam) {
    e.preventDefault();
    const value = rename_value.trim();
    if (!value || value === exam.title) {
      set_renaming_id(null);
      return;
    }
    try {
      await api.updateExam(exam.id, { title: value });
      set_renaming_id(null);
      await refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Rename failed.");
    }
  }

  async function deleteExam(exam: Exam) {
    if (!user?.capabilities.delete_records) return;
    if (
      !window.confirm(
        `Delete "${exam.title}" and its uploaded PDF? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      await api.deleteExam(exam.id);
      set_exams((current) => current.filter((item) => item.id !== exam.id));
      set_search_results(
        (current) => current?.filter((item) => item.id !== exam.id) ?? null,
      );
      set_calendar((current) => ({
        ...current,
        exams: current.exams.filter((item) => item.id !== exam.id),
      }));
      await refresh();
      notify.success(`“${exam.title}” deleted.`);
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Could not delete the exam.",
      );
    }
  }

  async function deleteMedication(medication: MedicationUse) {
    if (!user?.capabilities.delete_records) return;
    if (
      !window.confirm(
        `Delete this "${medication.name}" course? This cannot be undone.`,
      )
    )
      return;
    try {
      await api.deleteMedicationUse(medication.id);
      set_medications((current) =>
        current.filter((item) => item.id !== medication.id),
      );
      set_calendar((current) => ({
        ...current,
        medications: current.medications.filter(
          (item) => item.id !== medication.id,
        ),
      }));
      await refresh();
      notify.success(`“${medication.name}” deleted.`);
    } catch (err) {
      notify.error(
        err instanceof Error
          ? err.message
          : "Could not delete the medication.",
      );
    }
  }

  async function retryExam(id: number) {
    if (!user?.capabilities.retry_extraction) return;
    set_retrying_exam_id(id);
    _set_retry_error(null);
    try {
      const updated = await api.retryExamExtraction(id);
      set_exams((current) =>
        current.map((exam) => (exam.id === id ? updated : exam)),
      );
      set_search_results(
        (current) =>
          current?.map((exam) => (exam.id === id ? updated : exam)) ?? null,
      );
      set_calendar_item((current) =>
        current?.kind === "exam" && current.exam.id === id
          ? { ...current, exam: updated }
          : current,
      );
    } catch (err) {
      _set_retry_error(
        err instanceof Error ? err.message : "Could not retry extraction.",
      );
      notify.error(
        err instanceof Error ? err.message : "Could not retry extraction.",
      );
    } finally {
      set_retrying_exam_id(null);
    }
  }

  // While the first response for a new term is still in flight the results are
  // null; keep showing the recent exams so the list never flashes empty.
  const displayed = search_query.trim()
    ? (search_results ?? exams.slice(0, 5))
    : exams.slice(0, 5);

  const abnormal_count = exams.reduce(
    (sum, exam) => sum + exam.biomarkers.filter((b) => b.is_abnormal).length,
    0,
  );
  const active_meds = medications.filter(
    (m) => !m.end_date || m.end_date >= new Date().toISOString().slice(0, 10),
  ).length;


  return {
    route,
    // data
    exams,
    set_exams,
    medications,
    set_medications,
    calendar,
    set_calendar,
    loading,
    load_error,
    search_query,
    set_search_query,
    search_results,
    searching,
    displayed,
    abnormal_count,
    active_meds,
    // dialog state
    calendar_item,
    set_calendar_item,
    calendar_item_error,
    calendar_action_busy,
    rename_modal_exam,
    set_rename_modal_exam,
    manual_exam,
    set_manual_exam,
    modal_open,
    set_modal_open,
    editing_med,
    set_editing_med,
    symptom_modal_open,
    set_symptom_modal_open,
    editing_symptom,
    set_editing_symptom,
    upload_exam_open,
    set_upload_exam_open,
    renaming_id,
    set_renaming_id,
    rename_value,
    set_rename_value,
    retrying_exam_id,
    retry_error,
    // ui state
    theme,
    plot_markers,
    // actions
    refresh,
    toggleTheme,
    openExamPdf,
    showCalendarExam,
    showCalendarMedication,
    showCalendarSymptom,
    toggleMarker,
    downloadExamFile,
    deleteCalendarItem,
    editCalendarItem,
    keepPdfOnly,
    submitRename,
    deleteExam,
    deleteMedication,
    retryExam,
  };
}

export type DashboardState = ReturnType<typeof useDashboard>;
