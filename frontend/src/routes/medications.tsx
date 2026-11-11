import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "../api-client";
import { useAuth } from "../auth-context";
import { useDashboardState } from "../components/dashboard/provider";
import { MedicationModal } from "../components/medication-modal";
import { MedicationFilters } from "../components/medications/filters";
import { MedicationTable } from "../components/medications/table";
import type {
  MedicationSort,
  MedicationStatus,
} from "../components/medications/types";
import { EmptyState, Spinner } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { notify } from "../components/ui/toast";
import { toggleSort } from "../sort-utils";
import type { Medication } from "../types";

function MedicationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dash = useDashboardState();
  const medications = dash.medications;
  const [query, set_query] = useState("");
  const [status, set_status] = useState<MedicationStatus>("all");
  const [start_from, set_start_from] = useState("");
  const [start_to, set_start_to] = useState("");
  const [sort, set_sort] = useState<MedicationSort>({
    field: "start_date",
    direction: "desc",
  });
  const [editing_med, set_editing_med] = useState<Medication | null>(null);
  const [modal_open, set_modal_open] = useState(false);
  const [deleting_id, set_deleting_id] = useState<number | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  function isActive(medication: Medication) {
    return (
      medication.start_date <= today &&
      (!medication.end_date || medication.end_date >= today)
    );
  }

  const normalized_query = query.trim().toLowerCase();
  const visible_medications = medications
    .filter((medication) => {
      const active = isActive(medication);
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
      const factor = sort.direction === "asc" ? 1 : -1;
      if (sort.field === "name") {
        return factor * left.name.localeCompare(right.name);
      }
      return factor * left.start_date.localeCompare(right.start_date);
    });

  async function deleteMedication(medication: Medication) {
    if (!user?.capabilities.delete_records) return;
    if (
      !window.confirm(`Delete "${medication.name}"? This cannot be undone.`)
    ) {
      return;
    }
    set_deleting_id(medication.id);
    set_error(null);
    try {
      await api.deleteMedication(medication.id);
      await dash.refresh();
      notify.success(`“${medication.name}” deleted.`);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not delete the medication.",
      );
    } finally {
      set_deleting_id(null);
    }
  }

  function openMedication(medication: Medication | null) {
    if (!medication && !user?.capabilities.create_records) return;
    set_editing_med(medication);
    set_modal_open(true);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {dash.loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Back to dashboard"
                title="Back to dashboard"
                onClick={() => void navigate({ to: "/" })}
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
              <Button
                disabled={!user?.capabilities.create_records}
                onClick={() => openMedication(null)}
              >
                Add medication
              </Button>
            </div>
          </div>

          <MedicationFilters
            query={query}
            status={status}
            start_from={start_from}
            start_to={start_to}
            on_query_change={set_query}
            on_status_change={set_status}
            on_start_from_change={set_start_from}
            on_start_to_change={set_start_to}
          />

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
            <MedicationTable
              medications={visible_medications}
              can_delete={Boolean(user?.capabilities.delete_records)}
              deleting_id={deleting_id}
              isActive={isActive}
              sort={sort}
              on_sort_change={(field) =>
                set_sort((current) => toggleSort(current, field))
              }
              on_edited_medication={(medicationId: number) => {
                const medication = medications.find(
                  (item) => item.id === medicationId,
                );
                if (medication) openMedication(medication);
              }}
              on_deleted_medication={(id: number) => {
                const medication = medications.find((item) => item.id === id);
                if (medication) void deleteMedication(medication);
              }}
            />
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
            on_saved={() => void dash.refresh()}
          />
        </section>
      )}
    </main>
  );
}

export const Route = createFileRoute("/medications")({
  component: MedicationsPage,
});
