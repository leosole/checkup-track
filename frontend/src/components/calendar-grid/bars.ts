import type { CalendarData } from "../../types";
import { formatDate, parseIso } from "../../date-utils";
import type { Bar, MedRowBounds } from "./types";

export const MED_COLORS = [
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#6366f1",
  "#14b8a6",
  "#f97316",
];

/** Used when an exam has no saved calendar color. */
export const DEFAULT_EXAM_COLOR = "#8b5cf6";

/** Color a medication bar is drawn with (saved color, else the palette). */
export function medicationColor(
  medication: CalendarData["medications"][number],
  index: number,
): string {
  return medication.color ?? MED_COLORS[index % MED_COLORS.length];
}

/** Month/day label used on a bar that runs past the edge of a week row. */
export function shortDate(iso: string): string {
  return parseIso(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function overlapsRow(
  med: CalendarData["medications"][number],
  row_start: Date,
  row_end: Date,
): boolean {
  const med_start = parseIso(med.start_date);
  const med_end = med.end_date ? parseIso(med.end_date) : null;
  if (med_start > row_end) return false;
  if (med_end && med_end < row_start) return false;
  return true;
}

/**
 * Which week rows each medication appears in, so the start/end boundary can be
 * flagged on the first and last row of the view rather than on every row.
 */
export function medRowBounds(
  medications: CalendarData["medications"],
  weeks: Date[][],
): Map<number, MedRowBounds> {
  const bounds = new Map<number, MedRowBounds>();
  for (const med of medications) {
    weeks.forEach((week, week_index) => {
      if (!overlapsRow(med, week[0], week[6])) return;
      const existing = bounds.get(med.id);
      if (existing) existing.last = week_index;
      else bounds.set(med.id, { first: week_index, last: week_index });
    });
  }
  return bounds;
}

/** Assign non-overlapping rows per medication within a visible week row. */
export function barsForWeek(
  medications: CalendarData["medications"],
  week_days: Date[],
  week_index: number,
  bounds: Map<number, MedRowBounds>,
): Bar[][] {
  const row_start = week_days[0];
  const row_end = week_days[6];
  const lanes: Bar[][] = [];
  medications.forEach((med, index) => {
    const med_start = parseIso(med.start_date);
    const med_end = med.end_date ? parseIso(med.end_date) : null;
    // Does the regimen overlap this week row at all?
    if (med_start > row_end) return;
    if (med_end && med_end < row_start) return;

    const start_col = med_start < row_start ? 0 : med_start.getDay();
    const end_col = med_end && med_end < row_end ? med_end.getDay() : 6;
    const span = end_col - start_col + 1;
    if (span <= 0) return;

    // The regimen's real boundaries are outside this view: mark them on the
    // first row (start date) and the last row (end date) it is drawn in.
    const row_bounds = bounds.get(med.id);
    const starts_before =
      med_start < row_start && row_bounds?.first === week_index;
    const ends_after = med_end !== null && med_end > row_end && row_bounds?.last === week_index;

    const bar: Bar = {
      id: `${med.id}-${index}`,
      medication_id: med.id,
      label: med.name,
      color: medicationColor(med, index),
      start_col,
      span,
      title: `${med.name} — ${formatDate(med.start_date)} to ${
        med.end_date ? formatDate(med.end_date) : "ongoing"
      }`,
      starts_before_label: starts_before ? shortDate(med.start_date) : null,
      ends_after_label:
        ends_after && med.end_date ? shortDate(med.end_date) : null,
    };

    // Place on the first lane where it doesn't overlap an existing bar.
    let placed = false;
    for (const lane of lanes) {
      const fits = lane.every(
        (b) => b.start_col + b.span <= start_col || start_col + span <= b.start_col,
      );
      if (fits) {
        lane.push(bar);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([bar]);
  });
  return lanes;
}
