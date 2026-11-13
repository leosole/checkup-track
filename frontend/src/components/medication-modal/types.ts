export interface MedicationUseDraft {
  start_date: string;
  /** Empty means a single day (or ongoing when the toggle is on). */
  end_date: string;
  ongoing: boolean;
  dosage: string;
  /** Kept as a string while editing; parsed on save. */
  frequency_per_day: string;
}

export interface NameComboboxProps {
  value: string;
  names: string[];
  onChange: (value: string) => void;
}

export interface UsesEditorProps {
  drafts: MedicationUseDraft[];
  onChange: (drafts: MedicationUseDraft[]) => void;
  /** Editing one use: the list cannot grow or shrink. */
  single?: boolean;
}
