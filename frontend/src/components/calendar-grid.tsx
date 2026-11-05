import { useMemo, useState } from "react";
import type { CalendarData } from "../api-client";
import {
  WEEKDAY_LABELS,
  add_months,
  format_month_label,
  is_same_day,
  month_grid,
  parse_iso,
  start_of_month,
  to_iso,
} from "../date-utils";
import { Badge, Card } from "./ui/badge";
import { Button } from "./ui/button";

interface CalendarGridProps {
  data: CalendarData;
  /** Show the selected exam or medication details. */
  on_exam_click?: (exam_id: number) => void;
  on_medication_click?: (medication_id: number) => void;
}

interface Bar {
  id: string;
  medication_id: number;
  label: string;
  color: string;
  /** column index (0-6) where the bar starts inside this week row */
  start_col: number;
  /** how many columns the bar covers in this row */
  span: number;
}

const MED_COLORS = [
  "bg-brand-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
];

export function CalendarGrid({
  data,
  on_exam_click,
  on_medication_click,
}: CalendarGridProps) {
  const [cursor, set_cursor] = useState(() => start_of_month(new Date()));

  const days = useMemo(() => month_grid(cursor), [cursor]);
  const weeks = useMemo(() => {
    const rows: (typeof days)[] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [days]);

  const exams_by_day = useMemo(() => {
    const map = new Map<string, CalendarData["exams"]>();
    for (const exam of data.exams) {
      const list = map.get(exam.date) ?? [];
      list.push(exam);
      map.set(exam.date, list);
    }
    return map;
  }, [data.exams]);

  const today = new Date();

  /** Assign non-overlapping rows per medication within a visible week row. */
  function bars_for_week(week_days: Date[]): Bar[][] {
    const row_start = week_days[0];
    const row_end = week_days[6];
    const lanes: Bar[][] = [];
    data.medications.forEach((med, index) => {
      const med_start = parse_iso(med.start_date);
      const med_end = med.end_date ? parse_iso(med.end_date) : null;
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

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Health calendar
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Exam days and active medication windows in one timeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => set_cursor(add_months(cursor, -1))}
            className="rounded-lg bg-white p-2 text-gray-500 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <span className="min-w-[10.5rem] text-center text-sm font-semibold text-gray-900 dark:text-white">
            {format_month_label(cursor)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => set_cursor(add_months(cursor, 1))}
            className="rounded-lg bg-white p-2 text-gray-500 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => set_cursor(start_of_month(new Date()))}
          >
            Today
          </Button>
        </div>
      </div>

      <div className="px-3 pb-4 pt-3 sm:px-5">
        <div className="grid grid-cols-7">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg ring-1 ring-gray-200 dark:ring-gray-800">
          {weeks.map((week, week_index) => {
            const lanes = bars_for_week(week);
            const lane_height = 20;
            return (
              <div
                key={week_index}
                className="grid grid-cols-7 border-b border-gray-200 last:border-b-0 dark:border-gray-800"
              >
                {week.map((day) => {
                  const iso = to_iso(day);
                  const in_month = day.getMonth() === cursor.getMonth();
                  const is_today = is_same_day(day, today);
                  const exams = exams_by_day.get(iso) ?? [];
                  return (
                    <div
                      key={iso}
                      className={[
                        "relative min-h-[76px] border-r border-gray-200 p-1.5 last:border-r-0 dark:border-gray-800",
                        in_month
                          ? "bg-white dark:bg-gray-900"
                          : "bg-gray-50/70 dark:bg-gray-950/60",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                          is_today
                            ? "bg-brand-600 text-white"
                            : in_month
                              ? "text-gray-700 dark:text-gray-300"
                              : "text-gray-400 dark:text-gray-600",
                        ].join(" ")}
                      >
                        {day.getDate()}
                      </span>
                      {exams.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {exams.slice(0, 2).map((exam) => (
                            <button
                              key={exam.id}
                              type="button"
                              onClick={() => on_exam_click?.(exam.id)}
                              title={`View details — ${exam.title}`}
                              className="flex w-full items-center gap-1 truncate text-left text-[10px] font-medium text-brand-700 hover:underline dark:text-brand-300"
                            >
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400" />
                              <span className="truncate">{exam.title}</span>
                            </button>
                          ))}
                          {exams.length > 2 && (
                            <span className="pl-2.5 text-[10px] text-gray-400 dark:text-gray-500">
                              +{exams.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Medication range bars spanning exact active date boundaries */}
                {lanes.length > 0 && (
                  <div
                    className="col-span-7 relative border-t border-dashed border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-950/40"
                    style={{ height: lanes.length * lane_height + 8 }}
                  >
                    {lanes.map((lane, lane_index) =>
                      lane.map((bar) => (
                        <button
                          type="button"
                          key={bar.id}
                          onClick={() => on_medication_click?.(bar.medication_id)}
                          title={`${bar.label} — active across this week`}
                          aria-label={`${bar.label}, medication details`}
                          className={`absolute flex h-4 items-center rounded-full px-2 text-[10px] font-semibold text-white shadow-sm ${bar.color}`}
                          style={{
                            top: lane_index * lane_height + 4,
                            left: `calc(${(bar.start_col / 7) * 100}% + 3px)`,
                            width: `calc(${(bar.span / 7) * 100}% - 6px)`,
                          }}
                        >
                          <span className="truncate">{bar.label}</span>
                        </button>
                      )),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            Exam performed (click for details)
          </span>
          {data.medications.slice(0, 6).map((med, index) => (
            <span key={med.id} className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-4 rounded-full ${MED_COLORS[index % MED_COLORS.length]}`}
              />
              {med.name}
            </span>
          ))}
          {data.medications.length > 6 && (
            <Badge tone="gray">+{data.medications.length - 6} more</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
