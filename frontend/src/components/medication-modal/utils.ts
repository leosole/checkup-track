import type { MedicationUse, MedicationUseInput } from "../../types";
import type { MedicationUseDraft } from "./types";

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function emptyUseDraft(): MedicationUseDraft {
  return {
    start_date: todayIso(),
    end_date: "",
    ongoing: false,
    dosage: "",
    frequency_per_day: "1",
  };
}

export function draftFromUse(use: MedicationUse): MedicationUseDraft {
  return {
    start_date: use.start_date,
    end_date:
      use.end_date && use.end_date !== use.start_date ? use.end_date : "",
    ongoing: use.end_date === null,
    dosage: use.dosage,
    frequency_per_day: String(use.frequency_per_day),
  };
}

/** Distinct medication names, most recently used first, for the combobox. */
export function medicationNames(uses: MedicationUse[]): string[] {
  const latest = new Map<number, { name: string; start_date: string }>();
  for (const use of uses) {
    const current = latest.get(use.medication_id);
    if (!current || use.start_date > current.start_date) {
      latest.set(use.medication_id, {
        name: use.name,
        start_date: use.start_date,
      });
    }
  }
  return [...latest.values()]
    .sort((left, right) => right.start_date.localeCompare(left.start_date))
    .map((entry) => entry.name);
}

export function validateDrafts(drafts: MedicationUseDraft[]): string | null {
  if (drafts.length === 0) return "Add at least one use.";
  for (const draft of drafts) {
    if (!draft.dosage.trim()) return "Every use needs a dosage.";
    const frequency = Number(draft.frequency_per_day);
    if (!Number.isInteger(frequency) || frequency < 1) {
      return "Frequency must be a whole number of at least 1.";
    }
    if (!draft.start_date) return "Every use needs a start date.";
    if (!draft.ongoing && draft.end_date && draft.end_date < draft.start_date) {
      return "End dates must be on or after their start date.";
    }
  }
  return null;
}

export function toPayload(drafts: MedicationUseDraft[]): MedicationUseInput[] {
  return drafts.map((draft) => ({
    start_date: draft.start_date,
    // An empty end date means a single day; only "ongoing" leaves it open.
    end_date: draft.ongoing ? null : draft.end_date || draft.start_date,
    dosage: draft.dosage.trim(),
    frequency_per_day: Number(draft.frequency_per_day),
  }));
}
