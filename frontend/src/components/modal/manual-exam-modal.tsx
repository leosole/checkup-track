import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  type Exam,
  type ManualBiomarkerInput,
} from "../../api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";

interface ManualExamModalProps {
  exam: Exam | null;
  on_close: () => void;
  on_keep_pdf: () => void;
  on_saved: (exam: Exam) => void;
}

interface BiomarkerDraft {
  biomarker_name: string;
  value: string;
  unit: string;
  reference_range: string;
  is_abnormal: boolean;
}

const empty_biomarker = (): BiomarkerDraft => ({
  biomarker_name: "",
  value: "",
  unit: "",
  reference_range: "",
  is_abnormal: false,
});

export function ManualExamModal({
  exam,
  on_close,
  on_keep_pdf,
  on_saved,
}: ManualExamModalProps) {
  const [editing, set_editing] = useState(false);
  const [title, set_title] = useState("");
  const [date_performed, set_date_performed] = useState("");
  const [biomarkers, set_biomarkers] = useState<BiomarkerDraft[]>([empty_biomarker()]);
  const [saving, set_saving] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => {
    if (!exam) return;
    set_editing(false);
    set_title(exam.title);
    set_date_performed(exam.date_performed);
    set_biomarkers([empty_biomarker()]);
    set_error(null);
  }, [exam]);

  function update_biomarker(
    index: number,
    field: keyof BiomarkerDraft,
    value: string,
  ) {
    set_biomarkers((current) =>
      current.map((biomarker, current_index) =>
        current_index === index ? { ...biomarker, [field]: value } : biomarker,
      ),
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!exam) return;
    set_error(null);

    const entered = biomarkers.filter((biomarker) =>
      Object.values(biomarker).some((value) => value.trim()),
    );
    const parsed: ManualBiomarkerInput[] = [];
    for (const biomarker of entered) {
      const value = Number(biomarker.value);
      if (!biomarker.biomarker_name.trim() || !biomarker.value.trim() || !Number.isFinite(value)) {
        set_error("Complete the name and numeric result for each marker, or remove the empty row.");
        return;
      }
      parsed.push({
        biomarker_name: biomarker.biomarker_name.trim(),
        value,
        unit: biomarker.unit.trim(),
        reference_range: biomarker.reference_range.trim() || null,
        is_abnormal: biomarker.is_abnormal,
      });
    }

    set_saving(true);
    try {
      const saved = await api.save_manual_exam_results(exam.id, {
        title: title.trim(),
        date_performed,
        biomarkers: parsed,
      });
      on_saved(saved);
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Could not save manual exam results.");
    } finally {
      set_saving(false);
    }
  }

  return (
    <Modal
      open={exam !== null}
      title={editing ? "Enter exam results" : "Automatic extraction unavailable"}
      subtitle={
        editing
          ? "Add the exam details and any results you want to track."
          : "Your PDF is saved. Enter results manually or keep this exam PDF-only in your calendar."
      }
      onClose={on_close}
      footer={
        editing ? (
          <>
            <Button type="button" variant="secondary" onClick={() => set_editing(false)}>
              Back
            </Button>
            <Button type="submit" form="manual-exam-form" loading={saving}>
              Save exam
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={on_keep_pdf}>
              Keep PDF only
            </Button>
            <Button type="button" onClick={() => set_editing(true)}>
              Enter results manually
            </Button>
          </>
        )
      }
    >
      {editing ? (
        <form
          id="manual-exam-form"
          onSubmit={submit}
          className="max-h-[65vh] space-y-4 overflow-y-auto pr-1"
        >
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
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
          <Input
            label="Date performed"
            type="date"
            value={date_performed}
            onChange={(event) => set_date_performed(event.target.value)}
            required
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Markers</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => set_biomarkers((current) => [...current, empty_biomarker()])}
              >
                Add marker
              </Button>
            </div>
            {biomarkers.map((biomarker, index) => (
              <fieldset
                key={index}
                className="space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700"
              >
                <legend className="sr-only">Marker {index + 1}</legend>
                <div className="flex items-end gap-3">
                  <Input
                    id={`manual-marker-name-${index}`}
                    label="Marker name"
                    value={biomarker.biomarker_name}
                    onChange={(event) =>
                      update_biomarker(index, "biomarker_name", event.target.value)
                    }
                    maxLength={200}
                    placeholder="e.g., Glucose or a custom field"
                  />
                  {biomarkers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove marker ${index + 1}`}
                      onClick={() =>
                        set_biomarkers((current) =>
                          current.filter((_, current_index) => current_index !== index),
                        )
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input
                    id={`manual-marker-value-${index}`}
                    label="Result"
                    type="number"
                    step="any"
                    value={biomarker.value}
                    onChange={(event) => update_biomarker(index, "value", event.target.value)}
                    placeholder="0"
                  />
                  <Input
                    id={`manual-marker-unit-${index}`}
                    label="Unit (optional)"
                    value={biomarker.unit}
                    onChange={(event) => update_biomarker(index, "unit", event.target.value)}
                    maxLength={100}
                    placeholder="mg/dL"
                  />
                  <Input
                    id={`manual-marker-range-${index}`}
                    label="Range (optional)"
                    value={biomarker.reference_range}
                    onChange={(event) =>
                      update_biomarker(index, "reference_range", event.target.value)
                    }
                    maxLength={200}
                    placeholder="70-99"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={biomarker.is_abnormal}
                    onChange={(event) =>
                      set_biomarkers((current) =>
                        current.map((item, current_index) =>
                          current_index === index
                            ? { ...item, is_abnormal: event.target.checked }
                            : item,
                        ),
                      )
                    }
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600"
                  />
                  Flag abnormal
                </label>
              </fieldset>
            ))}
          </div>
        </form>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No results were extracted. The uploaded PDF and exam date have already been saved.
        </p>
      )}
    </Modal>
  );
}