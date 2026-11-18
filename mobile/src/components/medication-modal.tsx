import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { api } from "../api-client";
import {
  draftFromUse,
  emptyUseDraft,
  toUsePayload,
  validateUseDrafts,
} from "../forms";
import {
  radius,
  useAppStyles,
  useTheme,
  type Palette,
} from "../theme";
import type { MedicationUse } from "../types";
import type { MedicationUseDraft } from "../types/forms";
import { Button } from "./ui/button";
import { TextField } from "./ui/input";
import { Sheet } from "./ui/sheet";

function UseEditor({
  draft,
  index,
  single,
  onChange,
  onRemove,
}: {
  draft: MedicationUseDraft;
  index: number;
  single: boolean;
  onChange: (index: number, patch: Partial<MedicationUseDraft>) => void;
  onRemove: (index: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);
  return (
    <View style={styles.useCard}>
      <View style={styles.useRow}>
        <TextField
          label="Dosage"
          value={draft.dosage}
          onChangeText={(value) => onChange(index, { dosage: value })}
          placeholder="e.g., 500 mg"
          style={styles.flex}
        />
        <TextField
          label="Times per day"
          value={draft.frequency_per_day}
          onChangeText={(value) =>
            onChange(index, { frequency_per_day: value })
          }
          keyboardType="number-pad"
          style={styles.frequency}
        />
      </View>
      <View style={styles.useRow}>
        <TextField
          label="Start date"
          value={draft.start_date}
          onChangeText={(value) => onChange(index, { start_date: value })}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          style={styles.flex}
        />
        <TextField
          label="End date (optional)"
          value={draft.ongoing ? "" : draft.end_date}
          onChangeText={(value) => onChange(index, { end_date: value })}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          editable={!draft.ongoing}
          style={styles.flex}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Ongoing — no end date</Text>
        <Switch
          value={draft.ongoing}
          onValueChange={(value) =>
            onChange(index, {
              ongoing: value,
              end_date: value ? "" : draft.end_date,
            })
          }
          trackColor={{ true: colors.brand400, false: colors.borderStrong }}
          thumbColor={colors.white}
        />
      </View>
      {!single && (
        <Pressable onPress={() => onRemove(index)} style={styles.removeRow}>
          <Text style={styles.remove}>Remove this use</Text>
        </Pressable>
      )}
    </View>
  );
}

export function MedicationModal({
  visible,
  use = null,
  names,
  onClose,
  onSaved,
}: {
  visible: boolean;
  use?: MedicationUse | null;
  names: string[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const styles = useAppStyles(make_styles);
  const [name, set_name] = useState("");
  const [drafts, set_drafts] = useState<MedicationUseDraft[]>([emptyUseDraft()]);
  const [saving, set_saving] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const editing = use !== null;

  useEffect(() => {
    if (!visible) return;
    set_name(use?.name ?? "");
    set_drafts([use ? draftFromUse(use) : emptyUseDraft()]);
    set_error(null);
    set_saving(false);
  }, [visible, use]);

  function update_draft(index: number, patch: Partial<MedicationUseDraft>) {
    set_drafts((current) =>
      current.map((draft, position) =>
        position === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  async function submit() {
    set_error(null);
    if (!name.trim()) {
      set_error("Medication name is required.");
      return;
    }
    const invalid = validateUseDrafts(drafts);
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
          uses: toUsePayload(drafts),
        });
      }
      await onSaved();
      onClose();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Failed to save the medication.",
      );
    } finally {
      set_saving(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title={editing ? "Edit medication use" : "Add medication"}
      subtitle={
        editing
          ? "Update this use — its dates, dosage, frequency, or the medication name."
          : "Reuse a past medication or type a new one; each use has its own dates."
      }
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <Button
            label={editing ? "Save changes" : "Save medication"}
            loading={saving}
            onPress={() => void submit()}
          />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextField
        label="Medication name"
        value={name}
        onChangeText={set_name}
        placeholder="e.g., Metformin"
        autoCapitalize="words"
        maxLength={120}
      />

      {!editing && names.length > 0 && (
        <View style={styles.suggestions}>
          <Text style={styles.hint}>Previously used</Text>
          <View style={styles.suggestionRow}>
            {names.slice(0, 8).map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => set_name(suggestion)}
                style={styles.suggestion}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {drafts.map((draft, index) => (
        <UseEditor
          key={index}
          draft={draft}
          index={index}
          single={editing}
          onChange={update_draft}
          onRemove={(position) =>
            set_drafts((current) =>
              current.filter((_, item) => item !== position),
            )
          }
        />
      ))}

      {!editing && (
        <Button
          label="Add another use"
          size="sm"
          variant="secondary"
          onPress={() => set_drafts((current) => [...current, emptyUseDraft()])}
        />
      )}
    </Sheet>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 8,
  },
  useCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  useRow: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  frequency: { width: 96 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: { fontSize: 12, color: colors.textMuted },
  removeRow: { alignItems: "flex-end" },
  remove: { fontSize: 12, fontWeight: "600", color: colors.danger },
  hint: { fontSize: 12, color: colors.textSubtle },
  suggestions: { gap: 6 },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestion: {
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  suggestionText: { fontSize: 11, color: colors.textMuted },
});
