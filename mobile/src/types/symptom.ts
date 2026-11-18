export interface SymptomOccurrence {
  id: number;
  symptom_id: number;
  title: string;
  observation: string | null;
  start_date: string;
  end_date: string | null;
}

export interface SymptomDateInput {
  start_date: string;
  end_date: string | null;
  observation: string | null;
}

export interface SymptomCreateInput {
  title: string;
  dates: SymptomDateInput[];
}

export interface SymptomOccurrenceUpdateInput {
  title?: string;
  observation?: string | null;
  start_date?: string;
  end_date?: string | null;
}
