import type { Exam } from "../../types";
import type { SortState } from "../ui/types";

export type ExamStatus = "all" | "abnormal" | "normal";
export type ExamSortField = "title" | "date_performed";
export type ExamSort = SortState<ExamSortField>;

export interface ExamFiltersProps {
  query: string;
  status: ExamStatus;
  start_date: string;
  end_date: string;
  on_query_change: (value: string) => void;
  on_status_change: (value: ExamStatus) => void;
  on_start_date_change: (value: string) => void;
  on_end_date_change: (value: string) => void;
}

export interface ExamTableProps {
  exams: Exam[];
  can_delete: boolean;
  can_retry: boolean;
  retrying_exam_id: number | null;
  retry_error: string | null;
  deleting_id: number | null;
  sort: ExamSort;
  on_sort_change: (field: ExamSortField) => void;
  on_select_exam: (exam: Exam) => void;
  on_edited_exam: (id: number) => void;
  on_deleted_exam: (id: number) => void;
  on_opened_exam_pdf: (id: number) => void;
  on_retried_exam: (id: number) => void;
}
