import { formatDate, toIso } from "../../date-utils";
import type { MedicationUse } from "../../types";
import type { MedicationGroup } from "./types";

/** Group uses under their reusable medication name. */
export function groupMedications(uses: MedicationUse[]): MedicationGroup[] {
  const groups = new Map<number, MedicationGroup>();
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

export function formatUseRange(use: {
  start_date: string;
  end_date: string | null;
}): string {
  if (use.end_date === null) {
    return `${formatDate(use.start_date)} — Ongoing`;
  }
  if (use.end_date === use.start_date) {
    return formatDate(use.start_date);
  }
  return `${formatDate(use.start_date)} — ${formatDate(use.end_date)}`;
}

/** Ongoing means no end date yet, or an end date that has not passed. */
export function isOngoing(use: MedicationUse): boolean {
  return use.end_date === null || use.end_date >= toIso(new Date());
}
