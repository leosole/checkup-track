import { useState } from "react";
import { api, type Medication } from "../api-client";
import { use_auth } from "../auth-context";
import { format_date } from "../date-utils";
import { MedicationModal } from "./modal/medication-modal";
import { Badge, EmptyState } from "./ui/badge";
import { Button } from "./ui/button";

type MedicationStatus = "all" | "active" | "inactive";
type MedicationSort = "newest" | "oldest" | "name-asc" | "name-desc";

export function MedicationsView({
  medications,
  on_back,
  on_changed,
  on_deleted,
}: {
  medications: Medication[];
  on_back: () => void;
  on_changed: () => Promise<void>;
  on_deleted: (id: number) => Promise<void>;
}) {
  const { user } = use_auth();
  const [query, set_query] = useState("");
  const [status, set_status] = useState<MedicationStatus>("all");
  const [start_from, set_start_from] = useState("");
  const [start_to, set_start_to] = useState("");
  const [sort, set_sort] = useState<MedicationSort>("newest");
  const [editing_med, set_editing_med] = useState<Medication | null>(null);
  const [modal_open, set_modal_open] = useState(false);
  const [deleting_id, set_deleting_id] = useState<number | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  function is_active(medication: Medication) {
    return (
      medication.start_date <= today &&
      (!medication.end_date || medication.end_date >= today)
    );
  }

  const normalized_query = query.trim().toLowerCase();
  const visible_medications = medications
    .filter((medication) => {
      const active = is_active(medication);
      return (
        (!normalized_query ||
          medication.name.toLowerCase().includes(normalized_query) ||
          medication.dosage.toLowerCase().includes(normalized_query)) &&
        (status === "all" || (status === "active") === active) &&
        (!start_from || medication.start_date >= start_from) &&
        (!start_to || medication.start_date <= start_to)
      );
    })
    .sort((left, right) => {
      if (sort === "name-asc") return left.name.localeCompare(right.name);
      if (sort === "name-desc") return right.name.localeCompare(left.name);
      const date_order = left.start_date.localeCompare(right.start_date);
      return sort === "newest" ? -date_order : date_order;
    });

  async function delete_medication(medication: Medication) {
    if (!user?.capabilities.delete_records) return;
    if (
      !window.confirm(`Delete "${medication.name}"? This cannot be undone.`)
    ) {
      return;
    }
    set_deleting_id(medication.id);
    set_error(null);
    try {
      await api.delete_medication(medication.id);
      await on_deleted(medication.id);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not delete the medication.",
      );
    } finally {
      set_deleting_id(null);
    }
  }

  function open_medication(medication: Medication | null) {
    if (!medication && !user?.capabilities.create_records) return;
    set_editing_med(medication);
    set_modal_open(true);
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Back to dashboard"
            title="Back to dashboard"
            onClick={on_back}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.56l3.22 3.22a.75.75 0 11-1.06 1.06l-4.5-4.5a.75.75 0 010-1.06l4.5-4.5a.75.75 0 111.06 1.06l-3.22 3.22h10.69A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              All medications
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {medications.length} medication
              {medications.length === 1 ? "" : "s"} on file
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.capabilities.create_records && (
            <Button onClick={() => open_medication(null)}>
              Add medication
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="sm:col-span-2 lg:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => set_query(event.target.value)}
            placeholder="Medication or dosage"
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Status
          </span>
          <select
            value={status}
            onChange={(event) =>
              set_status(event.target.value as MedicationStatus)
            }
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
          >
            <option value="all">All medications</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Started from
          </span>
          <input
            type="date"
            value={start_from}
            max={start_to || undefined}
            onChange={(event) => set_start_from(event.target.value)}
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Started to
          </span>
          <input
            type="date"
            value={start_to}
            min={start_from || undefined}
            onChange={(event) => set_start_to(event.target.value)}
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Sort by
          </span>
          <select
            value={sort}
            onChange={(event) => set_sort(event.target.value as MedicationSort)}
            className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700"
          >
            <option value="newest">Start date, newest</option>
            <option value="oldest">Start date, oldest</option>
            <option value="name-asc">Name A to Z</option>
            <option value="name-desc">Name Z to A</option>
          </select>
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <p
        className="mb-2 text-xs text-gray-500 dark:text-gray-400"
        aria-live="polite"
      >
        Showing {visible_medications.length} of {medications.length}
      </p>
      {visible_medications.length === 0 ? (
        <EmptyState
          title={
            medications.length === 0
              ? "No medications tracked"
              : "No medications match these filters"
          }
          hint={
            medications.length === 0
              ? "Add a regimen to see it in the calendar."
              : undefined
          }
        />
      ) : (
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
              {visible_medications.map((medication) => (
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
                    {format_date(medication.start_date)} -{" "}
                    {medication.end_date
                      ? format_date(medication.end_date)
                      : "Ongoing"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={is_active(medication) ? "success" : "gray"}>
                      {is_active(medication) ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        aria-label={`Edit ${medication.name}`}
                        title="Edit medication"
                        onClick={() => open_medication(medication)}
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
                      {user?.capabilities.delete_records && (
                        <button
                          type="button"
                          aria-label={`Delete ${medication.name}`}
                          title="Delete medication"
                          disabled={deleting_id === medication.id}
                          onClick={() => void delete_medication(medication)}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
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
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MedicationModal
        open={
          modal_open &&
          (editing_med !== null || Boolean(user?.capabilities.create_records))
        }
        med={editing_med}
        onClose={() => {
          set_modal_open(false);
          set_editing_med(null);
        }}
        on_saved={() => void on_changed()}
      />
    </section>
  );
}
