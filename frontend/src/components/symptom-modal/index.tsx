import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api-client";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import type { SymptomModalProps } from "../types";
import { DatesEditor } from "./dates-editor";
import { TitleCombobox } from "./title-combobox";
import type { SymptomDateDraft } from "./types";
import {
  draftFromOccurrence,
  emptyDraft,
  toPayload,
  validateDrafts,
} from "./utils";

export function SymptomModal({
  open,
  occurrence = null,
  titles,
  on_close,
  on_saved,
}: SymptomModalProps) {
  const [title, set_title] = useState("");
  const [drafts, set_drafts] = useState<SymptomDateDraft[]>([emptyDraft()]);
  const [saving, set_saving] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const editing = occurrence !== null;

  useEffect(() => {
    if (!open) return;
    set_title(occurrence?.title ?? "");
    set_drafts([occurrence ? draftFromOccurrence(occurrence) : emptyDraft()]);
    set_error(null);
  }, [open, occurrence]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    set_error(null);
    if (!title.trim()) {
      set_error("Symptom title is required.");
      return;
    }
    const invalid = validateDrafts(drafts);
    if (invalid) {
      set_error(invalid);
      return;
    }

    set_saving(true);
    try {
      if (occurrence) {
        const draft = drafts[0];
        await api.updateSymptomOccurrence(occurrence.id, {
          title: title.trim(),
          observation: draft.observation.trim() || null,
          start_date: draft.start_date,
          end_date: draft.ongoing
            ? null
            : draft.end_date || draft.start_date,
        });
      } else {
        await api.createSymptom({
          title: title.trim(),
          dates: toPayload(drafts),
        });
      }
      on_saved();
      on_close();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Failed to save the symptom.",
      );
    } finally {
      set_saving(false);
    }
  }

  const renaming =
    occurrence !== null &&
    title.trim().toLowerCase() !== occurrence.title.trim().toLowerCase();

  return (
    <Modal
      open={open}
      title={editing ? "Edit symptom" : "Log a symptom"}
      subtitle={
        editing
          ? "Update this occurrence — its dates, observation, or the symptom name."
          : "Reuse a past symptom or type a new one; every date can carry its own observation."
      }
      onClose={on_close}
      footer={
        <>
          <Button type="submit" form="symptom-form" loading={saving}>
            {editing ? "Save changes" : "Save symptom"}
          </Button>
          <Button type="button" variant="secondary" onClick={on_close}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="symptom-form" onSubmit={submit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
        <TitleCombobox value={title} titles={titles} onChange={set_title} />
        {editing && renaming && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            Renaming applies to every occurrence of “{occurrence.title}”.
          </p>
        )}
        <DatesEditor drafts={drafts} onChange={set_drafts} single={editing} />
        {!editing && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Leave the end date empty for a single day, or mark a range as
            ongoing to track a current symptom.
          </p>
        )}
      </form>
    </Modal>
  );
}
