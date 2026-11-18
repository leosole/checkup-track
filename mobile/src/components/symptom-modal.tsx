import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { api } from "../api-client";
import {
  draftFromOccurrence,
  emptySymptomDraft,
  toSymptomPayload,
  validateSymptomDrafts,
} from "../forms";
import {
  radius,
  useAppStyles,
  useTheme,
  type Palette,
} from "../theme";
import type { SymptomOccurrence } from "../types";
import type { SymptomDateDraft } from "../types/forms";
import { Button } from "./ui/button";
import { TextField } from "./ui/input";
import { Sheet } from "./ui/sheet";

function DateEditor({
  draft,
  index,
  single,
  onChange,
  onRemove,
}: {
  draft: SymptomDateDraft;
  index: number;
  single: boolean;
  onChange: (index: number, patch: Partial<SymptomDateDraft>) => void;
  onRemove: (index: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);
  return (
    <View style={styles.dateCard}>
      <View style={styles.row}>
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
      <TextField
        label="Observation (optional)"
        value={draft.observation}
        onChangeText={(value) => onChange(index, { observation: value })}
        placeholder="What did you notice?"
        multiline
        maxLength={2000}
      />
      {!single && (
        <Pressable onPress={() => onRemove(index)} style={styles.removeRow}>
          <Text style={styles.remove}>Remove this date</Text>
        </Pressable>
      )}
    </View>
  );
}

export function SymptomModal({
  visible,
  occurrence = null,
  titles,
  onClose,
  onSaved,
}: {
  visible: boolean;
  occurrence?: SymptomOccurrence | null;
  titles: string[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const styles = useAppStyles(make_styles);
  const [title, set_title] = useState("");
  const [drafts, set_drafts] = useState<SymptomDateDraft[]>([
    emptySymptomDraft(),
  ]);
  const [saving, set_saving] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const editing = occurrence !== null;

  useEffect(() => {
    if (!visible) return;
    set_title(occurrence?.title ?? "");
    set_drafts([occurrence ? draftFromOccurrence(occurrence) : emptySymptomDraft()]);
    set_error(null);
    set_saving(false);
  }, [visible, occurrence]);

  function update_draft(index: number, patch: Partial<SymptomDateDraft>) {
    set_drafts((current) =>
      current.map((draft, position) =>
        position === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  async function submit() {
    set_error(null);
    if (!title.trim()) {
      set_error("Symptom title is required.");
      return;
    }
    const invalid = validateSymptomDrafts(drafts);
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
          dates: toSymptomPayload(drafts),
        });
      }
      await onSaved();
      onClose();
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
    <Sheet
      visible={visible}
      title={editing ? "Edit symptom" : "Log a symptom"}
      subtitle={
        editing
          ? "Update this occurrence — its dates, observation, or the symptom name."
          : "Reuse a past symptom or type a new one; every date can carry its own observation."
      }
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <Button
            label={editing ? "Save changes" : "Save symptom"}
            loading={saving}
            onPress={() => void submit()}
          />
          <Button label="Cancel" variant="secondary" onPress={onClose} />
        </>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextField
        label="Symptom title"
        value={title}
        onChangeText={set_title}
        placeholder="e.g., Headache"
        autoCapitalize="sentences"
        maxLength={120}
      />

      {!editing && titles.length > 0 && (
        <View style={styles.suggestions}>
          <Text style={styles.hint}>Previously logged</Text>
          <View style={styles.suggestionRow}>
            {titles.slice(0, 8).map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => set_title(suggestion)}
                style={styles.suggestion}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {editing && renaming && (
        <Text style={styles.warning}>
          Renaming applies to every occurrence of “{occurrence.title}”.
        </Text>
      )}

      {drafts.map((draft, index) => (
        <DateEditor
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
          label="Add another date"
          size="sm"
          variant="secondary"
          onPress={() =>
            set_drafts((current) => [...current, emptySymptomDraft()])
          }
        />
      )}
      {!editing && (
        <Text style={styles.hint}>
          Leave the end date empty for a single day, or mark a range as ongoing
          to track a current symptom.
        </Text>
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
  warning: {
    fontSize: 12,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: 8,
  },
  dateCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
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
