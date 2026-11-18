import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../src/api-client";
import { useAuth } from "../../../src/auth-context";
import { AnalyticsChart } from "../../../src/components/analytics-chart";
import { CalendarGrid } from "../../../src/components/calendar-grid";
import type { CalendarItemRef } from "../../../src/components/calendar-grid/types";
import { ExamCard } from "../../../src/components/exam-card";
import { Logo } from "../../../src/components/logo";
import { ItemDetailModal, type DetailItem } from "../../../src/components/item-detail-modal";
import { MedicationModal } from "../../../src/components/medication-modal";
import { StatCard } from "../../../src/components/stat-card";
import { SymptomModal } from "../../../src/components/symptom-modal";
import { UploadExamModal } from "../../../src/components/upload-exam-modal";
import { Badge, Card, EmptyState, Spinner } from "../../../src/components/ui/card";
import { Button } from "../../../src/components/ui/button";
import { Screen, ScreenHeader, SectionHeader } from "../../../src/components/ui/screen";
import { useData } from "../../../src/data-context";
import { formatDate } from "../../../src/date-utils";
import {
  isOngoing,
  medicationNames,
  symptomTitles,
  todayIso,
} from "../../../src/forms";
import { openStoredExam } from "../../../src/files";
import { radius, useAppStyles, type Palette } from "../../../src/theme";
import type { Exam, MedicationUse, SymptomOccurrence } from "../../../src/types";

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useData();
  const styles = useAppStyles(make_styles);
  const [upload_open, set_upload_open] = useState(false);
  const [med_open, set_med_open] = useState(false);
  const [editing_med, set_editing_med] = useState<MedicationUse | null>(null);
  const [symptom_open, set_symptom_open] = useState(false);
  const [editing_symptom, set_editing_symptom] =
    useState<SymptomOccurrence | null>(null);
  const [detail, set_detail] = useState<DetailItem | null>(null);
  const [retrying, set_retrying] = useState<number | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const can_create = Boolean(user?.capabilities.create_records);
  const abnormal_count = data.exams.reduce(
    (sum, exam) => sum + exam.biomarkers.filter((b) => b.is_abnormal).length,
    0,
  );
  const active_meds = data.medications.filter(
    (medication) => !medication.end_date || medication.end_date >= todayIso(),
  ).length;
  const recent_symptoms = [...data.calendar.symptoms]
    .sort((left, right) => right.start_date.localeCompare(left.start_date))
    .slice(0, 4);

  function open_pdf(exam: Exam) {
    void openStoredExam(exam.id, exam.title, exam.pdf_path).catch((err: unknown) =>
      Alert.alert(
        "Could not open the file",
        err instanceof Error ? err.message : "Try again.",
      ),
    );
  }

  function delete_exam(exam: Exam) {
    if (!user?.capabilities.delete_records) return;
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
                await api.deleteExam(exam.id);
                await data.refresh();
              } catch (err) {
                set_error(
                  err instanceof Error ? err.message : "Could not delete the exam.",
                );
              }
            })();
          },
        },
      ],
    );
  }

  async function retry_exam(id: number) {
    set_retrying(id);
    try {
      await api.retryExamExtraction(id);
      await data.refresh();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not retry extraction.",
      );
    } finally {
      set_retrying(null);
    }
  }

  function select_calendar_item(item: CalendarItemRef) {
    if (item.kind === "exam") {
      router.push(`/exam/${item.id}`);
      return;
    }
    if (item.kind === "medication") {
      const medication = data.medications.find((entry) => entry.id === item.id);
      if (medication) set_detail({ kind: "medication", medication });
      return;
    }
    const symptom = data.calendar.symptoms.find((entry) => entry.id === item.id);
    if (symptom) set_detail({ kind: "symptom", symptom });
  }

  function edit_detail() {
    if (!detail) return;
    if (detail.kind === "medication") {
      set_editing_med(detail.medication);
      set_med_open(true);
    } else {
      set_editing_symptom(detail.symptom);
      set_symptom_open(true);
    }
    set_detail(null);
  }

  function delete_detail() {
    if (!detail) return;
    const name =
      detail.kind === "medication" ? detail.medication.name : detail.symptom.title;
    Alert.alert("Delete record?", `Delete "${name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              if (detail.kind === "medication") {
                await api.deleteMedicationUse(detail.medication.id);
              } else {
                await api.deleteSymptomOccurrence(detail.symptom.id);
              }
              set_detail(null);
              await data.refresh();
            } catch (err) {
              set_error(
                err instanceof Error ? err.message : "Could not delete the record.",
              );
            }
          })();
        },
      },
    ]);
  }

  if (data.loading && data.exams.length === 0) {
    return (
      <Screen>
        <ScreenHeader
          title={`Hello, ${user?.name.split(" ")[0] ?? "there"}`}
          subtitle="Your health at a glance"
        />
        <Spinner label="Loading your records" />
      </Screen>
    );
  }

  return (
    <Screen refreshing={data.loading} onRefresh={() => void data.refresh()}>
      <ScreenHeader
        title={`Hello, ${user?.name.split(" ")[0] ?? "there"}`}
        subtitle="Your health at a glance"
        right={<Logo size={36} />}
      />

      <View style={styles.actions}>
        <Button
          label="Upload exam"
          disabled={!can_create}
          onPress={() => set_upload_open(true)}
        />
        <Button
          label="Add medication"
          variant="secondary"
          disabled={!can_create}
          onPress={() => {
            set_editing_med(null);
            set_med_open(true);
          }}
        />
        <Button
          label="Log symptom"
          variant="secondary"
          disabled={!can_create}
          onPress={() => {
            set_editing_symptom(null);
            set_symptom_open(true);
          }}
        />
        <Button
          label="Share data"
          variant="secondary"
          onPress={() => router.push("/share")}
        />
      </View>

      {data.load_error ? <Text style={styles.error}>{data.load_error}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.stats}>
        <StatCard
          label="Exams on file"
          value={data.exams.length}
          hint="Uploaded records"
          tone="brand"
        />
        <StatCard
          label="Biomarkers tracked"
          value={data.exams.reduce(
            (sum, exam) => sum + exam.biomarkers.length,
            0,
          )}
          hint="Across all panels"
        />
        <StatCard
          label="Out-of-range results"
          value={abnormal_count}
          hint="Flagged for review"
          tone={abnormal_count > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Active medications"
          value={active_meds}
          hint={`${data.medications.length} use${
            data.medications.length === 1 ? "" : "s"
          } on file`}
        />
      </View>

      <CalendarGrid data={data.calendar} onSelect={select_calendar_item} />

      <AnalyticsChart
        exams={data.exams}
        exams_loading={data.loading}
        selected={data.plot_markers}
        on_toggle_spec={data.toggle_marker}
      />

      <View style={styles.section}>
        <SectionHeader
          title="Recent exams"
          subtitle="Tap a marker to add it to the trend plot."
          right={
            <Button
              label="View all"
              size="sm"
              variant="secondary"
              onPress={() => router.push("/exams")}
            />
          }
        />
        {data.exams.length === 0 ? (
          <EmptyState
            title="No exams yet"
            hint="Upload your first lab-report PDF and it will be parsed into structured biomarkers automatically."
          />
        ) : (
          data.exams.slice(0, 5).map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              plot_markers={data.plot_markers}
              can_delete={Boolean(user?.capabilities.delete_records)}
              can_retry={Boolean(user?.capabilities.retry_extraction)}
              retrying={retrying === exam.id}
              on_toggle_marker={data.toggle_marker}
              on_open={() => router.push(`/exam/${exam.id}`)}
              on_open_pdf={() => open_pdf(exam)}
              on_delete={() => delete_exam(exam)}
              on_retry={() => void retry_exam(exam.id)}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Medications"
          subtitle={`${active_meds} active`}
          right={
            <Button
              label="View all"
              size="sm"
              variant="secondary"
              onPress={() => router.push("/medications")}
            />
          }
        />
        {data.medications.filter(isOngoing).length === 0 ? (
          <EmptyState
            title="No active medications"
            hint="Add a medication to see it in the calendar."
          />
        ) : (
          <Card style={styles.listCard}>
            {data.medications
              .filter(isOngoing)
              .slice(0, 4)
              .map((medication) => (
                <View key={medication.id} style={styles.listRow}>
                  <View style={styles.listText}>
                    <Text style={styles.listTitle}>{medication.name}</Text>
                    <Text style={styles.listMeta}>
                      {medication.dosage} · {medication.frequency_per_day}x/day ·{" "}
                      {formatDate(medication.start_date)} — ongoing
                    </Text>
                  </View>
                  <Badge label="Active" tone="success" />
                </View>
              ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Symptoms"
          subtitle={`${data.calendar.symptoms.length} occurrence${
            data.calendar.symptoms.length === 1 ? "" : "s"
          }`}
          right={
            <Button
              label="View all"
              size="sm"
              variant="secondary"
              onPress={() => router.push("/symptoms")}
            />
          }
        />
        {recent_symptoms.length === 0 ? (
          <EmptyState
            title="No symptoms logged"
            hint="Log a symptom to see it in the calendar."
          />
        ) : (
          <Card style={styles.listCard}>
            {recent_symptoms.map((symptom) => (
              <View key={symptom.id} style={styles.listRow}>
                <View style={styles.listText}>
                  <Text style={styles.listTitle}>{symptom.title}</Text>
                  <Text style={styles.listMeta}>
                    {formatDate(symptom.start_date)}
                    {symptom.end_date ? ` — ${formatDate(symptom.end_date)}` : " — ongoing"}
                  </Text>
                </View>
                {isOngoing(symptom) && <Badge label="Ongoing" tone="warning" />}
              </View>
            ))}
          </Card>
        )}
      </View>

      <UploadExamModal
        visible={upload_open}
        onClose={() => set_upload_open(false)}
        onUploaded={() => void data.refresh()}
      />
      <MedicationModal
        visible={med_open}
        use={editing_med}
        names={medicationNames(data.medications)}
        onClose={() => {
          set_med_open(false);
          set_editing_med(null);
        }}
        onSaved={() => data.refresh()}
      />
      <SymptomModal
        visible={symptom_open}
        occurrence={editing_symptom}
        titles={symptomTitles(data.calendar.symptoms)}
        onClose={() => {
          set_symptom_open(false);
          set_editing_symptom(null);
        }}
        onSaved={() => data.refresh()}
      />
      <ItemDetailModal
        item={detail}
        can_delete={Boolean(user?.capabilities.delete_records)}
        onClose={() => set_detail(null)}
        onEdit={edit_detail}
        onDelete={delete_detail}
      />
    </Screen>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 9,
  },
  section: { gap: 8 },
  listCard: { padding: 0, gap: 0 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listText: { flex: 1, gap: 2 },
  listTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
  listMeta: { fontSize: 11, color: colors.textMuted },
});
