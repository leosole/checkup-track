import type { CalendarData } from "../../types";

export interface CalendarGridProps {
  data: CalendarData;
  /** Show the selected exam or medication details. */
  onClick: (item: { kind: "exam" | "medication"; id: number }) => void;
}

export interface Bar {
  id: string;
  medication_id: number;
  label: string;
  color: string;
  /** column index (0-6) where the bar starts inside this week row */
  start_col: number;
  /** how many columns the bar covers in this row */
  span: number;
  /** tooltip describing the full active range */
  title: string;
  /** regimen began before this row; carries the formatted start date */
  starts_before_label: string | null;
  /** regimen ends after this row; carries the formatted end date */
  ends_after_label: string | null;
}

/** First (and last) week row index in which a medication's bar appears. */
export interface MedRowBounds {
  first: number;
  last: number;
}
