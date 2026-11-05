import { useEffect, useState, type FormEvent } from "react";
import { api, type Exam } from "../../api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";

export function ExamRenameModal({
  exam,
  on_close,
  on_saved,
}: {
  exam: Exam | null;
  on_close: () => void;
  on_saved: () => Promise<void>;
}) {
  const [title, set_title] = useState("");
  const [saving, set_saving] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => {
    if (!exam) return;
    set_title(exam.title);
    set_error(null);
  }, [exam]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!exam || !title.trim()) return;
    set_saving(true);
    set_error(null);
    try {
      await api.rename_exam(exam.id, title.trim());
      await on_saved();
      on_close();
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Could not rename the exam.");
    } finally {
      set_saving(false);
    }
  }

  return (
    <Modal
      open={exam !== null}
      title="Edit exam"
      subtitle="Update the name shown across your dashboard and calendar."
      onClose={on_close}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={on_close}>
            Cancel
          </Button>
          <Button type="submit" form="exam-rename-form" loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="exam-rename-form" onSubmit={submit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
        <Input
          label="Exam name"
          value={title}
          onChange={(event) => set_title(event.target.value)}
          maxLength={200}
          required
        />
      </form>
    </Modal>
  );
}