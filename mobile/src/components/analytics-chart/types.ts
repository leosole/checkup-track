import type {
  TimeSeries,
  TimeSeriesPoint,
  TimeSeriesQuery,
  TimeSeriesResponse,
} from "../../types";

/** The exam fields the chart needs; owner and guest exam shapes both fit. */
export interface ChartExam {
  date_performed: string;
  biomarkers: { biomarker_name: string; unit: string }[];
}

export type SeriesLoader = (
  params: TimeSeriesQuery,
) => Promise<TimeSeriesResponse>;

export interface ChartPath {
  spec: string;
  unit: string;
  color: string;
  d: string;
  points: TimeSeriesPoint[];
}

export interface ChartGeometry {
  inner_w: number;
  inner_h: number;
  xOf: (date: string) => number;
  yOf: (value: number) => number;
  y_ticks: number[];
  date_ticks: { date: string; x: number; label: string }[];
  paths: ChartPath[];
  has_data: boolean;
}

export interface Tooltip {
  series: string;
  unit: string;
  value: number;
  date: string;
  exam_title: string;
  is_abnormal: boolean;
  reference_range: string | null;
  color: string;
}

export interface DisplaySeries extends TimeSeries {
  color_index: number;
}
