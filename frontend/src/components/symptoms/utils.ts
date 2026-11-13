import { formatDate, toIso } from "../../date-utils";
import type { SymptomOccurrence } from "../../types";
import type { SymptomGroup } from "./types";

/** Group occurrences under their reusable symptom title. */
export function groupSymptoms(
  occurrences: SymptomOccurrence[],
): SymptomGroup[] {
  const groups = new Map<number, SymptomGroup>();
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

export function formatOccurrenceRange(occurrence: {
  start_date: string;
  end_date: string | null;
}): string {
  if (occurrence.end_date === null) {
    return `${formatDate(occurrence.start_date)} — Ongoing`;
  }
  if (occurrence.end_date === occurrence.start_date) {
    return formatDate(occurrence.start_date);
  }
  return `${formatDate(occurrence.start_date)} — ${formatDate(
    occurrence.end_date,
  )}`;
}

/** Ongoing means no end date yet, or an end date that has not passed. */
export function isOngoing(occurrence: SymptomOccurrence): boolean {
  return (
    occurrence.end_date === null || occurrence.end_date >= toIso(new Date())
  );
}
