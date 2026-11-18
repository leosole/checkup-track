export type CalendarItemKind = "exam" | "medication" | "symptom";

export interface CalendarItemRef {
  kind: CalendarItemKind;
  id: number;
}

/** A drawable range: one medication window or one symptom occurrence. */
export interface RangeItem {
  id: string;
  item_id: number;
  kind: "medication" | "symptom";
  label: string;
  start_date: string;
  end_date: string | null;
  ongoing: boolean;
  color: string;
}

export interface Bar {
  id: string;
  item_id: number;
  kind: "medication" | "symptom";
  label: string;
  color: string;
  start_col: number;
  span: number;
  title: string;
  starts_before_label: string | null;
  ends_after_label: string | null;
}

/** First (and last) week row index in which a range's bar appears. */
export interface RowBounds {
  first: number;
  last: number;
}
