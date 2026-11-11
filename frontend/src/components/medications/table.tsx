import { formatDate } from "../../date-utils";
import { Badge } from "../ui/badge";
import type { MedicationTableProps } from "./types";

/** Medication rows with active status and row actions. */
export function MedicationTable({
  medications,
  can_delete,
  deleting_id,
  isActive,
  on_edited_medication,
  on_deleted_medication,
}: MedicationTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
      <table className="w-full min-w-[780px] border-collapse text-left">
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
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {medications.map((medication) => (
            <tr key={medication.id} className="text-sm">
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
              <td className="px-4 py-3">
                <Badge tone={isActive(medication) ? "success" : "gray"}>
                  {isActive(medication) ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    aria-label={`Edit ${medication.name}`}
                    title="Edit medication"
                    onClick={() => on_edited_medication(medication.id)}
                    className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M2.695 14.763l-1.262 3.155a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${medication.name}`}
                    title="Delete medication"
                    disabled={!can_delete || deleting_id === medication.id}
                    onClick={() => on_deleted_medication(medication.id)}
                    className="rounded-lg p-2 text-gray-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.75 1A2.75 2.75 0 006 3.75V4H3.75a.75.75 0 000 1.5h.616l.74 10.5A2.75 2.75 0 007.846 18.5h4.308a2.75 2.75 0 002.744-2.5l.74-10.5h.616a.75.75 0 000-1.5H14v-.25A2.75 2.75 0 0011.25 1h-2.5zM7.5 4v.25c0 .69.56 1.25 1.25 1.25h2.5c.69 0 1.25-.56 1.25-1.25V4h-5zm1.5 4.5a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0v-5zm3.75-.75a.75.75 0 000 1.5v5a.75.75 0 001.5 0v-5a.75.75 0 00-1.5 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
