import { Badge, Card, EmptyState, Spinner } from "../ui/badge";
import { Button } from "../ui/button";
import { STATUS_TONES, formatTimestamp, plural } from "./share-utils";
import type { GroupListProps } from "./types";

/** Previously shared selections, with their codes and revoke actions. */
export function GroupList({
  groups,
  loading,
  sharing_group_key,
  revoking_id,
  can_revoke,
  on_share_again,
  on_revoke,
}: GroupListProps) {
  const total_codes = groups.reduce(
    (sum, group) => sum + group.codes.length,
    0,
  );

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Previously shared
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Each group is one selection of records. Sharing it again issues a
            new code for the same selection.
          </p>
        </div>
        <Badge tone="gray">
          {plural(groups.length, "group")} · {plural(total_codes, "code")}
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-8 w-8" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Nothing shared yet"
          hint="Select exams, medications or symptoms above to create your first one-time code."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.group_key} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Shared {plural(group.times_shared, "time")}
                    </p>
                    {group.active_codes > 0 && (
                      <Badge tone="success">
                        {plural(group.active_codes, "active code")}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Last shared {formatTimestamp(group.last_shared_at)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={sharing_group_key === group.group_key}
                  onClick={() => on_share_again(group)}
                >
                  Share again
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {group.exams.map((exam) => (
                  <Badge key={`exam-${exam.id}`} tone="brand">
                    {exam.title}
                  </Badge>
                ))}
                {group.medications.map((medication) => (
                  <Badge key={`medication-${medication.id}`} tone="info">
                    {medication.name} · {medication.dosage}
                  </Badge>
                ))}
                {group.symptoms.map((symptom) => (
                  <Badge key={`symptom-${symptom.id}`} tone="danger">
                    {symptom.title} · {plural(symptom.occurrences.length, "occurrence")}
                  </Badge>
                ))}
              </div>

              <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
                {group.codes.map((code) => (
                  <li
                    key={code.id}
                    className="flex flex-wrap items-center gap-3 py-2 text-xs"
                  >
                    <Badge tone={STATUS_TONES[code.status]}>
                      {code.status}
                    </Badge>
                    <span className="text-gray-500 dark:text-gray-400">
                      Created {formatTimestamp(code.created_at)}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">
                      expires {formatTimestamp(code.expires_at)}
                    </span>
                    {(code.status === "active" || code.status === "used") && (
                      <button
                        type="button"
                        onClick={() => on_revoke(code.id)}
                        disabled={!can_revoke || revoking_id === code.id}
                        className="ml-auto font-semibold text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-400 dark:hover:text-rose-300"
                      >
                        {revoking_id === code.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
