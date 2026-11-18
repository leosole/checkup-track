import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api-client";
import type { CalendarData, Exam, MedicationUse } from "./types";

const MARKERS_KEY = "vitals.trends.markers";

interface DataState {
  exams: Exam[];
  medications: MedicationUse[];
  calendar: CalendarData;
  loading: boolean;
  load_error: string | null;
  plot_markers: string[];
  refresh: () => Promise<void>;
  toggle_marker: (name: string) => void;
}

const DataContext = createContext<DataState | null>(null);

const EMPTY_CALENDAR: CalendarData = {
  exams: [],
  medications: [],
  symptoms: [],
};

function marker_key(spec: string): string {
  return spec.trim().toLowerCase();
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [exams, set_exams] = useState<Exam[]>([]);
  const [medications, set_medications] = useState<MedicationUse[]>([]);
  const [calendar, set_calendar] = useState<CalendarData>(EMPTY_CALENDAR);
  const [loading, set_loading] = useState(true);
  const [load_error, set_load_error] = useState<string | null>(null);
  const [plot_markers, set_plot_markers] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(MARKERS_KEY);
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        if (Array.isArray(parsed)) {
          set_plot_markers(
            parsed.filter((value): value is string => typeof value === "string"),
          );
        }
      } catch {
        // Storage disabled: the selection simply is not persisted.
      }
    })();
  }, []);

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
    void refresh();
  }, [refresh]);

  const has_active_extractions = exams.some(
    (exam) =>
      exam.processing?.status === "queued" ||
      exam.processing?.status === "processing",
  );

  // Poll while extraction runs so results appear without a manual refresh.
  useEffect(() => {
    if (!has_active_extractions) return;
    let active = true;
    const interval = setInterval(() => {
      void api
        .listExams()
        .then((updated) => {
          if (!active) return;
          set_exams(updated);
          set_calendar((current) => ({
            ...current,
            exams: updated.map((exam) => ({
              id: exam.id,
              title: exam.title,
              date: exam.date_performed,
            })),
          }));
        })
        .catch(() => undefined);
    }, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [has_active_extractions]);

  const toggle_marker = useCallback((name: string) => {
    set_plot_markers((current) => {
      const key = marker_key(name);
      const next = current.some((item) => marker_key(item) === key)
        ? current.filter((item) => marker_key(item) !== key)
        : [...current, name.trim()];
      void AsyncStorage.setItem(MARKERS_KEY, JSON.stringify(next)).catch(
        () => undefined,
      );
      return next;
    });
  }, []);

  const value = useMemo<DataState>(
    () => ({
      exams,
      medications,
      calendar,
      loading,
      load_error,
      plot_markers,
      refresh,
      toggle_marker,
    }),
    [
      exams,
      medications,
      calendar,
      loading,
      load_error,
      plot_markers,
      refresh,
      toggle_marker,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used inside a DataProvider");
  }
  return ctx;
}
