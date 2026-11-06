import { useEffect, useMemo, useRef, useState } from "react";
import { api, type TimeSeries, type TimeSeriesResponse } from "../../api-client";
import { Badge, Card, EmptyState, Spinner } from "../ui/badge";
import { AnalyticsChartControls } from "./controls";
import {
  AnalyticsChartPlot,
  CHART_HEIGHT,
  CHART_PAD,
  chart_color,
  type ChartGeometry,
} from "./plot";

/** The exam fields the chart needs; owner and guest exam shapes both fit. */
export type ChartExam = {
  date_performed: string;
  biomarkers: { biomarker_name: string }[];
};

type SeriesLoader = (params: {
  start_date: string;
  end_date: string;
  specs: string[];
}) => Promise<TimeSeriesResponse>;

interface AnalyticsChartProps {
  exams: ChartExam[];
  /** Marker names currently plotted, shared with the exam cards and modal. */
  selected: string[];
  on_toggle_spec: (spec: string) => void;
  /** Where series come from; guests pass the read-only guest endpoint. */
  load_series?: SeriesLoader;
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
  selected,
  on_toggle_spec,
  load_series = api.time_series,
}: AnalyticsChartProps) {
  const wrap_ref = useRef<HTMLDivElement | null>(null);

  const specs = useMemo(() => available_specs(exams), [exams]);
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
      return;
    }
    let cancelled = false;
    set_loading(true);
    set_error(null);
    const dates = exams.map((e) => e.date_performed).sort();
    const start = dates[0] ?? new Date().toISOString().slice(0, 10);
    const end = dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, load_series]);

  const visible = series.filter((s) => s.points.length > 0);

  // Biomarker name filter for the chip picker (selection is unaffected).
  const filter_lower = spec_filter.trim().toLowerCase();
  const filtered_specs = filter_lower
    ? specs.filter((spec) => spec.toLowerCase().includes(filter_lower))
    : specs;

  const geometry = useMemo<ChartGeometry>(() => {
    const inner_w = Math.max(80, width - CHART_PAD.left - CHART_PAD.right);
    const inner_h = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

    const all_points = visible.flatMap((s) => s.points);
    const times = all_points.map((p) => new Date(p.date).getTime());
    const min_t = times.length ? Math.min(...times) : 0;
    const max_t = times.length ? Math.max(...times) : 1;
    const values = all_points.map((p) => p.value);
    const min_v = values.length ? Math.min(...values) : 0;
    const max_v = values.length ? Math.max(...values) : 1;

    const x_of = (date: string) => {
      const t = new Date(date).getTime();
      if (max_t === min_t) return CHART_PAD.left + inner_w / 2;
      return CHART_PAD.left + ((t - min_t) / (max_t - min_t)) * inner_w;
    };

    const pad_v = (max_v - min_v) * 0.1 || Math.abs(max_v) * 0.1 || 1;
    const lo = min_v - pad_v;
    const hi = max_v + pad_v;
    const y_of = (v: number) =>
      CHART_PAD.top + inner_h - ((v - lo) / (hi - lo)) * inner_h;

    const y_ticks = nice_ticks(lo, hi, 5);
    const x_tick_count = Math.min(6, Math.max(2, Math.floor(inner_w / 110)));
    const x_ticks: string[] = [];
    if (times.length > 0) {
      for (let i = 0; i < x_tick_count; i++) {
        const t = min_t + ((max_t - min_t) * i) / (x_tick_count - 1 || 1);
        x_ticks.push(new Date(t).toISOString().slice(0, 10));
      }
    }

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
      return { spec: s.spec, unit: s.unit, d, points: sorted };
    });

    return { inner_w, inner_h, x_of, y_of, y_ticks, x_ticks, paths, has_data: all_points.length > 0 };
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
        spec_filter={spec_filter}
        on_spec_filter_change={set_spec_filter}
        on_clear_filter={() => set_spec_filter("")}
        on_toggle_spec={on_toggle_spec}
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
            title="No series selected"
            hint="Search for a biomarker above and pick the markers you want to plot over time."
          />
        )}
        {visible.length > 0 && (
          <AnalyticsChartPlot width={width} geometry={geometry} />
        )}
      </div>
    </Card>
  );
}
