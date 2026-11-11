import { useId, useRef, useState, type MouseEvent } from "react";
import { formatDate } from "../../date-utils";
import type { AnalyticsChartPlotProps, Tooltip } from "./types";

export type { ChartGeometry } from "./types";


export const SERIES_COLORS = [
  "#7c3aed",
  "#0284c7",
  "#059669",
  "#d97706",
  "#e11d48",
  "#4f46e5",
  "#0d9488",
  "#db2777",
];

export const CHART_PAD = { top: 24, right: 24, bottom: 44, left: 64 };
export const CHART_HEIGHT = 380;


export function chartColor(index: number) {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export function AnalyticsChartPlot({
  width,
  geometry,
}: AnalyticsChartPlotProps) {
  const react_id = useId();
  const svg_ref = useRef<SVGSVGElement | null>(null);
  const [tooltip, set_tooltip] = useState<Tooltip | null>(null);

  function onPointerMove(event: MouseEvent<SVGSVGElement>) {
    const svg = svg_ref.current;
    if (!svg || geometry.paths.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const mouse_x = ((event.clientX - rect.left) / rect.width) * width;
    const mouse_y = ((event.clientY - rect.top) / rect.width) * width;

    let best: (Tooltip & { dist: number }) | null = null;
    geometry.paths.forEach((path) => {
      const color = path.color;
      for (const point of path.points) {
        const x = geometry.xOf(point.date);
        const y = geometry.yOf(point.value);
        const dist = Math.hypot(x - mouse_x, y - mouse_y);
        if (dist < 28 && (!best || dist < best.dist)) {
          best = {
            dist,
            x,
            y,
            series: path.spec,
            unit: path.unit,
            value: point.value,
            date: point.date,
            exam_title: point.exam_title,
            is_abnormal: point.is_abnormal,
            color,
          };
        }
      }
    });
    set_tooltip(best ?? null);
  }

  return (
    <>
      <svg
        ref={svg_ref}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        width="100%"
        height={CHART_HEIGHT}
        className="select-none"
        role="img"
        aria-label="Multi-series biomarker line chart"
        onMouseMove={onPointerMove}
        onMouseLeave={() => set_tooltip(null)}
      >
        <defs>
          <clipPath id={`${react_id}-clip`}>
            <rect
              x={CHART_PAD.left}
              y={CHART_PAD.top}
              width={geometry.inner_w}
              height={geometry.inner_h}
            />
          </clipPath>
        </defs>

        {geometry.y_ticks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={CHART_PAD.left}
              x2={width - CHART_PAD.right}
              y1={geometry.yOf(tick)}
              y2={geometry.yOf(tick)}
              className="stroke-gray-200 dark:stroke-gray-700"
              strokeWidth={1}
            />
            <text
              x={CHART_PAD.left - 10}
              y={geometry.yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              className="fill-gray-500 dark:fill-gray-400"
            >
              {tick}
            </text>
          </g>
        ))}

        {geometry.year_ticks.map(({ year, x }) => (
          <g key={`year-${year}`}>
            <line
              x1={x}
              x2={x}
              y1={CHART_PAD.top}
              y2={CHART_HEIGHT - CHART_PAD.bottom}
              className="stroke-gray-400 dark:stroke-gray-500"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text
              x={x + 4}
              y={CHART_PAD.top - 8}
              textAnchor="start"
              fontSize={11}
              fontWeight={600}
              className="fill-gray-600 dark:fill-gray-300"
            >
              {year}
            </text>
          </g>
        ))}

        {geometry.x_ticks.map((tick) => (
          <text
            key={`x-${tick}`}
            x={geometry.xOf(tick)}
            y={CHART_HEIGHT - CHART_PAD.bottom + 20}
            textAnchor="middle"
            fontSize={11}
            className="fill-gray-500 dark:fill-gray-400"
          >
            {formatDate(tick).replace(/, \d{4}$/, "")}
          </text>
        ))}

        <line
          x1={CHART_PAD.left}
          x2={CHART_PAD.left}
          y1={CHART_PAD.top}
          y2={CHART_HEIGHT - CHART_PAD.bottom}
          className="stroke-gray-300 dark:stroke-gray-700"
          strokeWidth={1}
        />
        <line
          x1={CHART_PAD.left}
          x2={width - CHART_PAD.right}
          y1={CHART_HEIGHT - CHART_PAD.bottom}
          y2={CHART_HEIGHT - CHART_PAD.bottom}
          className="stroke-gray-300 dark:stroke-gray-700"
          strokeWidth={1}
        />

        <g clipPath={`url(#${react_id}-clip)`}>
          {geometry.paths.map((path) => {
            const color = path.color;
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
                {path.points.map((point) => (
                  <g key={`${path.spec}-${point.date}-${point.value}`}>
                    <circle
                      cx={geometry.xOf(point.date)}
                      cy={geometry.yOf(point.value)}
                      r={point.is_abnormal ? 4.5 : 3}
                      fill={point.is_abnormal ? "#fff" : color}
                      stroke={point.is_abnormal ? "#e11d48" : color}
                      strokeWidth={point.is_abnormal ? 2.5 : 1}
                    >
                      <title>
                        {`${path.spec}: ${point.value} ${path.unit} on ${formatDate(point.date)}${
                          point.is_abnormal ? " (abnormal)" : ""
                        } — ${point.exam_title}`}
                      </title>
                    </circle>
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      </svg>

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
          <p className="mt-1 text-gray-300">{formatDate(tooltip.date)}</p>
          <p className="truncate text-gray-400">{tooltip.exam_title}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {geometry.paths.map((path) => (
          <span
            key={path.spec}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: path.color }}
            />
            {path.spec}
            {path.unit && (
              <span className="text-gray-400 dark:text-gray-500">
                ({path.unit})
              </span>
            )}
          </span>
        ))}
      </div>
    </>
  );
}
