import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api-client";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import type { MedicationModalProps } from "../types";
import { NameCombobox } from "./name-combobox";
import { UsesEditor } from "./use-editor";
import type { MedicationUseDraft } from "./types";
import {
  draftFromUse,
  emptyUseDraft,
  toPayload,
  validateDrafts,
} from "./utils";

export function MedicationModal({
  open,
  use = null,
  names,
  on_close,
  on_saved,
}: MedicationModalProps) {
  const [name, set_name] = useState("");
  const [drafts, set_drafts] = useState<MedicationUseDraft[]>([emptyUseDraft()]);
  const [saving, set_saving] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const editing = use !== null;

  useEffect(() => {
    if (!open) return;
    set_name(use?.name ?? "");
    set_drafts([use ? draftFromUse(use) : emptyUseDraft()]);
    set_error(null);
  }, [open, use]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    set_error(null);
    if (!name.trim()) {
      set_error("Medication name is required.");
      return;
    }
    const invalid = validateDrafts(drafts);
    if (invalid) {
      set_error(invalid);
      return;
    }

    set_saving(true);
    try {
      if (use) {
        const draft = drafts[0];
        await api.updateMedicationUse(use.id, {
          medication_name: name.trim(),
          dosage: draft.dosage.trim(),
          frequency_per_day: Number(draft.frequency_per_day),
          start_date: draft.start_date,
          end_date: draft.ongoing
            ? null
            : draft.end_date || draft.start_date,
        });
      } else {
        await api.createMedication({
          medication_name: name.trim(),
          uses: toPayload(drafts),
        });
      }
      on_saved();
      on_close();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Failed to save the medication.",
      );
    } finally {
      set_saving(false);
    }
  }

  const renaming =
    use !== null && name.trim().toLowerCase() !== use.name.trim().toLowerCase();

  return (
    <Modal
      open={open}
      title={editing ? "Edit medication use" : "Add medication"}
      subtitle={
        editing
          ? "Update this use — its dates, dosage, frequency, or the medication name."
          : "Reuse a past medication or type a new one; each use has its own dates, dosage and frequency."
      }
      onClose={on_close}
      footer={
        <>
          <Button type="submit" form="medication-form" loading={saving}>
            {editing ? "Save changes" : "Save medication"}
          </Button>
          <Button type="button" variant="secondary" onClick={on_close}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="medication-form" onSubmit={submit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
        <NameCombobox value={name} names={names} onChange={set_name} />
        {editing && renaming && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            Renaming applies to every use of “{use.name}”.
          </p>
        )}
        <UsesEditor drafts={drafts} onChange={set_drafts} single={editing} />
        {!editing && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Leave the end date empty for a single day, or mark a use as ongoing
            to track a current course.
          </p>
        )}
      </form>
    </Modal>
  );
}
