import type { TimeSeries, TimeSeriesPoint, TimeSeriesResponse } from "../../types";

/** The exam fields the chart needs; owner and guest exam shapes both fit. */
export interface ChartExam {
  date_performed: string;
  biomarkers: { biomarker_name: string; unit: string }[];
}

export interface SeriesLoaderParams {
  start_date: string;
  end_date: string;
  specs: string[];
}

export type SeriesLoader = (
  params: SeriesLoaderParams,
) => Promise<TimeSeriesResponse>;

export interface AnalyticsChartProps {
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

export type DisplaySeries = TimeSeries & { color_index: number };

export interface AnalyticsChartControlsProps {
  specs: string[];
  filtered_specs: string[];
  selected: string[];
  unitOfSpec: (spec: string) => string;
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

export interface ChartPath {
  spec: string;
  unit: string;
  color: string;
  d: string;
  points: TimeSeriesPoint[];
}

export interface AnalyticsChartPlotProps {
  width: number;
  geometry: ChartGeometry;
}

export interface ChartGeometry {
  inner_w: number;
  inner_h: number;
  xOf: (date: string) => number;
  yOf: (value: number) => number;
  y_ticks: number[];
  x_ticks: string[];
  year_ticks: { year: number; x: number }[];
  paths: ChartPath[];
  has_data: boolean;
}

export interface Tooltip {
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
