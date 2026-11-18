import type {
  MedicationUse,
  MedicationUseInput,
  SymptomDateInput,
  SymptomOccurrence,
} from "./types";
import type { MedicationUseDraft, SymptomDateDraft } from "./types/forms";
import { toIso } from "./date-utils";

export function todayIso(): string {
  return toIso(new Date());
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

/** Distinct medication names, most recently used first, for suggestions. */
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

function checkDate(value: string, label: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${label} must use YYYY-MM-DD.`;
  }
  return null;
}

export function validateUseDrafts(drafts: MedicationUseDraft[]): string | null {
  if (drafts.length === 0) return "Add at least one use.";
  for (const draft of drafts) {
    if (!draft.dosage.trim()) return "Every use needs a dosage.";
    const frequency = Number(draft.frequency_per_day);
    if (!Number.isInteger(frequency) || frequency < 1) {
      return "Frequency must be a whole number of at least 1.";
    }
    const start_error = checkDate(draft.start_date, "Start date");
    if (start_error) return start_error;
    if (!draft.ongoing && draft.end_date) {
      const end_error = checkDate(draft.end_date, "End date");
      if (end_error) return end_error;
      if (draft.end_date < draft.start_date) {
        return "End dates must be on or after their start date.";
      }
    }
  }
  return null;
}

export function toUsePayload(
  drafts: MedicationUseDraft[],
): MedicationUseInput[] {
  return drafts.map((draft) => ({
    start_date: draft.start_date,
    // An empty end date means a single day; only "ongoing" leaves it open.
    end_date: draft.ongoing ? null : draft.end_date || draft.start_date,
    dosage: draft.dosage.trim(),
    frequency_per_day: Number(draft.frequency_per_day),
  }));
}

export function emptySymptomDraft(): SymptomDateDraft {
  return {
    start_date: todayIso(),
    end_date: "",
    ongoing: false,
    observation: "",
  };
}

export function draftFromOccurrence(
  occurrence: SymptomOccurrence,
): SymptomDateDraft {
  return {
    start_date: occurrence.start_date,
    end_date:
      occurrence.end_date && occurrence.end_date !== occurrence.start_date
        ? occurrence.end_date
        : "",
    ongoing: occurrence.end_date === null,
    observation: occurrence.observation ?? "",
  };
}

/** Distinct symptom titles, most recently logged first. */
export function symptomTitles(symptoms: SymptomOccurrence[]): string[] {
  const latest = new Map<number, { title: string; start_date: string }>();
  for (const symptom of symptoms) {
    const current = latest.get(symptom.symptom_id);
    if (!current || symptom.start_date > current.start_date) {
      latest.set(symptom.symptom_id, {
        title: symptom.title,
        start_date: symptom.start_date,
      });
    }
  }
  return [...latest.values()]
    .sort((left, right) => right.start_date.localeCompare(left.start_date))
    .map((entry) => entry.title);
}

export function validateSymptomDrafts(
  drafts: SymptomDateDraft[],
): string | null {
  if (drafts.length === 0) return "Add at least one date.";
  for (const draft of drafts) {
    const start_error = checkDate(draft.start_date, "Start date");
    if (start_error) return start_error;
    if (!draft.ongoing && draft.end_date) {
      const end_error = checkDate(draft.end_date, "End date");
      if (end_error) return end_error;
      if (draft.end_date < draft.start_date) {
        return "End dates must be on or after their start date.";
      }
    }
  }
  return null;
}

export function toSymptomPayload(
  drafts: SymptomDateDraft[],
): SymptomDateInput[] {
  return drafts.map((draft) => ({
    start_date: draft.start_date,
    end_date: draft.ongoing ? null : draft.end_date || draft.start_date,
    observation: draft.observation.trim() || null,
  }));
}

/** Group uses under their reusable medication name. */
export function groupMedications(uses: MedicationUse[]) {
  const groups = new Map<
    number,
    { id: number; name: string; uses: MedicationUse[] }
  >();
  for (const use of uses) {
    let group = groups.get(use.medication_id);
    if (!group) {
      group = { id: use.medication_id, name: use.name, uses: [] };
      groups.set(use.medication_id, group);
    }
    group.uses.push(use);
  }
  const list = [...groups.values()];
  for (const group of list) {
    group.uses.sort((left, right) =>
      right.start_date.localeCompare(left.start_date),
    );
  }
  return list.sort((left, right) =>
    right.uses[0].start_date.localeCompare(left.uses[0].start_date),
  );
}

/** Group occurrences under their reusable symptom title. */
export function groupSymptoms(occurrences: SymptomOccurrence[]) {
  const groups = new Map<
    number,
    { id: number; title: string; occurrences: SymptomOccurrence[] }
  >();
  for (const occurrence of occurrences) {
    let group = groups.get(occurrence.symptom_id);
    if (!group) {
      group = {
        id: occurrence.symptom_id,
        title: occurrence.title,
        occurrences: [],
      };
      groups.set(occurrence.symptom_id, group);
    }
    group.occurrences.push(occurrence);
  }
  const list = [...groups.values()];
  for (const group of list) {
    group.occurrences.sort((left, right) =>
      right.start_date.localeCompare(left.start_date),
    );
  }
  return list.sort((left, right) =>
    right.occurrences[0].start_date.localeCompare(
      left.occurrences[0].start_date,
    ),
  );
}

export function isOngoing(item: {
  end_date: string | null;
}): boolean {
  return item.end_date === null || item.end_date >= todayIso();
}
