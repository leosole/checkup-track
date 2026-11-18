import { formatShortDate } from "../../date-utils";
import { seriesColor } from "../../theme";
import type { ChartGeometry, DisplaySeries } from "./types";

export const CHART_HEIGHT = 240;
export const CHART_PAD = { top: 18, right: 14, bottom: 30, left: 44 };

function niceTicks(min: number, max: number, count = 4): number[] {
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

export function buildGeometry(
  visible: DisplaySeries[],
  width: number,
): ChartGeometry {
  const inner_w = Math.max(60, width - CHART_PAD.left - CHART_PAD.right);
  const inner_h = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

  const all_points = visible.flatMap((series) => series.points);
  const dates = all_points.map((point) => point.date).sort();
  const first_year = dates.length ? Number(dates[0].slice(0, 4)) : 0;
  const last_year = dates.length ? Number(dates[dates.length - 1].slice(0, 4)) : 0;
  const domain_start = dates.length ? Date.UTC(first_year, 0, 1) : 0;
  const domain_end = dates.length ? Date.UTC(last_year + 1, 0, 1) : 1;
  const domain_span = domain_end - domain_start || 1;
  const values = all_points.map((point) => point.value);
  const min_v = values.length ? Math.min(...values) : 0;
  const max_v = values.length ? Math.max(...values) : 1;

  const xOf = (date: string) => {
    const t = new Date(date).getTime();
    return CHART_PAD.left + ((t - domain_start) / domain_span) * inner_w;
  };

  const pad_v = (max_v - min_v) * 0.1 || Math.abs(max_v) * 0.1 || 1;
  const lo = min_v - pad_v;
  const hi = max_v + pad_v;
  const yOf = (value: number) =>
    CHART_PAD.top + inner_h - ((value - lo) / (hi - lo)) * inner_h;

  const y_ticks = niceTicks(lo, hi, 4);

  const date_ticks: { date: string; x: number; label: string }[] = [];
  let last_label_right = -Infinity;
  for (const date of new Set(dates)) {
    const x = xOf(date);
    const label = formatShortDate(date);
    const half_width = (label.length * 5.5 + 8) / 2;
    if (x - half_width < last_label_right + 8) continue;
    date_ticks.push({ date, x, label });
    last_label_right = x + half_width;
  }

  const paths = visible.map((series) => {
    const sorted = [...series.points].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const d = sorted
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${xOf(point.date).toFixed(2)} ${yOf(
            point.value,
          ).toFixed(2)}`,
      )
      .join(" ");
    return {
      spec: series.spec,
      unit: series.unit,
      color: seriesColor(series.color_index),
      d,
      points: sorted,
    };
  });

  return {
    inner_w,
    inner_h,
    xOf,
    yOf,
    y_ticks,
    date_ticks,
    paths,
    has_data: all_points.length > 0,
  };
}
