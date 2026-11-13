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
