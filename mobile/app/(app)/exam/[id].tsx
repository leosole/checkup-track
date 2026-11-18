import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../../src/api-client";
import { useAuth } from "../../../src/auth-context";
import { examStatusLabel } from "../../../src/components/exam-card";
import { Badge, Card, EmptyState, Spinner } from "../../../src/components/ui/card";
import { Button } from "../../../src/components/ui/button";
import { CheckRow, TextField } from "../../../src/components/ui/input";
import { Screen, ScreenHeader, SectionHeader } from "../../../src/components/ui/screen";
import { useData } from "../../../src/data-context";
import { formatDate, isValidIso } from "../../../src/date-utils";
import { openStoredExam } from "../../../src/files";
import { radius, useAppStyles, type Palette } from "../../../src/theme";
import type { ManualBiomarkerRow } from "../../../src/types/forms";

const EMPTY_ROW: ManualBiomarkerRow = {
  biomarker_name: "",
  value: "",
  unit: "",
  reference_range: "",
  is_abnormal: false,
};

export default function ExamDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const exam_id = Number(params.id);
  const router = useRouter();
  const { user } = useAuth();
  const data = useData();
  const styles = useAppStyles(make_styles);
  const exam = data.exams.find((item) => item.id === exam_id) ?? null;

  const [title, set_title] = useState("");
  const [date, set_date] = useState("");
  const [saving_meta, set_saving_meta] = useState(false);
  const [retrying, set_retrying] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const [manual_open, set_manual_open] = useState(false);
  const [manual_title, set_manual_title] = useState("");
  const [manual_date, set_manual_date] = useState("");
  const [rows, set_rows] = useState<ManualBiomarkerRow[]>([]);
  const [saving_manual, set_saving_manual] = useState(false);

  useEffect(() => {
    if (!exam) return;
    set_title(exam.title);
    set_date(exam.date_performed);
    set_manual_title(exam.title);
    set_manual_date(exam.date_performed);
  }, [exam?.id, exam?.title, exam?.date_performed]);

  if (!exam) {
    return (
      <Screen>
        <ScreenHeader
          title="Exam"
          right={
            <Button
              label="Back"
              size="sm"
              variant="ghost"
              onPress={() => router.back()}
            />
          }
        />
        {data.loading ? (
          <Spinner label="Loading exam" />
        ) : (
          <EmptyState
            title="Exam not found"
            hint="It may have been deleted. Go back and refresh."
          />
        )}
      </Screen>
    );
  }

  const status_label = examStatusLabel(exam);
  const abnormal = exam.biomarkers.filter((item) => item.is_abnormal).length;

  async function save_meta() {
    set_error(null);
    if (!title.trim()) {
      set_error("Exam name is required.");
      return;
    }
    if (!isValidIso(date)) {
      set_error("Performed date must use YYYY-MM-DD.");
      return;
    }
    set_saving_meta(true);
    try {
      await api.updateExam(exam_id, {
        title: title.trim(),
        date_performed: date,
      });
      await data.refresh();
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Could not save the exam.");
    } finally {
      set_saving_meta(false);
    }
  }

  function open_pdf() {
    if (!exam) return;
    void openStoredExam(exam_id, exam.title, exam.pdf_path).catch((err: unknown) =>
      Alert.alert(
        "Could not open the file",
        err instanceof Error ? err.message : "Try again.",
      ),
    );
  }

  async function retry_extraction() {
    set_retrying(true);
    set_error(null);
    try {
      await api.retryExamExtraction(exam_id);
      await data.refresh();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not retry extraction.",
      );
    } finally {
      set_retrying(false);
    }
  }

  function delete_exam() {
    if (!exam || !user?.capabilities.delete_records) return;
    Alert.alert(
      "Delete exam?",
      `Delete "${exam.title}" and its uploaded file? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await api.deleteExam(exam_id);
                await data.refresh();
                router.back();
              } catch (err) {
                set_error(
                  err instanceof Error
                    ? err.message
                    : "Could not delete the exam.",
                );
              }
            })();
          },
        },
      ],
    );
  }

  function start_manual() {
    if (!exam) return;
    set_manual_title(exam.title);
    set_manual_date(exam.date_performed);
    set_rows(
      exam.biomarkers.length === 0
        ? [{ ...EMPTY_ROW }]
        : exam.biomarkers.map((biomarker) => ({
            biomarker_name: biomarker.biomarker_name,
            value: String(biomarker.value),
            unit: biomarker.unit,
            reference_range: biomarker.reference_range ?? "",
            is_abnormal: biomarker.is_abnormal,
          })),
    );
    set_error(null);
    set_manual_open(true);
  }

  function update_row(index: number, patch: Partial<ManualBiomarkerRow>) {
    set_rows((current) =>
      current.map((row, position) =>
        position === index ? { ...row, ...patch } : row,
      ),
    );
  }

  async function save_manual() {
    set_error(null);
    if (!manual_title.trim()) {
      set_error("Exam name is required.");
      return;
    }
    if (!isValidIso(manual_date)) {
      set_error("Performed date must use YYYY-MM-DD.");
      return;
    }
    const biomarkers = [];
    for (const row of rows) {
      if (!row.biomarker_name.trim()) {
        set_error("Every result needs a biomarker name.");
        return;
      }
      const value = Number(row.value);
      if (!Number.isFinite(value)) {
        set_error("Every result needs a numeric value.");
        return;
      }
      biomarkers.push({
        biomarker_name: row.biomarker_name.trim(),
        value,
        unit: row.unit.trim(),
        reference_range: row.reference_range.trim() || null,
        is_abnormal: row.is_abnormal,
      });
    }
    set_saving_manual(true);
    try {
      await api.saveManualExamResults(exam_id, {
        title: manual_title.trim(),
        date_performed: manual_date,
        biomarkers,
      });
      set_manual_open(false);
      await data.refresh();
      Alert.alert("Results saved.");
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not save the results.",
      );
    } finally {
      set_saving_manual(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title={exam.title}
        subtitle={`Performed ${formatDate(exam.date_performed)}`}
        right={
          <Button
            label="Back"
            size="sm"
            variant="ghost"
            onPress={() => router.back()}
          />
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card style={styles.card}>
        <Text style={styles.label}>Exam details</Text>
        <TextField
          label="Name"
          value={title}
          onChangeText={set_title}
          maxLength={200}
        />
        <TextField
          label="Performed"
          value={date}
          onChangeText={set_date}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <View style={styles.actions}>
          <Button
            label="Save details"
            size="sm"
            loading={saving_meta}
            disabled={!user?.capabilities.edit_exam_metadata}
            onPress={() => void save_meta()}
          />
          <Button
            label="Open file"
            size="sm"
            variant="secondary"
            onPress={open_pdf}
          />
          {exam.processing?.retry_allowed && (
            <Button
              label="Retry extraction"
              size="sm"
              variant="secondary"
              loading={retrying}
              disabled={!user?.capabilities.retry_extraction}
              onPress={() => void retry_extraction()}
            />
          )}
          <Button
            label="Delete"
            size="sm"
            variant="danger"
            disabled={!user?.capabilities.delete_records}
            onPress={delete_exam}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionHeader
          title="Results"
          right={
            <Badge
              label={
                exam.biomarkers.length === 0
                  ? "No results"
                  : abnormal > 0
                    ? `${abnormal} out of range`
                    : "All in range"
              }
              tone={
                exam.biomarkers.length === 0
                  ? "gray"
                  : abnormal > 0
                    ? "danger"
                    : "success"
              }
            />
          }
        />
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            Laboratory: {exam.laboratory || "Not reported"}
          </Text>
          <Text style={styles.meta}>
            {exam.biomarkers.length} biomarker
            {exam.biomarkers.length === 1 ? "" : "s"}
          </Text>
          {status_label ? <Badge label={status_label} tone="info" /> : null}
        </View>

        {exam.biomarkers.length === 0 ? (
          <EmptyState
            title="No stored results"
            hint="Add results manually below, or retry extraction."
          />
        ) : (
          <>
            <Text style={styles.hint}>
              Tap a result to add it to the trend plot.
            </Text>
            {exam.biomarkers.map((biomarker) => {
              const plotted = data.plot_markers.some(
                (name) =>
                  name.trim().toLowerCase() ===
                  biomarker.biomarker_name.trim().toLowerCase(),
              );
              return (
                <Pressable
                  key={biomarker.id}
                  onPress={() => data.toggle_marker(biomarker.biomarker_name)}
                  style={styles.resultRow}
                >
                  <View style={styles.resultNameWrap}>
                    <Text
                      style={[
                        styles.resultName,
                        biomarker.is_abnormal && styles.abnormalText,
                      ]}
                    >
                      {plotted ? "✓ " : ""}
                      {biomarker.biomarker_name}
                    </Text>
                    <Text style={styles.hint}>
                      {biomarker.reference_range
                        ? `Normal range: ${biomarker.reference_range}`
                        : "No reference range"}
                    </Text>
                  </View>
                  <Text style={styles.resultValue}>
                    {biomarker.value} {biomarker.unit}
                  </Text>
                  <Badge
                    label={biomarker.is_abnormal ? "Out of range" : "In range"}
                    tone={biomarker.is_abnormal ? "danger" : "success"}
                  />
                </Pressable>
              );
            })}
          </>
        )}

        {exam.extraction_error ? (
          <Text style={styles.warning}>{exam.extraction_error}</Text>
        ) : null}

        <Button
          label={manual_open ? "Close manual editor" : "Edit results manually"}
          size="sm"
          variant="secondary"
          disabled={!user?.capabilities.edit_results}
          onPress={() =>
            manual_open ? set_manual_open(false) : start_manual()
          }
        />
      </Card>

      {manual_open && (
        <Card style={styles.card}>
          <SectionHeader title="Manual results" />
          <TextField
            label="Exam name"
            value={manual_title}
            onChangeText={set_manual_title}
          />
          <TextField
            label="Performed"
            value={manual_date}
            onChangeText={set_manual_date}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          {rows.map((row, index) => (
            <View key={index} style={styles.rowCard}>
              <TextField
                label="Biomarker"
                value={row.biomarker_name}
                onChangeText={(value) =>
                  update_row(index, { biomarker_name: value })
                }
                placeholder="e.g., Glucose"
              />
              <View style={styles.rowPair}>
                <TextField
                  label="Value"
                  value={row.value}
                  onChangeText={(value) => update_row(index, { value })}
                  keyboardType="decimal-pad"
                  style={styles.flex}
                />
                <TextField
                  label="Unit"
                  value={row.unit}
                  onChangeText={(value) => update_row(index, { unit: value })}
                  placeholder="mg/dL"
                  style={styles.flex}
                />
              </View>
              <TextField
                label="Reference range (optional)"
                value={row.reference_range}
                onChangeText={(value) =>
                  update_row(index, { reference_range: value })
                }
                placeholder="70–99"
              />
              <CheckRow
                label="Out of range"
                checked={row.is_abnormal}
                onChange={(checked) =>
                  update_row(index, { is_abnormal: checked })
                }
              />
              {rows.length > 1 && (
                <Button
                  label="Remove result"
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    set_rows((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                />
              )}
            </View>
          ))}
          <View style={styles.actions}>
            <Button
              label="Add result"
              size="sm"
              variant="secondary"
              onPress={() => set_rows((current) => [...current, { ...EMPTY_ROW }])}
            />
            <Button
              label="Save results"
              size="sm"
              loading={saving_manual}
              onPress={() => void save_manual()}
            />
            <Button
              label="Cancel"
              size="sm"
              variant="ghost"
              onPress={() => set_manual_open(false)}
            />
          </View>
        </Card>
      )}
    </Screen>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  card: { gap: 10 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 9,
  },
  warning: {
    fontSize: 12,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: 8,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  meta: { fontSize: 12, color: colors.textMuted },
  hint: { fontSize: 11, color: colors.textSubtle },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  resultNameWrap: { flex: 1, gap: 1 },
  resultName: { fontSize: 13, fontWeight: "600", color: colors.text },
  abnormalText: { color: colors.danger },
  resultValue: { fontSize: 12, fontWeight: "600", color: colors.text },
  rowCard: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 10,
  },
  rowPair: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
