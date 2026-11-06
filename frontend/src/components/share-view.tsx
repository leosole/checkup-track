import { useCallback, useEffect, useState } from "react";
import {
  api,
  type Exam,
  type Medication,
  type ShareCreated,
  type ShareGroup,
} from "../api-client";
import { format_date } from "../date-utils";
import { use_auth } from "../auth-context";
import { Badge, Card, EmptyState, Spinner } from "./ui/badge";
import { Button } from "./ui/button";

const EXPIRY_OPTIONS = [1, 3, 7, 30];

const STATUS_TONES = {
  active: "success",
  used: "info",
  expired: "gray",
  revoked: "danger",
} as const;

function guest_url(): string {
  if (typeof window === "undefined") return "/guest";
  return `${window.location.origin}/guest`;
}

function format_timestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

const SELECT_CLASS =
  "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset " +
  "ring-gray-300 focus:ring-2 focus:ring-brand-600 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700";

const CHECKBOX_CLASS =
  "h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-600 " +
  "dark:border-gray-600 dark:bg-gray-800";

export function ShareView({
  exams,
  medications,
  on_back,
}: {
  exams: Exam[];
  medications: Medication[];
  on_back: () => void;
}) {
  const { user } = use_auth();
  const [selected_exams, set_selected_exams] = useState<Set<number>>(new Set());
  const [selected_medications, set_selected_medications] = useState<Set<number>>(
    new Set(),
  );
  const [expires_in_days, set_expires_in_days] = useState(7);
  const [groups, set_groups] = useState<ShareGroup[]>([]);
  const [loading_groups, set_loading_groups] = useState(true);
  const [creating, set_creating] = useState(false);
  const [sharing_group_key, set_sharing_group_key] = useState<string | null>(null);
  const [revoking_id, set_revoking_id] = useState<number | null>(null);
  const [created, set_created] = useState<ShareCreated | null>(null);
  const [copied, set_copied] = useState<"code" | "link" | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const load_groups = useCallback(async () => {
    try {
      set_groups(await api.list_share_groups());
      set_error(null);
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Could not load shared items.");
    } finally {
      set_loading_groups(false);
    }
  }, []);

  useEffect(() => {
    void load_groups();
  }, [load_groups]);

  // Drop selections for records that disappeared while this page was open.
  useEffect(() => {
    set_selected_exams((current) => {
      const next = new Set(
        [...current].filter((id) => exams.some((exam) => exam.id === id)),
      );
      return next.size === current.size ? current : next;
    });
  }, [exams]);

  useEffect(() => {
    set_selected_medications((current) => {
      const next = new Set(
        [...current].filter((id) =>
          medications.some((medication) => medication.id === id),
        ),
      );
      return next.size === current.size ? current : next;
    });
  }, [medications]);

  const has_selection =
    selected_exams.size > 0 || selected_medications.size > 0;
  const all_exams_selected =
    exams.length > 0 && selected_exams.size === exams.length;
  const all_medications_selected =
    medications.length > 0 && selected_medications.size === medications.length;
  const total_codes = groups.reduce((sum, group) => sum + group.codes.length, 0);

  function toggle_exam(id: number) {
    set_selected_exams((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggle_medication(id: number) {
    set_selected_medications((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggle_all_exams() {
    set_selected_exams(
      all_exams_selected ? new Set() : new Set(exams.map((exam) => exam.id)),
    );
  }

  function toggle_all_medications() {
    set_selected_medications(
      all_medications_selected
        ? new Set()
        : new Set(medications.map((medication) => medication.id)),
    );
  }

  async function create_share() {
    if (!has_selection) return;
    set_creating(true);
    set_error(null);
    try {
      const result = await api.create_share({
        exam_ids: [...selected_exams],
        medication_ids: [...selected_medications],
        expires_in_days,
      });
      set_created(result);
      await load_groups();
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Could not create a share code.");
    } finally {
      set_creating(false);
    }
  }

  async function share_again(group: ShareGroup) {
    set_sharing_group_key(group.group_key);
    set_error(null);
    try {
      const result = await api.create_share({
        exam_ids: group.exam_ids,
        medication_ids: group.medication_ids,
        expires_in_days,
      });
      set_created(result);
      await load_groups();
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Could not create a share code.");
    } finally {
      set_sharing_group_key(null);
    }
  }

  async function revoke(code_id: number) {
    if (!user?.capabilities.revoke_shares) return;
    if (
      !window.confirm(
        "Revoke this code? Anyone using it loses access immediately. The records stay in your account.",
      )
    ) {
      return;
    }
    set_revoking_id(code_id);
    set_error(null);
    try {
      await api.revoke_share(code_id);
      await load_groups();
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Could not revoke this code.");
    } finally {
      set_revoking_id(null);
    }
  }

  async function copy(value: string, target: "code" | "link") {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      set_copied(target);
      window.setTimeout(() => set_copied(null), 2000);
    } catch {
      set_error("Could not copy to the clipboard. Select the text and copy it manually.");
    }
  }

  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          aria-label="Back to dashboard"
          title="Back to dashboard"
          onClick={on_back}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.56l3.22 3.22a.75.75 0 11-1.06 1.06l-4.5-4.5a.75.75 0 010-1.06l4.5-4.5a.75.75 0 111.06 1.06l-3.22 3.22h10.69A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Share your records
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Pick the exams and medications to share, then send the one-time code.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      {created && created.share.code && (
        <Card className="mb-5 border border-brand-200 p-5 dark:border-brand-500/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                Share code
              </p>
              <p className="mt-2 break-all font-mono text-2xl font-semibold tracking-[0.15em] text-gray-900 dark:text-white">
                {created.share.code}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Expires {format_timestamp(created.share.expires_at)} · single use ·
                read-only
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void copy(created.share.code ?? "", "code")}
              >
                {copied === "code" ? "Copied" : "Copy code"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void copy(guest_url(), "link")}
              >
                {copied === "link" ? "Copied" : "Copy guest link"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => set_created(null)}>
                Dismiss
              </Button>
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            Send the code, or this link:{" "}
            <span className="font-mono text-xs">{guest_url()}</span>. The code is shown
            only once and works for a single guest.
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Exams
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {selected_exams.size} of {plural(exams.length, "exam")} selected
              </p>
            </div>
            {exams.length > 0 && (
              <button
                type="button"
                onClick={toggle_all_exams}
                className="text-xs font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
              >
                {all_exams_selected ? "Clear" : "Select all"}
              </button>
            )}
          </div>
          {exams.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No exams to share yet.
            </p>
          ) : (
            <ul className="mt-3 max-h-64 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
              {exams.map((exam) => (
                <li key={exam.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      className={CHECKBOX_CLASS}
                      checked={selected_exams.has(exam.id)}
                      onChange={() => toggle_exam(exam.id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                        {exam.title}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {format_date(exam.date_performed)} ·{" "}
                        {plural(exam.biomarkers.length, "biomarker")}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Medications
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {selected_medications.size} of{" "}
                {plural(medications.length, "medication")} selected
              </p>
            </div>
            {medications.length > 0 && (
              <button
                type="button"
                onClick={toggle_all_medications}
                className="text-xs font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
              >
                {all_medications_selected ? "Clear" : "Select all"}
              </button>
            )}
          </div>
          {medications.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No medications to share yet.
            </p>
          ) : (
            <ul className="mt-3 max-h-64 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
              {medications.map((medication) => (
                <li key={medication.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      className={CHECKBOX_CLASS}
                      checked={selected_medications.has(medication.id)}
                      onChange={() => toggle_medication(medication.id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                        {medication.name}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {medication.dosage} · {medication.frequency_per_day}x per day
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 flex flex-wrap items-end gap-3 p-4">
        <label className="w-40">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
            Code expires after
          </span>
          <select
            value={expires_in_days}
            onChange={(event) => set_expires_in_days(Number(event.target.value))}
            className={SELECT_CLASS}
          >
            {EXPIRY_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {plural(days, "day")}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => void create_share()}
          loading={creating}
          disabled={!has_selection}
        >
          Create one-time code
        </Button>
        <p className="pb-1 text-xs text-gray-500 dark:text-gray-400">
          A code can be redeemed once and only allows viewing the selected records.
        </p>
      </Card>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Previously shared
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Each group is one selection of records. Sharing it again issues a new
              code for the same selection.
            </p>
          </div>
          <Badge tone="gray">
            {plural(groups.length, "group")} · {plural(total_codes, "code")}
          </Badge>
        </div>

        {loading_groups ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-8 w-8" />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            title="Nothing shared yet"
            hint="Select exams or medications above to create your first one-time code."
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
                      Last shared {format_timestamp(group.last_shared_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={sharing_group_key === group.group_key}
                    onClick={() => void share_again(group)}
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
                </div>

                <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
                  {group.codes.map((code) => (
                    <li
                      key={code.id}
                      className="flex flex-wrap items-center gap-3 py-2 text-xs"
                    >
                      <Badge tone={STATUS_TONES[code.status]}>{code.status}</Badge>
                      <span className="text-gray-500 dark:text-gray-400">
                        Created {format_timestamp(code.created_at)}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">
                        expires {format_timestamp(code.expires_at)}
                      </span>
                      {user?.capabilities.revoke_shares && (code.status === "active" || code.status === "used") && (
                        <button
                          type="button"
                          onClick={() => void revoke(code.id)}
                          disabled={revoking_id === code.id}
                          className="ml-auto font-semibold text-rose-600 transition hover:text-rose-700 disabled:opacity-60 dark:text-rose-400 dark:hover:text-rose-300"
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
    </section>
  );
}
