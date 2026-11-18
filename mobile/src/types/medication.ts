export interface MedicationUse {
  id: number;
  medication_id: number;
  name: string;
  dosage: string;
  frequency_per_day: number;
  start_date: string;
  end_date: string | null;
}

export interface MedicationUseInput {
  start_date: string;
  end_date: string | null;
  dosage: string;
  frequency_per_day: number;
}

export interface MedicationCreateInput {
  medication_name: string;
  uses: MedicationUseInput[];
}

export interface MedicationUseUpdateInput {
  medication_name?: string;
  dosage?: string;
  frequency_per_day?: number;
  start_date?: string;
  end_date?: string | null;
}
