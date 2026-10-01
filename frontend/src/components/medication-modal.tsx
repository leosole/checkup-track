import { useState, type FormEvent } from "react";
import { api, type Medication } from "../api-client";
import { Input } from "./ui/input";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";

interface MedicationModalProps {
  open: boolean;
  onClose: () => void;
  on_created: (med: Medication) => void;
}

const today_iso = () => new Date().toISOString().slice(0, 10);

export function MedicationModal({ open, onClose, on_created }: MedicationModalProps) {
  const [name, set_name] = useState("");
  const [dosage, set_dosage] = useState("");
  const [frequency, set_frequency] = useState("1");
  const [start_date, set_start_date] = useState(today_iso());
  const [end_date, set_end_date] = useState("");
  const [saving, set_saving] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  function reset() {
    set_name("");
    set_dosage("");
    set_frequency("1");
    set_start_date(today_iso());
    set_end_date("");
    set_error(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    set_error(null);
    if (!name.trim() || !dosage.trim()) {
      set_error("Medication name and dosage are required.");
      return;
    }
    const freq = Number(frequency);
    if (!Number.isInteger(freq) || freq < 1) {
      set_error("Frequency must be a whole number of at least 1.");
      return;
    }
    set_saving(true);
    try {
      const med = await api.create_medication({
        medication_name: name.trim(),
        dosage: dosage.trim(),
        frequency_per_day: freq,
        start_date,
        end_date: end_date || null,
      });
      on_created(med);
      reset();
      onClose();
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Failed to save medication.");
    } finally {
      set_saving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Add medication"
      subtitle="Track a regimen — it will appear as a spanning block on the calendar."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="medication-form" loading={saving}>
            Save medication
          </Button>
        </>
      }
    >
      <form id="medication-form" onSubmit={submit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <Input
          label="Medication name"
          placeholder="e.g., Metformin"
          value={name}
          onChange={(e) => set_name(e.target.value)}
          required
        />
        <Input
          label="Dosage"
          placeholder="e.g., 500 mg"
          value={dosage}
          onChange={(e) => set_dosage(e.target.value)}
          required
        />
        <Input
          label="Frequency per day"
          type="number"
          min={1}
          max={32}
          step={1}
          value={frequency}
          onChange={(e) => set_frequency(e.target.value)}
          required
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Start date"
            type="date"
            value={start_date}
            onChange={(e) => set_start_date(e.target.value)}
            required
          />
          <Input
            label="End date (optional)"
            type="date"
            value={end_date}
            min={start_date}
            onChange={(e) => set_end_date(e.target.value)}
          />
        </div>
        <p className="text-xs text-gray-500">
          Leave the end date empty for a permanent regimen.
        </p>
      </form>
    </Modal>
  );
}
