export interface CalendarExam {
  id: number;
  title: string;
  date: string;
}

export interface CalendarMedication {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
}

export interface CalendarData {
  exams: CalendarExam[];
  medications: CalendarMedication[];
}
