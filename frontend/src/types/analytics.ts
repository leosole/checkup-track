export interface TimeSeriesPoint {
  date: string;
  value: number;
  is_abnormal: boolean;
  exam_title: string;
}

export interface TimeSeries {
  spec: string;
  unit: string;
  points: TimeSeriesPoint[];
}

export interface TimeSeriesResponse {
  series: TimeSeries[];
}

export interface TimeSeriesQuery {
  start_date: string;
  end_date: string;
  specs: string[];
}
