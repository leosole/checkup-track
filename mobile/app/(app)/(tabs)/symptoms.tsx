import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { api } from "../../../src/api-client";
import { useAuth } from "../../../src/auth-context";
import { SymptomModal } from "../../../src/components/symptom-modal";
import { Badge, Card, EmptyState, Spinner } from "../../../src/components/ui/card";
import { Button } from "../../../src/components/ui/button";
import { Chip, TextField } from "../../../src/components/ui/input";
import { Screen, ScreenHeader } from "../../../src/components/ui/screen";
import { useData } from "../../../src/data-context";
import { formatDate } from "../../../src/date-utils";
import { groupSymptoms, isOngoing, symptomTitles } from "../../../src/forms";
import { radius, useAppStyles, type Palette } from "../../../src/theme";
import type { SymptomOccurrence } from "../../../src/types";

type StatusFilter = "all" | "ongoing" | "past";

export default function SymptomsScreen() {
  const { user } = useAuth();
  const data = useData();
  const styles = useAppStyles(make_styles);
  const [query, set_query] = useState("");
  const [status, set_status] = useState<StatusFilter>("all");
  const [modal_open, set_modal_open] = useState(false);
  const [editing, set_editing] = useState<SymptomOccurrence | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const occurrences = data.calendar.symptoms;
  const normalized_query = query.trim().toLowerCase();
  const groups = groupSymptoms(occurrences)
    .map((group) => ({
      ...group,
      occurrences: group.occurrences.filter(
        (occurrence) =>
          (status === "all" ||
            (status === "ongoing") === isOngoing(occurrence)) &&
          (!normalized_query ||
            group.title.toLowerCase().includes(normalized_query) ||
            (occurrence.observation ?? "")
              .toLowerCase()
              .includes(normalized_query)),
      ),
    }))
    .filter((group) => group.occurrences.length > 0);
  const visible_count = groups.reduce(
    (sum, group) => sum + group.occurrences.length,
    0,
  );

  function delete_occurrence(occurrence: SymptomOccurrence) {
    if (!user?.capabilities.delete_records) return;
    Alert.alert(
      "Delete this occurrence?",
      `Delete this "${occurrence.title}" occurrence? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await api.deleteSymptomOccurrence(occurrence.id);
                await data.refresh();
              } catch (err) {
                set_error(
                  err instanceof Error
                    ? err.message
                    : "Could not delete the symptom occurrence.",
                );
              }
            })();
          },
        },
      ],
    );
  }

  function edit_occurrence(occurrence: SymptomOccurrence) {
    set_editing(occurrence);
    set_modal_open(true);
  }

  return (
    <Screen refreshing={data.loading} onRefresh={() => void data.refresh()}>
      <ScreenHeader
        title="All symptoms"
        subtitle={`${occurrences.length} occurrence${
          occurrences.length === 1 ? "" : "s"
        } on file`}
        right={
          <Button
            label="Log"
            size="sm"
            disabled={!user?.capabilities.create_records}
            onPress={() => {
              set_editing(null);
              set_modal_open(true);
            }}
          />
        }
      />

      <TextField
        value={query}
        onChangeText={set_query}
        placeholder="Search symptoms or observations…"
        autoCapitalize="none"
      />

      <View style={styles.filters}>
        <Chip
          label="All"
          active={status === "all"}
          onPress={() => set_status("all")}
        />
        <Chip
          label="Ongoing"
          active={status === "ongoing"}
          onPress={() => set_status("ongoing")}
        />
        <Chip
          label="Past"
          active={status === "past"}
          onPress={() => set_status("past")}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.count}>
        Showing {visible_count} of {occurrences.length}
      </Text>

      {data.loading && occurrences.length === 0 ? (
        <Spinner label="Loading symptoms" />
      ) : visible_count === 0 ? (
        <EmptyState
          title={
            occurrences.length === 0
              ? "No symptoms logged"
              : "No symptoms match these filters"
          }
          hint={
            occurrences.length === 0
              ? "Log a symptom to see it in the calendar."
              : undefined
          }
        />
      ) : (
        groups.map((group) => (
          <Card key={group.id} style={styles.card}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.occurrences.map((occurrence) => (
              <View key={occurrence.id} style={styles.occurrenceRow}>
                <View style={styles.occurrenceText}>
                  <View style={styles.occurrenceTitleRow}>
                    <Text style={styles.occurrenceDates}>
                      {occurrence.end_date === null
                        ? `${formatDate(occurrence.start_date)} — Ongoing`
                        : occurrence.end_date === occurrence.start_date
                          ? formatDate(occurrence.start_date)
                          : `${formatDate(occurrence.start_date)} — ${formatDate(
                              occurrence.end_date,
                            )}`}
                    </Text>
                    <Badge
                      label={isOngoing(occurrence) ? "Ongoing" : "Past"}
                      tone={isOngoing(occurrence) ? "warning" : "gray"}
                    />
                  </View>
                  {occurrence.observation ? (
                    <Text style={styles.observation}>
                      {occurrence.observation}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.actions}>
                  <Button
                    label="Edit"
                    size="sm"
                    variant="secondary"
                    disabled={!user?.capabilities.edit_symptoms}
                    onPress={() => edit_occurrence(occurrence)}
                  />
                  <Button
                    label="Delete"
                    size="sm"
                    variant="danger"
                    disabled={!user?.capabilities.delete_records}
                    onPress={() => delete_occurrence(occurrence)}
                  />
                </View>
              </View>
            ))}
          </Card>
        ))
      )}

      <SymptomModal
        visible={modal_open}
        occurrence={editing}
        titles={symptomTitles(occurrences)}
        onClose={() => {
          set_modal_open(false);
          set_editing(null);
        }}
        onSaved={() => data.refresh()}
      />
    </Screen>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 9,
  },
  count: { fontSize: 11, color: colors.textMuted },
  card: { gap: 10 },
  groupTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  occurrenceRow: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  occurrenceText: { gap: 3 },
  occurrenceTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  occurrenceDates: { fontSize: 12, fontWeight: "600", color: colors.text },
  observation: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  actions: { flexDirection: "row", gap: 6 },
});
