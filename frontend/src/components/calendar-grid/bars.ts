import type { CalendarData } from "../../types";
import { parseIso } from "../../date-utils";
import type { Bar } from "./types";

export const MED_COLORS = [
  "bg-brand-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
];

/** Assign non-overlapping rows per medication within a visible week row. */
export function barsForWeek(
  medications: CalendarData["medications"],
  week_days: Date[],
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

    const bar: Bar = {
      id: `${med.id}-${index}`,
      medication_id: med.id,
      label: med.name,
      color: MED_COLORS[index % MED_COLORS.length],
      start_col,
      span,
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
