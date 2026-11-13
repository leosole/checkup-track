import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "../api-client";
import { useAuth } from "../auth-context";
import { useDashboardState } from "../components/dashboard/provider";
import { MedicationModal } from "../components/medication-modal";
import { medicationNames } from "../components/medication-modal/utils";
import { MedicationFilters } from "../components/medications/filters";
import { MedicationList } from "../components/medications/list";
import type { MedicationStatus } from "../components/medications/types";
import { groupMedications, isOngoing } from "../components/medications/utils";
import { EmptyState, Spinner } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { notify } from "../components/ui/toast";
import type { MedicationUse } from "../types";

function MedicationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dash = useDashboardState();
  const uses = dash.medications;
  const [query, set_query] = useState("");
  const [status, set_status] = useState<MedicationStatus>("all");
  const [editing_use, set_editing_use] = useState<MedicationUse | null>(null);
  const [modal_open, set_modal_open] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const normalized_query = query.trim().toLowerCase();
  const groups = groupMedications(uses)
    .map((group) => ({
      ...group,
      uses: group.uses.filter(
        (use) =>
          (status === "all" || (status === "ongoing") === isOngoing(use)) &&
          (!normalized_query ||
            group.name.toLowerCase().includes(normalized_query) ||
            use.dosage.toLowerCase().includes(normalized_query)),
      ),
    }))
    .filter((group) => group.uses.length > 0);
  const visible_count = groups.reduce(
    (sum, group) => sum + group.uses.length,
    0,
  );

  async function deleteUse(use: MedicationUse) {
    if (!user?.capabilities.delete_records) return;
    if (
      !window.confirm(
        `Delete this "${use.name}" use? This cannot be undone.`,
      )
    ) {
      return;
    }
    set_error(null);
    try {
      await api.deleteMedicationUse(use.id);
      await dash.refresh();
      notify.success(`“${use.name}” use deleted.`);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not delete the use.",
      );
    }
  }

  function openUse(use: MedicationUse | null) {
    if (!use && !user?.capabilities.create_records) return;
    set_editing_use(use);
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
                  {uses.length} use{uses.length === 1 ? "" : "s"} on file
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                disabled={!user?.capabilities.create_records}
                onClick={() => openUse(null)}
              >
                Add medication
              </Button>
            </div>
          </div>

          <MedicationFilters
            query={query}
            status={status}
            on_query_change={set_query}
            on_status_change={set_status}
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
            Showing {visible_count} of {uses.length}
          </p>
          {visible_count === 0 ? (
            <EmptyState
              title={
                uses.length === 0
                  ? "No medications tracked"
                  : "No medications match these filters"
              }
              hint={
                uses.length === 0
                  ? "Add a medication to see its uses in the calendar."
                  : undefined
              }
            />
          ) : (
            <MedicationList
              groups={groups}
              can_edit={Boolean(user?.capabilities.edit_medications)}
              can_delete={Boolean(user?.capabilities.delete_records)}
              on_edit={openUse}
              on_delete={(use) => void deleteUse(use)}
            />
          )}

          <MedicationModal
            open={
              modal_open &&
              (editing_use !== null || Boolean(user?.capabilities.create_records))
            }
            use={editing_use}
            names={medicationNames(uses)}
            on_close={() => {
              set_modal_open(false);
              set_editing_use(null);
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
