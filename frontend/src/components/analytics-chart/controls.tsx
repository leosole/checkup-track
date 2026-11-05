import type { FormEvent } from "react";
import { Input } from "../ui/input";

interface AnalyticsChartControlsProps {
  specs: string[];
  filtered_specs: string[];
  selected: string[];
  spec_filter: string;
  custom_spec: string;
  on_spec_filter_change: (value: string) => void;
  on_clear_filter: () => void;
  on_toggle_spec: (spec: string) => void;
  on_custom_spec_change: (value: string) => void;
  on_add_custom_spec: (event: FormEvent<HTMLFormElement>) => void;
  color_of: (index: number) => string;
}

export function AnalyticsChartControls({
  specs,
  filtered_specs,
  selected,
  spec_filter,
  custom_spec,
  on_spec_filter_change,
  on_clear_filter,
  on_toggle_spec,
  on_custom_spec_change,
  on_add_custom_spec,
  color_of,
}: AnalyticsChartControlsProps) {
  return (
    <div className="mt-4 space-y-3">
      {specs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="search"
              value={spec_filter}
              onChange={(event) => on_spec_filter_change(event.target.value)}
              placeholder="Filter biomarkers…"
              aria-label="Filter biomarkers"
              className="w-full rounded-lg border-0 bg-gray-100 py-2 pl-9 pr-3 text-sm text-gray-900 ring-1 ring-inset ring-transparent placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-900"
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {filtered_specs.length} of {specs.length} markers
          </span>
          {spec_filter && (
            <button
              type="button"
              onClick={on_clear_filter}
              className="text-xs font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {specs.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Upload a lab report PDF to populate biomarkers.
          </p>
        )}
        {specs.length > 0 && filtered_specs.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No biomarker matches “{spec_filter.trim()}”.
          </p>
        )}
        {filtered_specs.map((spec) => {
          const active = selected.includes(spec);
          const index = selected.indexOf(spec);
          return (
            <button
              key={spec}
              type="button"
              onClick={() => on_toggle_spec(spec)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                active
                  ? "bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/40"
                  : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-800",
              ].join(" ")}
            >
              {active && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color_of(index) }}
                />
              )}
              {spec}
            </button>
          );
        })}
      </div>
      <form onSubmit={on_add_custom_spec} className="flex max-w-xs gap-2">
        <Input
          placeholder="Add biomarker…"
          value={custom_spec}
          onChange={(event) => on_custom_spec_change(event.target.value)}
          aria-label="Add custom biomarker spec"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-gray-100 px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Add
        </button>
      </form>
    </div>
  );
}