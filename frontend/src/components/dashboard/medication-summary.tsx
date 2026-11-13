import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../auth-context";
import { useDashboardState } from "./provider";
import { Card, EmptyState } from "../ui/badge";
import { Button } from "../ui/button";
import { formatUseRange, groupMedications } from "../medications/utils";

/** Recently used medications, grouped by name. */
export function DashboardMedicationSummary() {
  const { user } = useAuth();
  const dash = useDashboardState();
  const navigate = useNavigate();
  const total = dash.medications.length;
  const groups = groupMedications(dash.medications).slice(0, 5);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Medications
          </h2>
          <Button
            variant="secondary"
            size="sm"
            disabled={!user?.capabilities.create_records}
            onClick={() => {
              dash.set_editing_med(null);
              dash.set_modal_open(true);
            }}
          >
            + Add
          </Button>
        </div>
        <button
          type="button"
          onClick={() => void navigate({ to: "/medications" })}
          className="text-sm font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
        >
          View more
        </button>
      </div>
      {total === 0 ? (
        <EmptyState
          title="No medications tracked"
          hint="Add a medication to see its uses on the calendar timeline."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="flex items-start justify-between gap-2 p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {group.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {group.uses[0].dosage} · {group.uses[0].frequency_per_day}×/day
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {formatUseRange(group.uses[0])}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {group.uses.length} use{group.uses.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Edit ${group.name}`}
                  title="Edit medication"
                  disabled={!user?.capabilities.edit_medications}
                  onClick={() => {
                    dash.set_editing_med(group.uses[0]);
                    dash.set_modal_open(true);
                  }}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
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
                  aria-label={`Delete ${group.name}`}
                  title="Delete medication"
                  disabled={!user?.capabilities.delete_records}
                  onClick={() => void dash.deleteMedication(group.uses[0])}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
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
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
