import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type TimeSeries,
  type TimeSeriesResponse,
} from "../../api-client";
import { Badge, Card, EmptyState, Spinner } from "../ui/badge";
import { AnalyticsChartControls } from "./controls";
import {
  AnalyticsChartPlot,
  CHART_HEIGHT,
  CHART_PAD,
  chart_color,
  type ChartGeometry,
} from "./plot";
import { MERGED_SPECS_KEY } from "./marker-selection";

/** The exam fields the chart needs; owner and guest exam shapes both fit. */
export type ChartExam = {
  date_performed: string;
  biomarkers: { biomarker_name: string; unit: string }[];
};

type SeriesLoader = (params: {
  start_date: string;
  end_date: string;
  specs: string[];
}) => Promise<TimeSeriesResponse>;

interface AnalyticsChartProps {
  exams: ChartExam[];
  exams_loading?: boolean;
  /** Marker names currently plotted, shared with the exam cards and modal. */
  selected: string[];
  on_toggle_spec: (spec: string) => void;
  /** Where series come from; guests pass the read-only guest endpoint. */
  load_series?: SeriesLoader;
  /** Browser storage key for chart-only merge groups. */
  merge_storage_key?: string;
}

type DisplaySeries = TimeSeries & { color_index: number };

function normalized_spec(spec: string): string {
  return spec.trim().toLowerCase();
}

function read_merge_groups(storage_key: string): string[][] {
  try {
    const raw = localStorage.getItem(storage_key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (group): group is string[] =>
            Array.isArray(group) &&
            group.length > 1 &&
            group.every((name) => typeof name === "string"),
        )
      : [];
  } catch {
    return [];
  }
}

