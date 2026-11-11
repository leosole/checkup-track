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
}
