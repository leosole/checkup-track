import { useEffect, useRef, useState } from "react";
import type { DashboardQuickActionsProps } from "./types";

export function DashboardQuickActions({
  can_create_records,
  on_upload_exam,
  on_add_medication,
  on_log_symptom,
}: DashboardQuickActionsProps) {
  const [open, set_open] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Behave like a dropdown: close on outside pointer press or Escape.
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

  const actions = [
    { label: "Upload exam", on_select: on_upload_exam },
    { label: "Add medication", on_select: on_add_medication },
    { label: "Log symptom", on_select: on_log_symptom },
  ];

  return (
    <div
      ref={container}
      className={[
        "fixed bottom-6 right-6 z-40 overflow-hidden",
        "transition-[width,height,border-radius,background-color,box-shadow] duration-300 ease-in-out motion-reduce:transition-none",
        open
          ? "h-[12.5rem] w-64 rounded-2xl bg-white shadow-untitled-lg ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10"
          : "h-14 w-14 rounded-[1.75rem] bg-brand-600 shadow-untitled-lg shadow-brand-600/30",
      ].join(" ")}
    >
      {/* Always mounted so the actions can fade; hidden from pointer/keyboard while collapsed. */}
      <div
        inert={!open}
        aria-hidden={!open}
        className={[
          "p-2 pb-11 transition-opacity ease-out motion-reduce:transition-none",
          open
            ? "opacity-100 duration-200 delay-100"
            : "opacity-0 duration-100",
        ].join(" ")}
      >
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase leading-4 tracking-wide text-gray-500 dark:text-gray-400">
          Add to your record
        </p>
        <ul>
          {actions.map((action) => (
            <li key={action.label}>
              <button
                type="button"
                disabled={!can_create_records}
                onClick={() => {
                  set_open(false);
                  action.on_select();
                }}
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium leading-5 text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        aria-label={open ? "Collapse actions" : "Add to your record"}
        aria-expanded={open}
        title={open ? "Collapse actions" : "Add to your record"}
        onClick={() => set_open((value) => !value)}
        className={[
          "group absolute flex items-center justify-center rounded-full transition-[width,height,bottom,right,background-color,color] duration-300 ease-in-out motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          open
            ? "bottom-2 right-2 h-9 w-9 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            : "bottom-0 right-0 h-14 w-14 text-white hover:bg-brand-700",
        ].join(" ")}
      >
        <svg
          aria-hidden="true"
          className="h-6 w-6"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line
            x1="6"
            y1="12"
            x2="18"
            y2="12"
            className="transition-transform duration-200 ease-in-out group-aria-expanded:translate-y-[6px] motion-reduce:transition-none"
          />
          <line
            x1="12"
            y1="6"
            x2="12"
            y2="18"
            className="transition-transform duration-200 ease-in-out group-aria-expanded:translate-x-[6px] motion-reduce:transition-none"
          />
        </svg>
      </button>
    </div>
  );
}
