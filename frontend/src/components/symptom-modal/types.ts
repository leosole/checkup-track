export interface SymptomDateDraft {
  start_date: string;
  /** Empty means a single day (or ongoing when the toggle is on). */
  end_date: string;
  ongoing: boolean;
  observation: string;
}

export interface TitleComboboxProps {
  value: string;
  titles: string[];
  onChange: (value: string) => void;
}

export interface DatesEditorProps {
  drafts: SymptomDateDraft[];
  onChange: (drafts: SymptomDateDraft[]) => void;
  /** Editing one occurrence: the list cannot grow or shrink. */
  single?: boolean;
}
