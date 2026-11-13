import type { CalendarData } from "../../types";
import { formatDate, parseIso } from "../../date-utils";
import type { Bar, RangeItem, RowBounds } from "./types";

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

/** Every symptom bar shares one color so the timeline stays readable. */
export const SYMPTOM_COLOR = "#f43f5e";

/** Color a medication bar is drawn with (saved color, else the palette). */
export function medicationColor(
  medication: CalendarData["medications"][number],
  index: number,
): string {
  return medication.color ?? MED_COLORS[index % MED_COLORS.length];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Month/day label used on a bar that runs past the edge of a week row. */
export function shortDate(iso: string): string {
  return parseIso(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Medication windows as generic drawable ranges. */
export function medicationRanges(
  medications: CalendarData["medications"],
): RangeItem[] {
  return medications.map((medication, index) => ({
    id: `medication-${medication.id}`,
    item_id: medication.id,
    kind: "medication",
    label: medication.name,
    start_date: medication.start_date,
    end_date: medication.end_date,
    ongoing: medication.end_date === null,
    color: medicationColor(medication, index),
  }));
}

/** Symptom occurrences as generic drawable ranges (one bar per occurrence). */
export function symptomRanges(
  symptoms: CalendarData["symptoms"],
): RangeItem[] {
  // An ongoing symptom is drawn up to today, not into the future.
  const today = todayIso();
  return symptoms.map((symptom) => ({
    id: `symptom-${symptom.id}`,
    item_id: symptom.id,
    kind: "symptom",
    label: symptom.title,
    start_date: symptom.start_date,
    end_date: symptom.end_date ?? today,
    ongoing: symptom.end_date === null,
    color: SYMPTOM_COLOR,
  }));
}

function overlapsRow(
  item: RangeItem,
  row_start: Date,
  row_end: Date,
): boolean {
  const item_start = parseIso(item.start_date);
  const item_end = item.end_date ? parseIso(item.end_date) : null;
  if (item_start > row_end) return false;
  if (item_end && item_end < row_start) return false;
  return true;
}

/**
 * Which week rows each range appears in, so the start/end boundary can be
 * flagged on the first and last row of the view rather than on every row.
 */
export function rowBounds(
  items: RangeItem[],
  weeks: Date[][],
): Map<string, RowBounds> {
  const bounds = new Map<string, RowBounds>();
  for (const item of items) {
    weeks.forEach((week, week_index) => {
      if (!overlapsRow(item, week[0], week[6])) return;
      const existing = bounds.get(item.id);
      if (existing) existing.last = week_index;
      else bounds.set(item.id, { first: week_index, last: week_index });
    });
  }
  return bounds;
}

/** Assign non-overlapping rows per range within a visible week row. */
export function barsForWeek(
  items: RangeItem[],
  week_days: Date[],
  week_index: number,
  bounds: Map<string, RowBounds>,
): Bar[][] {
  const row_start = week_days[0];
  const row_end = week_days[6];
  const lanes: Bar[][] = [];
  items.forEach((item) => {
    const item_start = parseIso(item.start_date);
    const item_end = item.end_date ? parseIso(item.end_date) : null;
    // Does the range overlap this week row at all?
    if (item_start > row_end) return;
    if (item_end && item_end < row_start) return;

    const start_col = item_start < row_start ? 0 : item_start.getDay();
    const end_col = item_end && item_end < row_end ? item_end.getDay() : 6;
    const span = end_col - start_col + 1;
    if (span <= 0) return;

    // The real boundaries are outside this view: mark them on the first row
    // (start date) and the last row (end date) the range is drawn in.
    const row_bounds = bounds.get(item.id);
    const starts_before = item_start < row_start && row_bounds?.first === week_index;
    const ends_after =
      item_end !== null && item_end > row_end && row_bounds?.last === week_index;

    const bar: Bar = {
      id: item.id,
      item_id: item.item_id,
      kind: item.kind,
      label: item.label,
      color: item.color,
      start_col,
      span,
      title: `${item.label} — ${formatDate(item.start_date)} to ${
        item.ongoing || !item.end_date
          ? "ongoing"
          : formatDate(item.end_date)
      }`,
      starts_before_label: starts_before ? shortDate(item.start_date) : null,
      ends_after_label:
        ends_after && item.end_date ? shortDate(item.end_date) : null,
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
