import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "../api-client";
import { useAuth } from "../auth-context";
import { formatDate } from "../date-utils";
import { useDashboardState } from "../components/dashboard/provider";
import { CreatedCode } from "../components/share/created-code";
import { GroupList } from "../components/share/group-list";
import { SelectionCard } from "../components/share/selection-card";
import { SymptomSelectionCard } from "../components/share/symptom-selection-card";
import {
  EXPIRY_OPTIONS,
  SELECT_CLASS,
  plural,
} from "../components/share/share-utils";
import type { CopyTarget, SelectionItem } from "../components/share/types";
import { groupSymptoms } from "../components/symptoms/utils";
import { Card } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import type { ShareCreated, ShareGroup } from "../types";

function SharePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dash = useDashboardState();
  const exams = dash.exams;
  const medications = dash.medications;
  const [selected_exams, set_selected_exams] = useState<Set<number>>(new Set());
  const [selected_medications, set_selected_medications] = useState<
    Set<number>
  >(new Set());
  const [selected_symptoms, set_selected_symptoms] = useState<Set<number>>(
    new Set(),
  );
  const [expires_in_days, set_expires_in_days] = useState(7);
  const [groups, set_groups] = useState<ShareGroup[]>([]);
  const [loading_groups, set_loading_groups] = useState(true);
  const [creating, set_creating] = useState(false);
  const [sharing_group_key, set_sharing_group_key] = useState<string | null>(
    null,
  );
  const [renaming_group_key, set_renaming_group_key] = useState<string | null>(
    null,
  );
  const [revoking_id, set_revoking_id] = useState<number | null>(null);
  const [created, set_created] = useState<ShareCreated | null>(null);
  const [copied, set_copied] = useState<CopyTarget | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const load_groups = useCallback(async () => {
    try {
      set_groups(await api.listShareGroups());
      set_error(null);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not load shared items.",
      );
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

  useEffect(() => {
    const available = new Set(
      dash.calendar.symptoms.map((symptom) => symptom.id),
    );
    set_selected_symptoms((current) => {
      const next = new Set([...current].filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [dash.calendar.symptoms]);

  const symptom_groups = groupSymptoms(dash.calendar.symptoms);

  const has_selection =
    selected_exams.size > 0 ||
    selected_medications.size > 0 ||
    selected_symptoms.size > 0;
  const all_exams_selected =
    exams.length > 0 && selected_exams.size === exams.length;
  const all_medications_selected =
    medications.length > 0 && selected_medications.size === medications.length;

  const exam_items: SelectionItem[] = exams.map((exam) => ({
    id: exam.id,
    label: exam.title,
    hint: `${formatDate(exam.date_performed)} · ${plural(
      exam.biomarkers.length,
      "biomarker",
    )}`,
  }));
  const medication_items: SelectionItem[] = medications.map((medication) => ({
    id: medication.id,
    label: medication.name,
    hint: `${medication.dosage} · ${medication.frequency_per_day}x per day`,
  }));

  function toggleSelection(
    setter: (updater: (current: Set<number>) => Set<number>) => void,
    id: number,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllExams() {
    set_selected_exams(
      all_exams_selected ? new Set() : new Set(exams.map((exam) => exam.id)),
    );
  }

  function toggleAllMedications() {
    set_selected_medications(
      all_medications_selected
        ? new Set()
        : new Set(medications.map((medication) => medication.id)),
    );
  }

  function toggleSymptom(occurrence_id: number) {
    toggleSelection(set_selected_symptoms, occurrence_id);
  }

  function toggleSymptomGroup(occurrence_ids: number[], all_selected: boolean) {
    set_selected_symptoms((current) => {
      const next = new Set(current);
      for (const id of occurrence_ids) {
        if (all_selected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function createShare() {
    if (!has_selection) return;
    set_creating(true);
    set_error(null);
    try {
      const result = await api.createShare({
        exam_ids: [...selected_exams],
        medication_ids: [...selected_medications],
        symptom_occurrence_ids: [...selected_symptoms],
        expires_in_days,
      });
      set_created(result);
      await load_groups();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not create a share code.",
      );
    } finally {
      set_creating(false);
    }
  }

  async function shareAgain(group: ShareGroup) {
    set_sharing_group_key(group.group_key);
    set_error(null);
    try {
      const result = await api.createShare({
        exam_ids: group.exam_ids,
        medication_ids: group.medication_ids,
        symptom_occurrence_ids: group.symptom_occurrence_ids,
        expires_in_days,
      });
      set_created(result);
      await load_groups();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not create a share code.",
      );
    } finally {
      set_sharing_group_key(null);
    }
  }

  async function renameGroup(group_key: string, title: string | null) {
    set_renaming_group_key(group_key);
    set_error(null);
    try {
      set_groups(await api.renameShareGroup(group_key, title));
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not rename the group.",
      );
    } finally {
      set_renaming_group_key(null);
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
      await api.revokeShare(code_id);
      await load_groups();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not revoke this code.",
      );
    } finally {
      set_revoking_id(null);
    }
  }

  async function copy(value: string, target: CopyTarget) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      set_copied(target);
      window.setTimeout(() => set_copied(null), 2000);
    } catch {
      set_error(
        "Could not copy to the clipboard. Select the text and copy it manually.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-center gap-3">
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
            Share your records
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Pick the exams, medications and symptoms to share, then send the
            one-time code.
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
        <CreatedCode
          created={created}
          copied={copied}
          on_copy={(value, target) => void copy(value, target)}
          on_dismiss={() => set_created(null)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SelectionCard
          title="Exams"
          unit="exam"
          items={exam_items}
          selected={selected_exams}
          all_selected={all_exams_selected}
          empty_hint="No exams to share yet."
          on_toggle={(id) => toggleSelection(set_selected_exams, id)}
          on_toggle_all={toggleAllExams}
        />
        <SelectionCard
          title="Medications"
          unit="medication"
          items={medication_items}
          selected={selected_medications}
          all_selected={all_medications_selected}
          empty_hint="No medications to share yet."
          on_toggle={(id) => toggleSelection(set_selected_medications, id)}
          on_toggle_all={toggleAllMedications}
        />
        <SymptomSelectionCard
          symptoms={symptom_groups}
          selected={selected_symptoms}
          on_toggle={toggleSymptom}
          on_toggle_group={toggleSymptomGroup}
        />
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
          onClick={() => void createShare()}
          loading={creating}
          disabled={!has_selection}
        >
          Create one-time code
        </Button>
        <p className="pb-1 text-xs text-gray-500 dark:text-gray-400">
          A code can be redeemed once and only allows viewing the selected
          records, including individual symptom occurrences.
        </p>
      </Card>

      <GroupList
        groups={groups}
        loading={loading_groups}
        sharing_group_key={sharing_group_key}
        renaming_group_key={renaming_group_key}
        revoking_id={revoking_id}
        can_revoke={Boolean(user?.capabilities.revoke_shares)}
        can_rename={Boolean(user?.capabilities.create_shares)}
        on_share_again={(group) => void shareAgain(group)}
        on_rename={(group_key, title) => void renameGroup(group_key, title)}
        on_revoke={(code_id) => void revoke(code_id)}
      />
    </main>
  );
}

export const Route = createFileRoute("/share")({
  component: SharePage,
});
