import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../auth-context";
import { useDashboardState } from "./provider";
import { Card, EmptyState } from "../ui/badge";
import { Button } from "../ui/button";
import { groupSymptoms, formatOccurrenceRange } from "../symptoms/utils";

/** Recently logged symptoms, grouped by title. */
export function DashboardSymptomSummary() {
  const { user } = useAuth();
  const dash = useDashboardState();
  const navigate = useNavigate();
  const total = dash.calendar.symptoms.length;
  const groups = groupSymptoms(dash.calendar.symptoms).slice(0, 5);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Recent symptoms
          </h2>
          <Button
            variant="secondary"
            size="sm"
            disabled={!user?.capabilities.create_records}
            onClick={() => {
              dash.set_editing_symptom(null);
              dash.set_symptom_modal_open(true);
            }}
          >
            + Log
          </Button>
        </div>
        <button
          type="button"
          onClick={() => void navigate({ to: "/symptoms" })}
          className="text-sm font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
        >
          View more
        </button>
      </div>
      {total === 0 ? (
        <EmptyState
          title="No symptoms logged"
          hint="Log a symptom to track its dates and observations."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="p-4">
              <button
                type="button"
                onClick={() => void navigate({ to: "/symptoms" })}
                className="block w-full text-left"
              >
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {group.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {formatOccurrenceRange(group.occurrences[0])}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {group.occurrences.length} occurrence
                  {group.occurrences.length === 1 ? "" : "s"}
                </p>
              </button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
