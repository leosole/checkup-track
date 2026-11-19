import { useEffect, useRef, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import { usePresence } from "../ui/use-presence";
import type { MonthPickerProps } from "./types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * The animated month name in the calendar header. Clicking it opens a month
 * list, the same way the year next to it opens a year list.
 */
export function MonthPicker({
  cursor,
  leaving,
  direction,
  on_select,
}: MonthPickerProps) {
  const [open, set_open] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const { show, leaving: closing } = usePresence(open, 120);
  const month = cursor.getMonth();
  const label = cursor.toLocaleDateString("en-US", { month: "long" });

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!container.current?.contains(event.target as Node)) set_open(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") set_open(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change month, currently ${label}`}
        onClick={() => set_open((value) => !value)}
        className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 hover:text-brand-700 dark:text-white dark:hover:bg-gray-800 dark:hover:text-brand-300"
      >
        {/* Slides with the board, in the same direction. */}
        <span className="relative inline-block w-20 overflow-hidden text-center">
          {leaving && (
            <span
              aria-hidden="true"
              className={[
                "pointer-events-none absolute inset-0 whitespace-nowrap motion-reduce:animate-none",
                leaving.direction === "next"
                  ? "animate-month-out-left"
                  : "animate-month-out-right",
              ].join(" ")}
            >
              {leaving.cursor.toLocaleDateString("en-US", { month: "long" })}
            </span>
          )}
          <span
            key={cursor.getTime()}
            className={[
              "block whitespace-nowrap motion-reduce:animate-none",
              direction === "next"
                ? "animate-month-in-right"
                : "animate-month-in-left",
            ].join(" ")}
          >
            {label}
          </span>
        </span>
        <HiChevronDown
          aria-hidden="true"
          className={[
            "h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none dark:text-gray-500",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {show && (
        <div className="absolute left-0 top-full z-40 mt-1 w-44">
          <div
            className={[
              "rounded-lg bg-white p-1 shadow-untitled-lg ring-1 ring-gray-900/5 motion-reduce:animate-none dark:bg-gray-900 dark:shadow-none dark:ring-white/10",
              closing ? "animate-dropdown-out" : "animate-dropdown-in",
            ].join(" ")}
          >
            <div
              role="listbox"
              aria-label="Select month"
              className="grid grid-cols-3 gap-0.5"
            >
            {MONTH_LABELS.map((name, index) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={index === month}
                onClick={() => {
                  set_open(false);
                  on_select(index);
                }}
                className={[
                  "rounded-md px-1 py-1.5 text-center text-xs font-medium transition-colors",
                  index === month
                    ? "bg-brand-600 text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
                ].join(" ")}
              >
                {name}
              </button>
            ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}