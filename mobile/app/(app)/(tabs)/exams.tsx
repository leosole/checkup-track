import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../src/api-client";
import { useAuth } from "../../../src/auth-context";
import { AnalyticsChart } from "../../../src/components/analytics-chart";
import { ExamCard } from "../../../src/components/exam-card";
import { UploadExamModal } from "../../../src/components/upload-exam-modal";
import { EmptyState, Spinner } from "../../../src/components/ui/card";
import { Button } from "../../../src/components/ui/button";
import { Chip, TextField } from "../../../src/components/ui/input";
import { Screen, ScreenHeader, SectionHeader } from "../../../src/components/ui/screen";
import { useData } from "../../../src/data-context";
import { openStoredExam } from "../../../src/files";
import { radius, useAppStyles, type Palette } from "../../../src/theme";
import type { Exam } from "../../../src/types";

type StatusFilter = "all" | "abnormal" | "normal";
type SortMode = "date-desc" | "date-asc" | "title";

export default function ExamsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useData();
  const styles = useAppStyles(make_styles);
  const [query, set_query] = useState("");
  const [status, set_status] = useState<StatusFilter>("all");
  const [start_date, set_start_date] = useState("");
  const [end_date, set_end_date] = useState("");
  const [sort, set_sort] = useState<SortMode>("date-desc");
  const [upload_open, set_upload_open] = useState(false);
  const [retrying, set_retrying] = useState<number | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const normalized_query = query.trim().toLowerCase();
  const visible = data.exams
    .filter((exam) => {
      const has_abnormal = exam.biomarkers.some(
        (biomarker) => biomarker.is_abnormal,
      );
      const saved_without_parsing =
        !exam.processing && exam.biomarkers.length === 0 && !exam.markdown_path;
      const has_extracted_results =
        !saved_without_parsing &&
        (!exam.processing || exam.processing.status === "completed");
      const matches_query =
        !normalized_query ||
        exam.title.toLowerCase().includes(normalized_query) ||
        Boolean(exam.laboratory?.toLowerCase().includes(normalized_query)) ||
        exam.biomarkers.some((biomarker) =>
          biomarker.biomarker_name.toLowerCase().includes(normalized_query),
        );
      return (
        matches_query &&
        (status === "all" ||
          (has_extracted_results &&
            (status === "abnormal") === has_abnormal)) &&
        (!start_date || exam.date_performed >= start_date) &&
        (!end_date || exam.date_performed <= end_date)
      );
    })
    .sort((left, right) => {
      if (sort === "title") return left.title.localeCompare(right.title);
      return sort === "date-asc"
        ? left.date_performed.localeCompare(right.date_performed)
        : right.date_performed.localeCompare(left.date_performed);
    });

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

  return (
    <Screen refreshing={data.loading} onRefresh={() => void data.refresh()}>
      <ScreenHeader
        title="All exams"
        subtitle={`${data.exams.length} exam${
          data.exams.length === 1 ? "" : "s"
        } on file`}
        right={
          <Button
            label="Add exam"
            size="sm"
            disabled={!user?.capabilities.create_records}
            onPress={() => set_upload_open(true)}
          />
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextField
        value={query}
        onChangeText={set_query}
        placeholder="Search exams, biomarkers, ranges…"
        autoCapitalize="none"
      />

      <View style={styles.filters}>
        <Chip
          label="All"
          active={status === "all"}
          onPress={() => set_status("all")}
        />
        <Chip
          label="Abnormal"
          active={status === "abnormal"}
          onPress={() => set_status("abnormal")}
        />
        <Chip
          label="Normal"
          active={status === "normal"}
          onPress={() => set_status("normal")}
        />
      </View>

      <View style={styles.filters}>
        <TextField
          value={start_date}
          onChangeText={set_start_date}
          placeholder="From YYYY-MM-DD"
          autoCapitalize="none"
          style={styles.dateField}
        />
        <TextField
          value={end_date}
          onChangeText={set_end_date}
          placeholder="To YYYY-MM-DD"
          autoCapitalize="none"
          style={styles.dateField}
        />
      </View>

      <View style={styles.filters}>
        <Chip
          label="Newest"
          active={sort === "date-desc"}
          onPress={() => set_sort("date-desc")}
        />
        <Chip
          label="Oldest"
          active={sort === "date-asc"}
          onPress={() => set_sort("date-asc")}
        />
        <Chip
          label="Name"
          active={sort === "title"}
          onPress={() => set_sort("title")}
        />
      </View>

      <Text style={styles.count}>
        Showing {visible.length} of {data.exams.length}
      </Text>

      {data.loading && data.exams.length === 0 ? (
        <Spinner label="Loading exams" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            data.exams.length === 0
              ? "No exams yet"
              : "No exams match these filters"
          }
          hint={
            data.exams.length === 0
              ? "Uploaded lab reports will appear here."
              : undefined
          }
        />
      ) : (
        visible.map((exam) => (
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

      <View style={styles.chartSection}>
        <SectionHeader title="Biomarker trends" />
        <AnalyticsChart
          exams={data.exams}
          exams_loading={data.loading}
          selected={data.plot_markers}
          on_toggle_spec={data.toggle_marker}
        />
      </View>

      <UploadExamModal
        visible={upload_open}
        onClose={() => set_upload_open(false)}
        onUploaded={() => void data.refresh()}
      />
    </Screen>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 9,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dateField: { flex: 1, minWidth: 130 },
  count: { fontSize: 11, color: colors.textMuted },
  chartSection: { gap: 8, marginTop: 8 },
});
