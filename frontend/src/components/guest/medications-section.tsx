import { formatDate } from "../../date-utils";
import { EmptyState } from "../ui/badge";
import type { MedicationsSectionProps } from "./types";

/** Read-only list of medications shared with the guest. */
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
        <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th scope="col" className="px-4 py-3">
                  Medication
                </th>
                <th scope="col" className="px-4 py-3">
                  Dosage
                </th>
                <th scope="col" className="px-4 py-3">
                  Frequency
                </th>
                <th scope="col" className="px-4 py-3">
                  Dates
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {medications.map((medication) => (
                <tr key={medication.id}>
                  <th
                    scope="row"
                    className="px-4 py-3 font-medium text-gray-900 dark:text-white"
                  >
                    {medication.name}
                  </th>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {medication.dosage}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                    {medication.frequency_per_day}x per day
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                    {formatDate(medication.start_date)} -{" "}
                    {medication.end_date
                      ? formatDate(medication.end_date)
                      : "Ongoing"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
