import { useEffect, useRef, useState } from "react";
import { api } from "../api-client";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
import { Input } from "./ui/input";
import type { UploadExamModalProps } from "./types";

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
      if (file_input_ref.current) file_input_ref.current.value = "";
    }
  }, [open]);

  function pickFile() {
    file_input_ref.current?.click();
  }

  function onFileSelected(selected: File | null) {
    set_file(selected);
    set_error(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      set_error("Choose an exam file to upload first.");
      return;
    }
    if (!image_only && !file.name.toLowerCase().endsWith(".pdf")) {
      set_error("Choose a PDF or turn on Image exam to save an image file.");
      return;
    }
    set_uploading(true);
    set_error(null);
    set_upload_progress(0);
    try {
      const exam = await api.upload_exam(
        file,
        title || undefined,
        set_upload_progress,
        date_performed || undefined,
        image_only,
      );
      set_upload_progress(100);
      set_file(null);
      set_title("");
      set_date_performed("");
      set_image_only(false);
      if (file_input_ref.current) file_input_ref.current.value = "";
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
      title="Upload exam"
      subtitle="Add a report PDF for extraction or save an image exam without parsing."
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
            {uploading ? "Uploading…" : image_only ? "Save exam" : "Upload exam"}
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
            Exam file
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
              onClick={pickFile}
              disabled={uploading}
            >
              Choose file
            </Button>
          </div>
          <input
            ref={file_input_ref}
            type="file"
            accept={image_only ? "application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp" : "application/pdf,.pdf"}
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              onFileSelected(selected);
            }}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {image_only
              ? "PDF, JPEG, PNG, and WebP files are saved without extraction."
              : "PDF reports are parsed into biomarkers after upload."}
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
          <Input
            label="Exam name (optional)"
            value={title}
            onChange={(event) => set_title(event.target.value)}
            placeholder={
              image_only ? "Uses the file name" : "Uses the report title or file name"
            }
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Input
            label="Date performed (optional)"
            type="date"
            value={date_performed}
            onChange={(event) => set_date_performed(event.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {image_only
              ? "Leave blank to use today's date."
              : "Leave blank to use the date in the report, or today if unavailable."}
          </p>
        </div>

        <div className="space-y-2">
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
          {image_only && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              Naming and dating image exams is recommended so they are easy to find, but both fields are optional.
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
