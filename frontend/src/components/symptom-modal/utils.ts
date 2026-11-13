import type {
  CalendarSymptom,
  SymptomDateInput,
  SymptomOccurrence,
} from "../../types";
import type { SymptomDateDraft } from "./types";

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function emptyDraft(): SymptomDateDraft {
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

/** Distinct symptom names, most recently logged first, for the combobox. */
export function symptomTitles(symptoms: CalendarSymptom[]): string[] {
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

export function validateDrafts(drafts: SymptomDateDraft[]): string | null {
  if (drafts.length === 0) return "Add at least one date.";
  for (const draft of drafts) {
    if (!draft.start_date) return "Every date needs a start date.";
    if (!draft.ongoing && draft.end_date && draft.end_date < draft.start_date) {
      return "End dates must be on or after their start date.";
    }
  }
  return null;
}

export function toPayload(drafts: SymptomDateDraft[]): SymptomDateInput[] {
  return drafts.map((draft) => ({
    start_date: draft.start_date,
    // An empty end date means a single day; only "ongoing" leaves it open.
    end_date: draft.ongoing ? null : draft.end_date || draft.start_date,
    observation: draft.observation.trim() || null,
  }));
}
