import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "../api-client";
import { useAuth } from "../auth-context";
import { useDashboardState } from "../components/dashboard/provider";
import { SymptomFilters } from "../components/symptoms/filters";
import { SymptomList } from "../components/symptoms/list";
import type { SymptomStatus } from "../components/symptoms/types";
import { groupSymptoms, isOngoing } from "../components/symptoms/utils";
import { EmptyState, Spinner } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { notify } from "../components/ui/toast";
import type { SymptomOccurrence } from "../types";

function SymptomsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dash = useDashboardState();
  const occurrences = dash.calendar.symptoms;
  const [query, set_query] = useState("");
  const [status, set_status] = useState<SymptomStatus>("all");
  const [deleting_id, set_deleting_id] = useState<number | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const normalized_query = query.trim().toLowerCase();
  const groups = groupSymptoms(occurrences)
    .map((group) => ({
      ...group,
      occurrences: group.occurrences.filter(
        (occurrence) =>
          (status === "all" ||
            (status === "ongoing") === isOngoing(occurrence)) &&
          (!normalized_query ||
            group.title.toLowerCase().includes(normalized_query) ||
            (occurrence.observation ?? "")
              .toLowerCase()
              .includes(normalized_query)),
      ),
    }))
    .filter((group) => group.occurrences.length > 0);
  const visible_count = groups.reduce(
    (sum, group) => sum + group.occurrences.length,
    0,
  );

  async function deleteOccurrence(occurrence: SymptomOccurrence) {
    if (!user?.capabilities.delete_records) return;
    if (
      !window.confirm(
        `Delete this "${occurrence.title}" occurrence? This cannot be undone.`,
      )
    ) {
      return;
    }
    set_deleting_id(occurrence.id);
    set_error(null);
    try {
      await api.deleteSymptomOccurrence(occurrence.id);
      await dash.refresh();
      notify.success(`“${occurrence.title}” occurrence deleted.`);
    } catch (err) {
      set_error(
        err instanceof Error
          ? err.message
          : "Could not delete the symptom occurrence.",
      );
    } finally {
      set_deleting_id(null);
    }
  }

  function editOccurrence(occurrence: SymptomOccurrence) {
    dash.set_editing_symptom(occurrence);
    dash.set_symptom_modal_open(true);
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
                  All symptoms
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {occurrences.length} occurrence
                  {occurrences.length === 1 ? "" : "s"} on file
                </p>
              </div>
            </div>
            <Button
              disabled={!user?.capabilities.create_records}
              onClick={() => {
                dash.set_editing_symptom(null);
                dash.set_symptom_modal_open(true);
              }}
            >
              Log symptom
            </Button>
          </div>

          <SymptomFilters
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
            Showing {visible_count} of {occurrences.length}
            {deleting_id !== null && " · deleting…"}
          </p>
          {groups.length === 0 ? (
            <EmptyState
              title={
                occurrences.length === 0
                  ? "No symptoms logged"
                  : "No symptoms match these filters"
              }
              hint={
                occurrences.length === 0
                  ? "Log a symptom to see it in the calendar."
                  : undefined
              }
            />
          ) : (
            <SymptomList
              groups={groups}
              can_edit={Boolean(user?.capabilities.edit_symptoms)}
              can_delete={Boolean(user?.capabilities.delete_records)}
              on_edit={editOccurrence}
              on_delete={(occurrence) => void deleteOccurrence(occurrence)}
            />
          )}
        </section>
      )}
    </main>
  );
}

export const Route = createFileRoute("/symptoms")({
  component: SymptomsPage,
});
