import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api, type Exam, type TimeSeries } from "../api-client";
import { format_date } from "../date-utils";
import { Badge, Card, EmptyState, Spinner } from "./ui/badge";
import { Input } from "./ui/input";

interface AnalyticsChartProps {
  exams: Exam[];
}

const SERIES_COLORS = [
  "#7c3aed", // brand-600
  "#0284c7", // sky-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#e11d48", // rose-600
  "#4f46e5", // indigo-600
  "#0d9488", // teal-600
  "#db2777", // pink-600
];

const PAD = { top: 24, right: 24, bottom: 44, left: 64 };
const HEIGHT = 380;

/** All unique biomarker names across loaded exams, for the spec picker. */
function available_specs(exams: Exam[]): string[] {
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

interface Tooltip {
  x: number;
  y: number;
  series: string;
  unit: string;
  value: number;
  date: string;
  exam_title: string;
  is_abnormal: boolean;
  color: string;
}

export function AnalyticsChart({ exams }: AnalyticsChartProps) {
  const react_id = useId();
  const svg_ref = useRef<SVGSVGElement | null>(null);
  const wrap_ref = useRef<HTMLDivElement | null>(null);

  const specs = useMemo(() => available_specs(exams), [exams]);
  const [selected, set_selected] = useState<string[]>([]);
  const [custom_spec, set_custom_spec] = useState("");
  const [series, set_series] = useState<TimeSeries[]>([]);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [tooltip, set_tooltip] = useState<Tooltip | null>(null);
  const [width, set_width] = useState(720);

  // Auto-select the first two specs once when specs appear.
  useEffect(() => {
    if (selected.length === 0 && specs.length > 0) {
      set_selected(specs.slice(0, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specs]);

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
    api
      .time_series({ start_date: start, end_date: end, specs: selected })
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
  }, [selected]);

  const visible = series.filter((s) => s.points.length > 0);

  const geometry = useMemo(() => {
    const inner_w = Math.max(80, width - PAD.left - PAD.right);
    const inner_h = HEIGHT - PAD.top - PAD.bottom;

    const all_points = visible.flatMap((s) => s.points);
    const times = all_points.map((p) => new Date(p.date).getTime());
    const min_t = times.length ? Math.min(...times) : 0;
    const max_t = times.length ? Math.max(...times) : 1;
    const values = all_points.map((p) => p.value);
    const min_v = values.length ? Math.min(...values) : 0;
    const max_v = values.length ? Math.max(...values) : 1;

    const x_of = (date: string) => {
      const t = new Date(date).getTime();
      if (max_t === min_t) return PAD.left + inner_w / 2;
      return PAD.left + ((t - min_t) / (max_t - min_t)) * inner_w;
    };

    const pad_v = (max_v - min_v) * 0.1 || Math.abs(max_v) * 0.1 || 1;
    const lo = min_v - pad_v;
    const hi = max_v + pad_v;
    const y_of = (v: number) => PAD.top + inner_h - ((v - lo) / (hi - lo)) * inner_h;

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

  function toggle_spec(spec: string) {
    set_selected((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec],
    );
  }

  function add_custom_spec(e: React.FormEvent) {
    e.preventDefault();
    const value = custom_spec.trim();
    if (value && !selected.includes(value)) {
      set_selected((prev) => [...prev, value]);
    }
    set_custom_spec("");
  }

  function on_pointer_move(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svg_ref.current;
    if (!svg || geometry.paths.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * width;
    const my = ((e.clientY - rect.top) / rect.width) * width;

    let best: (Tooltip & { dist: number }) | null = null;
    geometry.paths.forEach((path, idx) => {
      const color = SERIES_COLORS[idx % SERIES_COLORS.length];
      for (const p of path.points) {
        const px = geometry.x_of(p.date);
        const py = geometry.y_of(p.value);
        const dist = Math.hypot(px - mx, py - my);
        if (dist < 28 && (!best || dist < best.dist)) {
          best = {
            dist,
            x: px,
            y: py,
            series: path.spec,
            unit: path.unit,
            value: p.value,
            date: p.date,
            exam_title: p.exam_title,
            is_abnormal: p.is_abnormal,
            color,
          };
        }
      }
    });
    set_tooltip(best ?? null);
  }

  const color_of = (index: number) => SERIES_COLORS[index % SERIES_COLORS.length];

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Biomarker trends</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Plot multiple lab values against each other over time
          </p>
        </div>
        <Badge tone="brand">{visible.length} series</Badge>
      </div>

      {/* Spec picker chips */}
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {specs.length === 0 && (
            <p className="text-sm text-gray-400">
              Upload a lab report PDF to populate biomarkers.
            </p>
          )}
          {specs.map((spec) => {
            const active = selected.includes(spec);
            const idx = selected.indexOf(spec);
            return (
              <button
                key={spec}
                type="button"
                onClick={() => toggle_spec(spec)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700 ring-brand-300"
                    : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50",
                ].join(" ")}
              >
                {active && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: color_of(idx) }}
                  />
                )}
                {spec}
              </button>
            );
          })}
        </div>
        <form onSubmit={add_custom_spec} className="flex max-w-xs gap-2">
          <Input
            placeholder="Add biomarker…"
            value={custom_spec}
            onChange={(e) => set_custom_spec(e.target.value)}
            aria-label="Add custom biomarker spec"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-gray-100 px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200"
          >
            Add
          </button>
        </form>
      </div>

      {/* Chart canvas */}
      <div ref={wrap_ref} className="relative mt-4">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        {!loading && !error && visible.length === 0 && (
          <EmptyState
            title="No series selected"
            hint="Pick one or more biomarker specs above to plot your medical history timeline."
          />
        )}
        {visible.length > 0 && (
          <>
            <svg
              ref={svg_ref}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              width="100%"
              height={HEIGHT}
              className="select-none"
              role="img"
              aria-label="Multi-series biomarker line chart"
              onMouseMove={on_pointer_move}
              onMouseLeave={() => set_tooltip(null)}
            >
              <defs>
                <clipPath id={`${react_id}-clip`}>
                  <rect
                    x={PAD.left}
                    y={PAD.top}
                    width={geometry.inner_w}
                    height={geometry.inner_h}
                  />
                </clipPath>
              </defs>

              {/* horizontal grid + y labels */}
              {geometry.y_ticks.map((tick) => (
                <g key={`y-${tick}`}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={geometry.y_of(tick)}
                    y2={geometry.y_of(tick)}
                    stroke="#e5e7eb"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 10}
                    y={geometry.y_of(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill="#6b7280"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              {/* x labels */}
              {geometry.x_ticks.map((tick) => (
                <text
                  key={`x-${tick}`}
                  x={geometry.x_of(tick)}
                  y={HEIGHT - PAD.bottom + 20}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#6b7280"
                >
                  {format_date(tick).replace(/, \d{4}$/, "")}
                </text>
              ))}

              {/* axis lines */}
              <line
                x1={PAD.left}
                x2={PAD.left}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="#d1d5db"
                strokeWidth={1}
              />
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={HEIGHT - PAD.bottom}
                y2={HEIGHT - PAD.bottom}
                stroke="#d1d5db"
                strokeWidth={1}
              />

              {/* series lines + points */}
              <g clipPath={`url(#${react_id}-clip)`}>
                {geometry.paths.map((path, idx) => {
                  const color = color_of(idx);
                  return (
                    <g key={path.spec}>
                      <path
                        d={path.d}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {path.points.map((p) => (
                        <g key={`${path.spec}-${p.date}-${p.value}`}>
                          <circle
                            cx={geometry.x_of(p.date)}
                            cy={geometry.y_of(p.value)}
                            r={p.is_abnormal ? 4.5 : 3}
                            fill={p.is_abnormal ? "#fff" : color}
                            stroke={p.is_abnormal ? "#e11d48" : color}
                            strokeWidth={p.is_abnormal ? 2.5 : 1}
                          >
                            <title>
                              {`${path.spec}: ${p.value} ${path.unit} on ${format_date(p.date)}${
                                p.is_abnormal ? " (abnormal)" : ""
                              } — ${p.exam_title}`}
                            </title>
                          </circle>
                        </g>
                      ))}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Hover tooltip */}
            {tooltip && (
              <div
                className="pointer-events-none absolute z-20 w-56 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
                style={{
                  left: Math.min(
                    Math.max(tooltip.x + 12, 0),
                    Math.max(0, width - 232),
                  ),
                  top: Math.max(tooltip.y - 64, 0),
                }}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: tooltip.color }}
                  />
                  {tooltip.series}
                  {tooltip.is_abnormal && (
                    <span className="ml-auto rounded bg-rose-500 px-1 text-[10px] font-bold">
                      ABNORMAL
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-bold">
                  {tooltip.value}{" "}
                  <span className="font-medium text-gray-300">{tooltip.unit}</span>
                </p>
                <p className="mt-1 text-gray-300">{format_date(tooltip.date)}</p>
                <p className="truncate text-gray-400">{tooltip.exam_title}</p>
              </div>
            )}

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {geometry.paths.map((path, idx) => (
                <span
                  key={path.spec}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: color_of(idx) }}
                  />
                  {path.spec}
                  {path.unit && (
                    <span className="text-gray-400">({path.unit})</span>
                  )}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
