import { useMemo } from "react";
import {
  WEEKDAY_LABELS,
  isSameDay,
  monthGrid,
  toIso,
} from "../../date-utils";
import { DEFAULT_EXAM_COLOR, barsForWeek, rowBounds } from "./bars";
import { LANE_HEIGHT, RangeLanes } from "./range-lanes";
import type { MonthBoardProps } from "./types";

/**
 * One month of the calendar: weekday header, the week rows and the range lanes
 * overlaid inside their cells. Rendered more than once while a month slides.
 */
export function MonthBoard({
  cursor,
  exams_by_day,
  medication_items,
  symptom_items,
  on_click,
  on_day_click,
}: MonthBoardProps) {
  const weeks = useMemo(() => {
    const days = monthGrid(cursor);
    const rows: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      rows.push(days.slice(index, index + 7));
    }
    return rows;
  }, [cursor]);

  const med_bounds = useMemo(
    () => rowBounds(medication_items, weeks),
    [medication_items, weeks],
  );
  const symptom_bounds = useMemo(
    () => rowBounds(symptom_items, weeks),
    [symptom_items, weeks],
  );

  const today = new Date();

  return (
    <>
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
          const lanes = [
            ...barsForWeek(medication_items, week, week_index, med_bounds),
            ...barsForWeek(symptom_items, week, week_index, symptom_bounds),
          ];
          // The lanes sit at the bottom of the cells, below the exams listed there.
          const lane_space = lanes.length * LANE_HEIGHT + 6;
          return (
            <div
              key={week_index}
              className="relative grid grid-cols-7 border-b border-gray-200 last:border-b-0 dark:border-gray-800"
            >
              {week.map((day) => {
                const iso = toIso(day);
                const in_month = day.getMonth() === cursor.getMonth();
                const is_today = isSameDay(day, today);
                const exams = exams_by_day.get(iso) ?? [];
                const badge_label =
                  exams.length === 1
                    ? `View ${exams[0].title}`
                    : `View ${exams.length} exams from this day`;
                return (
                  <div
                    key={iso}
                    style={lane_space > 0 ? { paddingBottom: lane_space } : undefined}
                    className={[
                      "relative flex min-h-[76px] min-w-0 flex-col border-r border-gray-200 p-1.5 last:border-r-0 dark:border-gray-800",
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

                    {/* Small screens: one compact badge; a lone exam opens directly. */}
                    {exams.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          exams.length === 1
                            ? on_click({ kind: "exam", id: exams[0].id })
                            : on_day_click({ date: iso, exams })
                        }
                        title={badge_label}
                        aria-label={badge_label}
                        className="mt-1 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-100 sm:hidden dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30 dark:hover:bg-brand-500/25"
                      >
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: DEFAULT_EXAM_COLOR }}
                        />
                        <span className="tabular-nums">{exams.length}</span>
                      </button>
                    )}

                    {/* Large screens: the exams themselves, each opening its details. */}
                    {exams.length > 0 && (
                      <ul className="mt-1 hidden min-w-0 flex-col gap-0.5 sm:flex">
                        {exams.map((exam) => (
                          <li key={exam.id} className="min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                on_click({ kind: "exam", id: exam.id })
                              }
                              title={exam.title}
                              aria-label={`View ${exam.title}`}
                              className="flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-500/15"
                            >
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: DEFAULT_EXAM_COLOR }}
                              />
                              <span className="min-w-0 truncate">
                                {exam.title}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}

              {/* Range bars spanning exact active date boundaries, inside the cells */}
              <RangeLanes lanes={lanes} on_select={on_click} />
            </div>
          );
        })}
      </div>
    </>
  );
}