/** All unique biomarker names across loaded exams, for the spec picker. */
function available_specs(exams: ChartExam[]): string[] {
  const names = new Set<string>();
  for (const exam of exams) {
    for (const b of exam.biomarkers) {
      names.add(b.biomarker_name);
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function nice_ticks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    const bump = Math.abs(min) * 0.1 || 1;
    min -= bump;
    max += bump;
  }
  const span = max - min;
  const step0 = span / Math.max(1, count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

export function AnalyticsChart({
  exams,
  exams_loading = false,
  selected,
  on_toggle_spec,
  load_series = api.time_series,
  merge_storage_key = MERGED_SPECS_KEY,
}: AnalyticsChartProps) {
  const wrap_ref = useRef<HTMLDivElement | null>(null);

  const specs = useMemo(() => available_specs(exams), [exams]);
  const units_by_spec = useMemo(() => {
    const units = new Map<string, Set<string>>();
    for (const exam of exams) {
      for (const biomarker of exam.biomarkers) {
        const key = biomarker.biomarker_name.trim().toLowerCase();
        const values = units.get(key) ?? new Set<string>();
        values.add(biomarker.unit.trim());
        units.set(key, values);
      }
    }
    return units;
  }, [exams]);
  const [merge_groups, set_merge_groups] = useState<string[][]>(() =>
    read_merge_groups(merge_storage_key),
  );
  const [merge_selection, set_merge_selection] = useState<string[]>([]);
  const unit_of_spec = (spec: string) => {
    const values = units_by_spec.get(spec.trim().toLowerCase());
    if (!values || values.size === 0) return "";
    return values.size > 1 ? "Mixed units" : Array.from(values)[0];
  };
  const active_merge_groups = useMemo(() => {
    const selected_by_key = new Map(
      selected.map((spec) => [normalized_spec(spec), spec]),
    );
    return merge_groups
      .map((group) =>
        group
          .map((name) => selected_by_key.get(normalized_spec(name)))
          .filter((name): name is string => Boolean(name)),
      )
      .filter((group) => group.length > 1);
  }, [merge_groups, selected]);

  useEffect(() => {
    const active_groups_json = JSON.stringify(active_merge_groups);
    set_merge_groups((previous) =>
      JSON.stringify(previous) === active_groups_json
        ? previous
        : active_merge_groups,
    );
    try {
      localStorage.setItem(merge_storage_key, active_groups_json);
    } catch {
      // Storage full or disabled: merges remain active for this chart session.
    }
  }, [active_merge_groups, merge_storage_key]);

  useEffect(() => {
    const selected_keys = new Set(selected.map(normalized_spec));
    set_merge_selection((previous) =>
      previous.filter((name) => selected_keys.has(normalized_spec(name))),
    );
  }, [selected]);

  const selected_merge_specs = selected.filter((spec) =>
    merge_selection.some(
      (name) => normalized_spec(name) === normalized_spec(spec),
    ),
  );
  const merge_members_map = new Map(
    selected_merge_specs.map((spec) => [normalized_spec(spec), spec]),
  );
  for (const group of active_merge_groups) {
    if (group.some((name) => merge_members_map.has(normalized_spec(name)))) {
      for (const name of group)
        merge_members_map.set(normalized_spec(name), name);
    }
  }
  const merge_members = Array.from(merge_members_map.values());
  let merge_disabled_reason: string | null = null;
  if (selected_merge_specs.length < 2) {
    merge_disabled_reason = "Select at least two markers to merge.";
  } else {
    const marker_units = merge_members.map((spec) =>
      units_by_spec.get(normalized_spec(spec)),
    );
    if (marker_units.some((units) => !units || units.size !== 1)) {
      merge_disabled_reason =
        "Each marker must have results with one consistent unit before merging.";
    } else {
      const units = new Set(
        marker_units.map((values) =>
          (Array.from(values ?? [""])[0] ?? "").trim().toLowerCase(),
        ),
      );
      if (units.size > 1) {
        merge_disabled_reason = "Markers must use the same unit to be merged.";
      }
    }
  }

  function toggle_merge_selection(spec: string) {
    set_merge_selection((previous) =>
      previous.some((name) => normalized_spec(name) === normalized_spec(spec))
        ? previous.filter(
            (name) => normalized_spec(name) !== normalized_spec(spec),
          )
        : [...previous, spec],
    );
  }

  function merge_selected() {
    if (merge_disabled_reason) return;
    set_merge_groups((previous) => [
      ...previous.filter(
        (group) =>
          !group.some((name) =>
            merge_members.some(
              (member) => normalized_spec(member) === normalized_spec(name),
            ),
          ),
      ),
      merge_members,
    ]);
    set_merge_selection([]);
  }
  const [spec_filter, set_spec_filter] = useState("");
  const [series, set_series] = useState<TimeSeries[]>([]);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [width, set_width] = useState(720);

  // Responsive width.
  useEffect(() => {
    const el = wrap_ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) set_width(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch time-series whenever the selection changes.
  useEffect(() => {
    if (selected.length === 0) {
      set_series([]);
      set_loading(false);
      return;
    }
    if (exams_loading) {
      set_loading(true);
      return;
    }
    if (exams.length === 0) {
      set_series([]);
      set_loading(false);
      return;
    }
    let cancelled = false;
    set_loading(true);
    set_error(null);
    const dates = exams.map((e) => e.date_performed).sort();
    const start = dates[0] ?? new Date().toISOString().slice(0, 10);
    const end =
      dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
    load_series({ start_date: start, end_date: end, specs: selected })
      .then((res) => {
        if (!cancelled) set_series(res.series);
      })
      .catch((err: Error) => {
        if (!cancelled) set_error(err.message);
      })
      .finally(() => {
        if (!cancelled) set_loading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, exams, exams_loading, load_series]);

  const display_series = useMemo<DisplaySeries[]>(() => {
    const series_by_key = new Map(
      series.map((item) => [normalized_spec(item.spec), item]),
    );
    const group_by_key = new Map<string, string[]>();
    for (const group of active_merge_groups) {
      for (const name of group) group_by_key.set(normalized_spec(name), group);
    }

    const displayed: DisplaySeries[] = [];
    const consumed = new Set<string>();
    for (const spec of selected) {
      const key = normalized_spec(spec);
      if (consumed.has(key)) continue;
      const group = group_by_key.get(key);
      if (group) {
        const members = group
          .map((name) => series_by_key.get(normalized_spec(name)))
          .filter((item): item is TimeSeries => Boolean(item));
        const points = members
          .flatMap((item) => item.points)
          .sort((left, right) => left.date.localeCompare(right.date));
        displayed.push({
          spec: group.join(" + "),
          unit: members[0]?.unit ?? "",
          points,
          color_index: Math.max(
            0,
            selected.findIndex(
              (name) => normalized_spec(name) === normalized_spec(group[0]),
            ),
          ),
        });
        group.forEach((name) => consumed.add(normalized_spec(name)));
      } else {
        const item = series_by_key.get(key);
        if (item) {
          displayed.push({
            ...item,
            color_index: Math.max(
              0,
              selected.findIndex((name) => normalized_spec(name) === key),
            ),
          });
        }
        consumed.add(key);
      }
    }
    return displayed;
  }, [series, selected, active_merge_groups]);
  const visible = display_series.filter((item) => item.points.length > 0);

  // Biomarker name filter for the chip picker (selection is unaffected).
  const filter_lower = spec_filter.trim().toLowerCase();
  const filtered_specs = filter_lower
    ? specs.filter((spec) => spec.toLowerCase().includes(filter_lower))
    : specs;

  const geometry = useMemo<ChartGeometry>(() => {
    const inner_w = Math.max(80, width - CHART_PAD.left - CHART_PAD.right);
    const inner_h = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

    const all_points = visible.flatMap((s) => s.points);
    const dates = all_points.map((point) => point.date).sort();
    const first_year = dates.length ? Number(dates[0].slice(0, 4)) : 0;
    const last_year = dates.length
      ? Number(dates[dates.length - 1].slice(0, 4))
      : 0;
    const domain_start = dates.length ? Date.UTC(first_year, 0, 1) : 0;
    const domain_end = dates.length ? Date.UTC(last_year + 1, 0, 1) : 1;
    const domain_span = domain_end - domain_start || 1;
    const values = all_points.map((p) => p.value);
    const min_v = values.length ? Math.min(...values) : 0;
    const max_v = values.length ? Math.max(...values) : 1;

    const x_of = (date: string) => {
      const t = new Date(date).getTime();
      return CHART_PAD.left + ((t - domain_start) / domain_span) * inner_w;
    };

    const pad_v = (max_v - min_v) * 0.1 || Math.abs(max_v) * 0.1 || 1;
    const lo = min_v - pad_v;
    const hi = max_v + pad_v;
    const y_of = (v: number) =>
      CHART_PAD.top + inner_h - ((v - lo) / (hi - lo)) * inner_h;

    const y_ticks = nice_ticks(lo, hi, 5);
    const x_tick_count = Math.min(6, Math.max(2, Math.floor(inner_w / 110)));
    const x_ticks: string[] = [];
    if (dates.length > 0) {
      for (let i = 0; i < x_tick_count; i++) {
        const t = domain_start + (domain_span * i) / (x_tick_count - 1 || 1);
        x_ticks.push(new Date(t).toISOString().slice(0, 10));
      }
    }
    const year_ticks = dates.length
      ? Array.from({ length: last_year - first_year + 1 }, (_, index) => {
          const year = first_year + index;
          return { year, x: x_of(`${year}-01-01`) };
        })
      : [];

    const paths = visible.map((s) => {
      const sorted = [...s.points].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const d = sorted
        .map(
          (p, i) =>
            `${i === 0 ? "M" : "L"} ${x_of(p.date).toFixed(2)} ${y_of(p.value).toFixed(2)}`,
        )
        .join(" ");
      return {
        spec: s.spec,
        unit: s.unit,
        color: chart_color(s.color_index),
        d,
        points: sorted,
      };
    });

    return {
      inner_w,
      inner_h,
      x_of,
      y_of,
      y_ticks,
      x_ticks,
      year_ticks,
      paths,
      has_data: all_points.length > 0,
    };
  }, [visible, width]);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Biomarker trends
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Plot multiple lab values against each other over time
          </p>
        </div>
        <Badge tone="brand">{visible.length} series</Badge>
      </div>

      <AnalyticsChartControls
        specs={specs}
        filtered_specs={filtered_specs}
        selected={selected}
        unit_of_spec={unit_of_spec}
        merge_selection={merge_selection}
        merge_member_count={merge_members.length}
        merge_disabled_reason={merge_disabled_reason}
        spec_filter={spec_filter}
        on_spec_filter_change={set_spec_filter}
        on_clear_filter={() => set_spec_filter("")}
        on_toggle_spec={on_toggle_spec}
        on_toggle_merge_selection={toggle_merge_selection}
        on_merge_selected={merge_selected}
        color_of={chart_color}
      />

      {/* Chart canvas */}
      <div ref={wrap_ref} className="relative mt-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
        {!loading && !error && visible.length === 0 && (
          <EmptyState
            title={
              selected.length > 0
                ? "No results for selected markers"
                : "No series selected"
            }
            hint={
              selected.length > 0
                ? "The selected markers have no results in the current exam date range."
                : "Search for a biomarker above and pick the markers you want to plot over time."
            }
          />
        )}
        {visible.length > 0 && (
          <AnalyticsChartPlot width={width} geometry={geometry} />
        )}
      </div>
    </Card>
  );
}
