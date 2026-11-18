import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDate } from "../date-utils";
import { radius, useAppStyles, type Palette } from "../theme";
import type { Exam } from "../types";
import { Badge, Card } from "./ui/card";
import { Button } from "./ui/button";

export function examStatusLabel(exam: Exam): string | null {
  const processing = exam.processing;
  const saved_without_parsing =
    !processing && exam.biomarkers.length === 0 && !exam.markdown_path;
  if (saved_without_parsing) return "Saved without parsing";
  if (!processing || processing.status === "completed") return null;
  if (processing.stage === "waiting_for_provider") {
    return "Waiting for provider limit";
  }
  if (processing.status === "queued") return "Extraction queued";
  if (processing.status === "failed") return "Extraction failed";
  if (processing.stage === "converting") return "Reading PDF";
  if (processing.total_chunks > 0) {
    return `Extracting · ${processing.completed_chunks} of ${processing.total_chunks} chunks`;
  }
  return "Preparing extraction";
}

export function ExamCard({
  exam,
  plot_markers,
  can_delete,
  can_retry,
  retrying = false,
  on_toggle_marker,
  on_open,
  on_open_pdf,
  on_delete,
  on_retry,
}: {
  exam: Exam;
  plot_markers: string[];
  can_delete: boolean;
  can_retry: boolean;
  retrying?: boolean;
  on_toggle_marker: (name: string) => void;
  on_open: () => void;
  on_open_pdf: () => void;
  on_delete: () => void;
  on_retry: () => void;
}) {
  const styles = useAppStyles(make_styles);
  const [expanded, set_expanded] = useState(false);
  const status_label = examStatusLabel(exam);
  const abnormal = exam.biomarkers.filter((item) => item.is_abnormal).length;
  const processing = exam.processing;

  return (
    <Card style={styles.card}>
      <Pressable onPress={on_open} accessibilityLabel={`View ${exam.title}`}>
        <Text style={styles.title} numberOfLines={2}>
          {exam.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.date}>
            Performed {formatDate(exam.date_performed)}
          </Text>
          {status_label ? (
            <Badge
              label={status_label}
              tone={
                processing?.status === "failed"
                  ? "warning"
                  : processing?.status === "queued" ||
                      processing?.status === "processing"
                    ? "info"
                    : "gray"
              }
            />
          ) : (
            <Badge
              label={
                abnormal > 0
                  ? `${abnormal} out of range`
                  : exam.biomarkers.length === 0
                    ? "No results"
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
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={() => set_expanded((value) => !value)}
        style={styles.resultsToggle}
        accessibilityRole="button"
      >
        <Text style={styles.resultsToggleText}>
          Results ({exam.biomarkers.length}) {expanded ? "▴" : "▾"}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.markerWrap}>
          {exam.biomarkers.length === 0 &&
            processing?.status !== "queued" &&
            processing?.status !== "processing" && (
              <Text style={styles.muted}>No biomarkers extracted.</Text>
            )}
          {exam.biomarkers.length === 0 &&
            (processing?.status === "queued" ||
              processing?.status === "processing") && (
              <Text style={styles.muted}>
                Results will appear here when extraction finishes.
              </Text>
            )}
          {exam.biomarkers.map((biomarker) => {
            const plotted = plot_markers.some(
              (name) =>
                name.trim().toLowerCase() ===
                biomarker.biomarker_name.trim().toLowerCase(),
            );
            return (
              <Pressable
                key={biomarker.id}
                onPress={() => on_toggle_marker(biomarker.biomarker_name)}
                accessibilityLabel={`${biomarker.biomarker_name}: ${biomarker.value} ${biomarker.unit}`}
                style={[
                  styles.marker,
                  plotted
                    ? styles.markerPlotted
                    : biomarker.is_abnormal
                      ? styles.markerAbnormal
                      : styles.markerNormal,
                ]}
              >
                <Text
                  style={[
                    styles.markerName,
                    plotted
                      ? styles.markerNamePlotted
                      : biomarker.is_abnormal
                        ? styles.markerNameAbnormal
                        : undefined,
                  ]}
                >
                  {plotted ? "✓ " : ""}
                  {biomarker.biomarker_name}{" "}
                  <Text style={styles.markerValue}>
                    {biomarker.value}
                    {biomarker.unit ? ` ${biomarker.unit}` : ""}
                  </Text>
                </Text>
                {biomarker.is_abnormal && <View style={styles.abnormalDot} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {exam.extraction_error ? (
        <Text style={styles.error}>{exam.extraction_error}</Text>
      ) : null}

      <View style={styles.actions}>
        <Button label="Open file" size="sm" variant="secondary" onPress={on_open_pdf} />
        <Button label="Details" size="sm" variant="secondary" onPress={on_open} />
        {processing?.retry_allowed && (
          <Button
            label="Retry extraction"
            size="sm"
            variant="secondary"
            loading={retrying}
            disabled={!can_retry}
            onPress={on_retry}
          />
        )}
        <Button
          label="Delete"
          size="sm"
          variant="danger"
          disabled={!can_delete}
          onPress={on_delete}
        />
      </View>
    </Card>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  card: { gap: 8 },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  date: { fontSize: 12, color: colors.textMuted },
  resultsToggle: { paddingVertical: 2 },
  resultsToggleText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  markerWrap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  marker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  markerNormal: { backgroundColor: colors.bg, borderColor: colors.border },
  markerPlotted: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand300,
  },
  markerAbnormal: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  markerName: { fontSize: 11, color: colors.textMuted },
  markerNamePlotted: { color: colors.brand700, fontWeight: "600" },
  markerNameAbnormal: { color: colors.danger },
  markerValue: { fontWeight: "700", color: colors.text },
  abnormalDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.danger,
  },
  muted: { fontSize: 12, color: colors.textSubtle },
  error: {
    fontSize: 12,
    color: colors.warning,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: 8,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
});
