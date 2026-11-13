import { EmptyState } from "../ui/badge";
import { formatUseRange } from "../medications/utils";
import type { MedicationsSectionProps } from "./types";

/** Read-only, nested view of the medications shared with the guest. */
export function MedicationsSection({ medications }: MedicationsSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
        Medications ({medications.length})
      </h2>
      {medications.length === 0 ? (
        <EmptyState
          title="No medications shared"
          hint="The owner did not include any medications in this code."
        />
      ) : (
        <div className="space-y-3">
          {medications.map((medication) => (
            <div
              key={medication.id}
              className="rounded-lg bg-white p-4 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {medication.name}
              </h3>
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {medication.uses.map((use) => (
                  <li key={use.id} className="py-2">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {formatUseRange(use)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {use.dosage} · {use.frequency_per_day}x per day
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
