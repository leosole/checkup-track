import type { Bar, RangeLanesProps } from "./types";

const LANE_HEIGHT = 20;

/** One row of spanning bars beneath a week's day cells. */
export function RangeLanes({ lanes, on_select }: RangeLanesProps) {
  if (lanes.length === 0) return null;
  return (
    <div
      className="col-span-7 relative border-t border-dashed border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-950/40"
      style={{ height: lanes.length * LANE_HEIGHT + 8 }}
    >
      {lanes.map((lane, lane_index) =>
        lane.map((bar: Bar) => (
          <button
            type="button"
            key={bar.id}
            onClick={() => on_select({ kind: bar.kind, id: bar.item_id })}
            title={bar.title}
            aria-label={`${bar.label}, ${bar.kind} details`}
            className="absolute flex h-4 items-center gap-1 overflow-hidden rounded-full px-1.5 text-[10px] font-semibold text-white shadow-sm"
            style={{
              backgroundColor: bar.color,
              top: lane_index * LANE_HEIGHT + 4,
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
  );
}
