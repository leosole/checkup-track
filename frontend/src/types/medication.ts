export interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency_per_day: number;
  start_date: string;
  end_date: string | null;
  color: string | null;
}

export interface MedicationInput {
  medication_name: string;
  dosage: string;
  frequency_per_day: number;
  start_date: string;
  end_date: string | null;
  color?: string | null;
}
