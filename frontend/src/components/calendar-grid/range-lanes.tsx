import type { Bar, RangeLanesProps } from "./types";

/** Height of one bar lane; the week's cells reserve this much bottom padding. */
export const LANE_HEIGHT = 20;

/**
 * The spanning medication and symptom bars of one week. They overlay the day
 * cells (above their borders) so a week row never grows an extra strip below
 * the cells; the cells' padding keeps the bars below the day's exams.
 */
export function RangeLanes({ lanes, on_select }: RangeLanesProps) {
  if (lanes.length === 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-1.5 z-10"
      style={{ height: lanes.length * LANE_HEIGHT - 4 }}
    >
      {lanes.map((lane, lane_index) =>
        lane.map((bar: Bar) => (
          <button
            type="button"
            key={bar.id}
            onClick={() => on_select({ kind: bar.kind, id: bar.item_id })}
            title={bar.title}
            aria-label={`${bar.label}, ${bar.kind} details`}
            className="pointer-events-auto absolute flex h-4 items-center gap-1 overflow-hidden rounded-full px-1.5 text-[10px] font-semibold text-white shadow-xs"
            style={{
              backgroundColor: bar.color,
              top: lane_index * LANE_HEIGHT,
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
