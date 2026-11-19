import type { CalendarData } from "../../types";

export type CalendarItemKind = "exam" | "medication" | "symptom";

export interface CalendarItemRef {
  kind: CalendarItemKind;
  id: number;
}

export interface CalendarGridProps {
  data: CalendarData;
  /** Show the selected exam, medication or symptom details. */
  onClick: (item: CalendarItemRef) => void;
  /** Open the list of exams made on that day. */
  on_day_click: (day: DayExams) => void;
}

/** Which way the calendar moved: the direction the outgoing month leaves in. */
export type MonthDirection = "next" | "prev";

/** A requested month change plus the snapshot of the month leaving the view. */
export interface LeavingMonth {
  cursor: Date;
  direction: MonthDirection;
}

/** The exams of one day, shown by the day list modal. */
export interface DayExams {
  date: string;
  exams: CalendarData["exams"];
}

export interface MonthBoardProps {
  cursor: Date;
  exams_by_day: Map<string, CalendarData["exams"]>;
  medication_items: RangeItem[];
  symptom_items: RangeItem[];
  /** Show the selected medication or symptom details. */
  on_click: (item: CalendarItemRef) => void;
  /** Open the list of exams made on that day. */
  on_day_click: (day: DayExams) => void;
}

export interface DayExamListProps {
  exams: DayExams["exams"];
  on_select_exam: (exam_id: number) => void;
}

export interface YearPickerProps {
  year: number;
  on_select: (year: number) => void;
}

export interface MonthPickerProps {
  cursor: Date;
  /** Snapshot of the month leaving the view while it animates out. */
  leaving: LeavingMonth | null;
  direction: MonthDirection;
  on_select: (month: number) => void;
}

/** A drawable range: one medication window or one symptom occurrence. */
export interface RangeItem {
  id: string;
  item_id: number;
  kind: "medication" | "symptom";
  label: string;
  start_date: string;
  end_date: string | null;
  /** True when the range has no real end date (bars stop at today). */
  ongoing: boolean;
  color: string;
}

export interface Bar {
  id: string;
  item_id: number;
  kind: "medication" | "symptom";
  label: string;
  color: string;
  /** column index (0-6) where the bar starts inside this week row */
  start_col: number;
  /** how many columns the bar covers in this row */
  span: number;
  /** tooltip describing the full active range */
  title: string;
  /** range began before this row; carries the formatted start date */
  starts_before_label: string | null;
  /** range ends after this row; carries the formatted end date */
  ends_after_label: string | null;
}

/** First (and last) week row index in which a range's bar appears. */
export interface RowBounds {
  first: number;
  last: number;
}

export interface RangeLanesProps {
  lanes: Bar[][];
  on_select: (item: CalendarItemRef) => void;
}
