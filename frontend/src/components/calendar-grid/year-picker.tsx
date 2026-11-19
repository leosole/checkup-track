import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HiChevronDown } from "react-icons/hi2";
import { usePresence } from "../ui/use-presence";
import type { YearPickerProps } from "./types";

/** Years added each time the list is scrolled to one of its ends. */
const CHUNK = 12;
/** Half the opening window, so the selected year starts in the middle. */
const SPAN = 12;
/** Hard bounds, only there to keep the numbers plausible. */
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

/**
 * The year in the month label; opens a scrollable year list. The list opens
 * centred on the selected year and grows a chunk at a time as the user scrolls
 * towards either end, so it never runs out of years.
 */
export function YearPicker({ year, on_select }: YearPickerProps) {
  const [open, set_open] = useState(false);
  const [first, set_first] = useState(year - SPAN);
  const [last, set_last] = useState(year + SPAN);
  const { show, leaving } = usePresence(open, 120);
  const container = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  /** Height before a prepend, used to keep the visible years still. */
  const keep_scroll = useRef<number | null>(null);
  const center_on_open = useRef(false);

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

  // Every opening starts from a fresh window around the selected year.
  useEffect(() => {
    if (!open) return;
    set_first(year - SPAN);
    set_last(year + SPAN);
    center_on_open.current = true;
  }, [open, year]);

  useLayoutEffect(() => {
    const element = list.current;
    if (!open || !element) return;
    if (center_on_open.current) {
      const selected = element.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      );
      if (selected) {
        element.scrollTop =
          selected.offsetTop -
          (element.clientHeight - selected.offsetHeight) / 2;
        center_on_open.current = false;
      }
      return;
    }
    if (keep_scroll.current !== null) {
      const before = keep_scroll.current;
      keep_scroll.current = null;
      element.scrollTop += element.scrollHeight - before;
    }
  });

  function handle_scroll() {
    const element = list.current;
    if (!element) return;
    const { scrollTop, scrollHeight, clientHeight } = element;
    if (scrollTop <= 16 && last < MAX_YEAR) {
      keep_scroll.current = scrollHeight;
      set_last((value) => Math.min(MAX_YEAR, value + CHUNK));
      return;
    }
    if (
      scrollHeight - scrollTop - clientHeight <= 16 &&
      first > MIN_YEAR
    ) {
      set_first((value) => Math.max(MIN_YEAR, value - CHUNK));
    }
  }

  const years: number[] = [];
  for (let value = last; value >= first; value--) years.push(value);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change year, currently ${year}`}
        onClick={() => set_open((value) => !value)}
        className="flex items-center gap-0.5 rounded-md px-1 py-0.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 hover:text-brand-700 dark:text-white dark:hover:bg-gray-800 dark:hover:text-brand-300"
      >
        <span className="tabular-nums">{year}</span>
        <HiChevronDown
          aria-hidden="true"
          className={[
            "h-3.5 w-3.5 text-gray-400 transition-transform duration-200 motion-reduce:transition-none dark:text-gray-500",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {show && (
        <div className="absolute left-1/2 top-full z-40 mt-1 w-44 -translate-x-1/2">
          <div
            className={[
              "rounded-lg bg-white p-1 shadow-untitled-lg ring-1 ring-gray-900/5 motion-reduce:animate-none dark:bg-gray-900 dark:shadow-none dark:ring-white/10",
              leaving ? "animate-dropdown-out" : "animate-dropdown-in",
            ].join(" ")}
          >
            <div
              ref={list}
              role="listbox"
              aria-label="Select year"
              onScroll={handle_scroll}
              className="grid max-h-56 grid-cols-3 gap-0.5 overflow-y-auto overscroll-contain"
            >
            {years.map((value) => (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={value === year}
                onClick={() => {
                  set_open(false);
                  on_select(value);
                }}
                className={[
                  "rounded-md px-1 py-1.5 text-center text-xs font-medium tabular-nums transition-colors",
                  value === year
                    ? "bg-brand-600 text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
                ].join(" ")}
              >
                {value}
              </button>
            ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}