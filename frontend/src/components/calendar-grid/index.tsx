import { useMemo, useState } from "react";
import type { CalendarData } from "../../types";
import {
  WEEKDAY_LABELS,
  addMonths,
  formatMonthLabel,
  isSameDay,
  monthGrid,
  startOfMonth,
  toIso,
} from "../../date-utils";
import { Card } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DEFAULT_EXAM_COLOR,
  barsForWeek,
  medRowBounds,
} from "./bars";
import type { CalendarGridProps } from "./types";

export function CalendarGrid({
  data,
  onClick,
}: CalendarGridProps) {
  const [cursor, set_cursor] = useState(() => startOfMonth(new Date()));
  const [show_exams, set_show_exams] = useState(true);
  const [show_medications, set_show_medications] = useState(true);

  const exams_data = show_exams ? data.exams : [];
  const medications_data = show_medications ? data.medications : [];

  const days = useMemo(() => monthGrid(cursor), [cursor]);
  const weeks = useMemo(() => {
    const rows: (typeof days)[] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [days]);

  const med_bounds = useMemo(
    () => medRowBounds(medications_data, weeks),
    [medications_data, weeks],
  );

  const exams_by_day = useMemo(() => {
    const map = new Map<string, CalendarData["exams"]>();
    for (const exam of exams_data) {
      const list = map.get(exam.date) ?? [];
      list.push(exam);
      map.set(exam.date, list);
    }
    return map;
  }, [exams_data]);

  const today = new Date();

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
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={show_exams}
              onChange={(event) => set_show_exams(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-900"
            />
            Exams
          </label>
          <label className="mr-2 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={show_medications}
              onChange={(event) => set_show_medications(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-900"
            />
            Medications
          </label>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => set_cursor(addMonths(cursor, -1))}
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
            {formatMonthLabel(cursor)}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => set_cursor(addMonths(cursor, 1))}
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
            onClick={() => set_cursor(startOfMonth(new Date()))}
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
            const lanes = barsForWeek(
              medications_data,
              week,
              week_index,
              med_bounds,
            );
            const lane_height = 20;
            return (
              <div
                key={week_index}
                className="grid grid-cols-7 border-b border-gray-200 last:border-b-0 dark:border-gray-800"
              >
                {week.map((day) => {
                  const iso = toIso(day);
                  const in_month = day.getMonth() === cursor.getMonth();
                  const is_today = isSameDay(day, today);
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
                          {exams.map((exam) => (
                            <button
                              key={exam.id}
                              type="button"
                              onClick={() => onClick({ kind: "exam", id: exam.id })}
                              title={`View details — ${exam.title}`}
                              className="flex w-full items-center gap-1 truncate text-left text-[10px] font-medium text-brand-700 hover:underline dark:text-brand-300"
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    exam.color ?? DEFAULT_EXAM_COLOR,
                                }}
                              />
                              <span className="truncate">{exam.title}</span>
                            </button>
                          ))}
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
                          onClick={() =>
                            onClick({ kind: "medication", id: bar.medication_id })
                          }
                          title={bar.title}
                          aria-label={`${bar.label}, medication details`}
                          className="absolute flex h-4 items-center gap-1 overflow-hidden rounded-full px-1.5 text-[10px] font-semibold text-white shadow-sm"
                          style={{
                            backgroundColor: bar.color,
                            top: lane_index * lane_height + 4,
                            left: `calc(${(bar.start_col / 7) * 100}% + 3px)`,
                            width: `calc(${(bar.span / 7) * 100}% - 6px)`,
                          }}
                        >
                          {bar.starts_before_label && (
                            <span className="shrink-0 tabular-nums">
                              ‹ {bar.starts_before_label}
                            </span>
                          )}
                          <span className="min-w-0 truncate">{bar.label}</span>
                          {bar.ends_after_label && (
                            <span className="ml-auto shrink-0 tabular-nums">
                              {bar.ends_after_label} ›
                            </span>
                          )}
                        </button>
                      )),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
