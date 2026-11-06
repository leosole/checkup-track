interface AnalyticsChartControlsProps {
  specs: string[];
  filtered_specs: string[];
  selected: string[];
  unit_of_spec: (spec: string) => string;
  merge_selection: string[];
  merge_member_count: number;
  merge_disabled_reason: string | null;
  spec_filter: string;
  on_spec_filter_change: (value: string) => void;
  on_clear_filter: () => void;
  on_toggle_spec: (spec: string) => void;
  on_toggle_merge_selection: (spec: string) => void;
  on_merge_selected: () => void;
  color_of: (index: number) => string;
}

export function AnalyticsChartControls({
  specs,
  filtered_specs,
  selected,
  unit_of_spec,
  merge_selection,
  merge_member_count,
  merge_disabled_reason,
  spec_filter,
  on_spec_filter_change,
  on_clear_filter,
  on_toggle_spec,
  on_toggle_merge_selection,
  on_merge_selected,
  color_of,
}: AnalyticsChartControlsProps) {
  const filtering = spec_filter.trim().length > 0;
  return (
    <div className="mt-4 space-y-3">
      {selected.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Selected markers
          </h4>
          <div
            className="flex flex-wrap gap-2"
            role="list"
            aria-label="Selected trend markers"
          >
            {selected.map((spec, index) => {
              const unit = unit_of_spec(spec);
              return (
                <div
                  key={spec}
                  role="listitem"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-50 py-1 pl-2.5 pr-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={merge_selection.some(
                      (name) => name.toLowerCase() === spec.toLowerCase(),
                    )}
                    onChange={() => on_toggle_merge_selection(spec)}
                    aria-label={`Select ${spec} to merge`}
                    className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: color_of(index) }}
                    aria-hidden="true"
                  />
                  <span className="max-w-[14rem] truncate">{spec}</span>
                  {unit && (
                    <span className="shrink-0 text-gray-400 dark:text-gray-500">
                      ({unit})
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => on_toggle_spec(spec)}
                    aria-label={`Remove ${spec} from trends`}
                    title={`Remove ${spec}`}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 101.06 1.06L10 11.06l4.72 4.72a.75.75 0 101.06-1.06L11.06 10l4.72-4.72a.75.75 0 00-1.06-1.06L10 8.94 5.28 4.22z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
          {merge_selection.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={on_merge_selected}
                disabled={merge_disabled_reason !== null}
                title={
                  merge_disabled_reason ??
                  "Merge selected markers into one chart line"
                }
                className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {merge_member_count >= 2
                  ? `Merge ${merge_member_count} markers`
                  : "Select another marker"}
              </button>
              {merge_disabled_reason && (
                <p
                  className="text-xs text-gray-500 dark:text-gray-400"
                  role="status"
                >
                  {merge_disabled_reason}
                </p>
              )}
            </div>
          )}
        </div>
      )}
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
          {filtering && (
            <>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {filtered_specs.length} of {specs.length} markers
              </span>
              <button
                type="button"
                onClick={on_clear_filter}
                className="text-xs font-medium text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
              >
                Clear filter
              </button>
            </>
          )}
        </div>
      )}
      {specs.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Upload a lab report PDF to populate biomarkers.
        </p>
      ) : (
        filtering && (
          <div className="flex flex-wrap gap-2">
            {filtered_specs.length === 0 && (
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
        )
      )}
      {specs.length > 0 && !filtering && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Type a biomarker name above to pick the markers you want to plot.
        </p>
      )}
    </div>
  );
}
