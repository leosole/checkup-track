import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Modal } from "./ui/modal";
import type { ExamRenameModalProps } from "./types";

export function ExamRenameModal({
  exam,
  on_close,
  on_saved,
}: ExamRenameModalProps) {
  const [title, set_title] = useState("");
  const [date_performed, set_date_performed] = useState("");
  const [saving, set_saving] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [retry_error, set_retry_error] = useState<string | null>(null);

  useEffect(() => {
    if (!exam) return;
    set_title(exam.title);
    set_date_performed(exam.date_performed);
    set_error(null);
  }, [exam]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!exam || !title.trim() || !date_performed) return;
    set_saving(true);
    set_error(null);
    set_retry_error(null);
    try {
      await api.updateExam(exam.id, {
        title: title.trim(),
        date_performed,
      });
      await on_saved();
      on_close();
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Could not update the exam.");
    } finally {
      set_saving(false);
    }
  }

  async function retryExtraction() {
    if (!exam) return;
    set_retry_error(null);
    try {
      await api.retryExamExtraction(exam.id);
      set_error(null);
      await on_saved();
      on_close();
    } catch (err) {
      set_retry_error(
        err instanceof Error ? err.message : "Retry extraction failed.",
      );
    }
  }

  return (
    <Modal
      open={exam !== null}
      title="Edit exam"
      subtitle="Update the name and the date this exam was performed."
      onClose={on_close}
      footer={
        <>
          <Button type="submit" form="exam-rename-form" loading={saving}>
            Save changes
          </Button>
          <Button type="button" variant="secondary" onClick={on_close}>
            Cancel
          </Button>
          {exam?.extraction_error && !saving && (
            <Button
              type="button"
              variant="secondary"
              onClick={retryExtraction}
              disabled={retry_error !== null}
            >
              Retry extraction
            </Button>
          )}
        </>
      }
    >
      <form id="exam-rename-form" onSubmit={submit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
        {retry_error && (
          <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {retry_error}
          </p>
        )}
        <Input
          label="Exam name"
          value={title}
          onChange={(event) => set_title(event.target.value)}
          maxLength={200}
          required
        />
        <Input
          label="Date performed"
          type="date"
          value={date_performed}
          onChange={(event) => set_date_performed(event.target.value)}
          required
        />
      </form>
    </Modal>
  );
}
