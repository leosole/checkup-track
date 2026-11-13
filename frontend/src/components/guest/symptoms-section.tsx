import { EmptyState } from "../ui/badge";
import { formatOccurrenceRange } from "../symptoms/utils";
import type { SymptomsSectionProps } from "./types";

/** Read-only, nested view of the symptoms shared with the guest. */
export function SymptomsSection({ symptoms }: SymptomsSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
        Symptoms ({symptoms.length})
      </h2>
      {symptoms.length === 0 ? (
        <EmptyState
          title="No symptoms shared"
          hint="The owner did not include any symptoms in this code."
        />
      ) : (
        <div className="space-y-3">
          {symptoms.map((symptom) => (
            <div
              key={symptom.id}
              className="rounded-lg bg-white p-4 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {symptom.title}
              </h3>
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {symptom.occurrences.map((occurrence) => (
                  <li key={occurrence.id} className="py-2">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {formatOccurrenceRange(occurrence)}
                    </p>
                    {occurrence.observation && (
                      <p className="mt-0.5 whitespace-pre-line text-xs text-gray-500 dark:text-gray-400">
                        {occurrence.observation}
                      </p>
                    )}
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
