import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarData } from "../../types";
import { addMonths, startOfMonth } from "../../date-utils";
import { Card } from "../ui/badge";
import { Button } from "../ui/button";
import { medicationRanges, symptomRanges } from "./bars";
import { MonthBoard } from "./month-board";
import { MonthPicker } from "./month-picker";
import { YearPicker } from "./year-picker";
import type {
  CalendarGridProps,
  LeavingMonth,
  MonthDirection,
} from "./types";

/** Must stay in sync with the --animate-month-* durations in index.css. */
const SLIDE_MS = 300;

export function CalendarGrid({
  data,
  onClick,
  on_day_click,
}: CalendarGridProps) {
  const [cursor, set_cursor] = useState(() => startOfMonth(new Date()));
  const [direction, set_direction] = useState<MonthDirection>("next");
  const [leaving, set_leaving] = useState<LeavingMonth | null>(null);
  const [show_exams, set_show_exams] = useState(true);
  const [show_medications, set_show_medications] = useState(true);
  const [show_symptoms, set_show_symptoms] = useState(true);
  const slide_timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (slide_timer.current !== null) window.clearTimeout(slide_timer.current);
    },
    [],
  );

  const exams_data = show_exams ? data.exams : [];
  const med_items = useMemo(
    () => (show_medications ? medicationRanges(data.medications) : []),
    [show_medications, data.medications],
  );
  const symptom_items = useMemo(
    () => (show_symptoms ? symptomRanges(data.symptoms) : []),
    [show_symptoms, data.symptoms],
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

  /** Move to another month, sliding the outgoing one away from the new one. */
  function goToMonth(next: Date) {
    if (next.getTime() === cursor.getTime()) return;
    const next_direction: MonthDirection =
      next.getTime() < cursor.getTime() ? "prev" : "next";
    set_direction(next_direction);
    set_leaving({ cursor, direction: next_direction });
    set_cursor(next);
    if (slide_timer.current !== null) window.clearTimeout(slide_timer.current);
    slide_timer.current = window.setTimeout(
      () => set_leaving(null),
      SLIDE_MS,
    );
  }

  const nav_button =
    "rounded-lg bg-white p-2 text-gray-500 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200";
  const filter_label =
    "flex cursor-pointer items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300";

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5 dark:border-gray-800">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Health calendar
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Exams, medication windows and symptoms in one timeline
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          {/* Filters keep their own group so the month controls never crowd them. */}
          <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-inset ring-gray-200 sm:w-auto sm:justify-start dark:bg-gray-800/60 dark:ring-gray-700">
            <label className={filter_label}>
              <input
                type="checkbox"
                checked={show_exams}
                onChange={(event) => set_show_exams(event.target.checked)}
                className="h-4 w-4 rounded-sm border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-900"
              />
              Exams
            </label>
            <label className={filter_label}>
              <input
                type="checkbox"
                checked={show_medications}
                onChange={(event) => set_show_medications(event.target.checked)}
                className="h-4 w-4 rounded-sm border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-900"
              />
              Medications
            </label>
            <label className={filter_label}>
              <input
                type="checkbox"
                checked={show_symptoms}
                onChange={(event) => set_show_symptoms(event.target.checked)}
                className="h-4 w-4 rounded-sm border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-900"
              />
              Symptoms
            </label>
          </div>

          <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-start">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => goToMonth(addMonths(cursor, -1))}
              className={nav_button}
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div className="flex items-center justify-center gap-1">
              <MonthPicker
                cursor={cursor}
                leaving={leaving}
                direction={direction}
                on_select={(month) =>
                  goToMonth(new Date(cursor.getFullYear(), month, 1))
                }
              />
              <YearPicker
                year={cursor.getFullYear()}
                on_select={(year) =>
                  goToMonth(new Date(year, cursor.getMonth(), 1))
                }
              />
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => goToMonth(addMonths(cursor, 1))}
              className={nav_button}
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
              onClick={() => goToMonth(startOfMonth(new Date()))}
            >
              Today
            </Button>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden px-3 pb-4 pt-3 sm:px-5">
        {leaving && (
          <div
            aria-hidden="true"
            className={[
              "pointer-events-none absolute inset-x-3 top-3 sm:inset-x-5 motion-reduce:animate-none",
              leaving.direction === "next"
                ? "animate-month-out-left"
                : "animate-month-out-right",
            ].join(" ")}
          >
            <MonthBoard
              cursor={leaving.cursor}
              exams_by_day={exams_by_day}
              medication_items={med_items}
              symptom_items={symptom_items}
              on_click={onClick}
              on_day_click={on_day_click}
            />
          </div>
        )}
        <div
          key={cursor.getTime()}
          className={[
            "motion-reduce:animate-none",
            direction === "next"
              ? "animate-month-in-right"
              : "animate-month-in-left",
          ].join(" ")}
        >
          <MonthBoard
            cursor={cursor}
            exams_by_day={exams_by_day}
            medication_items={med_items}
            symptom_items={symptom_items}
            on_click={onClick}
            on_day_click={on_day_click}
          />
        </div>
      </div>
    </Card>
  );
}
