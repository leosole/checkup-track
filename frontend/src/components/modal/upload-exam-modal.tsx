import { useEffect, useRef, useState } from "react";
import { api, type Exam } from "../../api-client";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { Input } from "../ui/input";

interface UploadExamModalProps {
  open: boolean;
  on_close: () => void;
  on_saved: (exam: Exam) => void;
}

export function UploadExamModal({
  open,
  on_close,
  on_saved,
}: UploadExamModalProps) {
  const [file, set_file] = useState<File | null>(null);
  const [title, set_title] = useState("");
  const [date_performed, set_date_performed] = useState("");
  const [image_only, set_image_only] = useState(false);
  const [upload_progress, set_upload_progress] = useState(0);
  const [uploading, set_uploading] = useState(false);

  const [error, set_error] = useState<string | null>(null);
  const file_input_ref = useRef<HTMLInputElement | null>(null);

  // Reset fields when the modal opens or the user explicitly clears the
  // selection, so a stale file is never uploaded twice.
  useEffect(() => {
    if (open) {
      set_file(null);
      set_title("");
      set_date_performed("");
      set_image_only(false);
      set_error(null);
    }
  }, [open]);

  function pick_file() {
    file_input_ref.current?.click();
  }

  function on_file_selected(selected: File | null) {
    set_file(selected);
    set_error(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      set_error("Choose a PDF file to upload first.");
      return;
    }
    if (!date_performed) {
      set_error("Pick the exam date.");
      return;
    }
    set_uploading(true);
    set_error(null);
    try {
      const exam = await api.upload_exam(file, title || undefined, (percent) => {
        set_upload_progress(percent);
      });
      set_upload_progress(100);
      set_file(null);
      set_title("");
      set_date_performed("");
      set_image_only(false);
      await on_saved(exam);
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      set_uploading(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Upload lab report"
      subtitle="Name the exam, pick a date, and choose how this file should be stored."
      onClose={on_close}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={on_close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="upload-exam-form"
            loading={uploading}
            disabled={!file}
          >
            {uploading ? "Uploading…" : "Save exam"}
          </Button>
        </>
      }
    >
      <form
        id="upload-exam-form"
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Exam file (PDF only)
          </label>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5 ring-1 ring-inset ring-gray-300 dark:bg-gray-900 dark:ring-gray-700">
              {file ? (
                <span className="truncate text-sm text-gray-700 dark:text-gray-200">
                  {file.name}
                </span>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  No file chosen
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={pick_file}
              disabled={uploading}
            >
              Browse
            </Button>
          </div>
          <input
            ref={file_input_ref}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              on_file_selected(selected);
            }}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            This guide stores the report PDF only. It is never parsed.
          </p>
        </div>
        {uploading && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-1.5 rounded-full bg-brand-600 transition-all duration-300"
                style={{ width: `${upload_progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Uploading {upload_progress}%</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Exam name <span className="text-gray-400">(optional)</span>
          </label>
          <Input
            value={title}
            onChange={(event) => set_title(event.target.value)}
            placeholder="Auto generated from the file name if left blank"
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date performed
          </label>
          <Input
            type="date"
            value={date_performed}
            onChange={(event) => set_date_performed(event.target.value)}
            required
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:ring-gray-700 dark:hover:bg-gray-900">
            <input
              type="checkbox"
              checked={image_only}
              onChange={(event) => set_image_only(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-900"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Image exam
            </span>
          </label>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Mark image exams so they are saved but never sent to an LLM.
          </p>
        </div>

        {image_only && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Name the exam and pick the date so this report is searchable and
            visible in your calendar. Both stay optional — you can leave them
            blank and they will default to the file name and today&apos;s date.
          </p>
        )}
      </form>
    </Modal>
  );
}
