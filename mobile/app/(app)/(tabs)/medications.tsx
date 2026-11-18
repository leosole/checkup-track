import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { api } from "../../../src/api-client";
import { useAuth } from "../../../src/auth-context";
import { MedicationModal } from "../../../src/components/medication-modal";
import { Badge, Card, EmptyState, Spinner } from "../../../src/components/ui/card";
import { Button } from "../../../src/components/ui/button";
import { Chip, TextField } from "../../../src/components/ui/input";
import { Screen, ScreenHeader } from "../../../src/components/ui/screen";
import { useData } from "../../../src/data-context";
import { formatDate } from "../../../src/date-utils";
import { groupMedications, isOngoing, medicationNames } from "../../../src/forms";
import { radius, useAppStyles, type Palette } from "../../../src/theme";
import type { MedicationUse } from "../../../src/types";

type StatusFilter = "all" | "ongoing" | "past";

export default function MedicationsScreen() {
  const { user } = useAuth();
  const data = useData();
  const styles = useAppStyles(make_styles);
  const [query, set_query] = useState("");
  const [status, set_status] = useState<StatusFilter>("all");
  const [modal_open, set_modal_open] = useState(false);
  const [editing, set_editing] = useState<MedicationUse | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const normalized_query = query.trim().toLowerCase();
  const groups = groupMedications(data.medications)
    .map((group) => ({
      ...group,
      uses: group.uses.filter(
        (use) =>
          (status === "all" || (status === "ongoing") === isOngoing(use)) &&
          (!normalized_query ||
            group.name.toLowerCase().includes(normalized_query) ||
            use.dosage.toLowerCase().includes(normalized_query)),
      ),
    }))
    .filter((group) => group.uses.length > 0);
  const visible_count = groups.reduce(
    (sum, group) => sum + group.uses.length,
    0,
  );

  function delete_use(use: MedicationUse) {
    if (!user?.capabilities.delete_records) return;
    Alert.alert(
      "Delete this use?",
      `Delete this "${use.name}" use? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await api.deleteMedicationUse(use.id);
                await data.refresh();
              } catch (err) {
                set_error(
                  err instanceof Error
                    ? err.message
                    : "Could not delete the use.",
                );
              }
            })();
          },
        },
      ],
    );
  }

  function open_use(use: MedicationUse | null) {
    if (!use && !user?.capabilities.create_records) return;
    set_editing(use);
    set_modal_open(true);
  }

  return (
    <Screen refreshing={data.loading} onRefresh={() => void data.refresh()}>
      <ScreenHeader
        title="All medications"
        subtitle={`${data.medications.length} use${
          data.medications.length === 1 ? "" : "s"
        } on file`}
        right={
          <Button
            label="Add"
            size="sm"
            disabled={!user?.capabilities.create_records}
            onPress={() => open_use(null)}
          />
        }
      />

      <TextField
        value={query}
        onChangeText={set_query}
        placeholder="Search medications or dosage…"
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
        Showing {visible_count} of {data.medications.length}
      </Text>

      {data.loading && data.medications.length === 0 ? (
        <Spinner label="Loading medications" />
      ) : visible_count === 0 ? (
        <EmptyState
          title={
            data.medications.length === 0
              ? "No medications tracked"
              : "No medications match these filters"
          }
          hint={
            data.medications.length === 0
              ? "Add a medication to see its uses in the calendar."
              : undefined
          }
        />
      ) : (
        groups.map((group) => (
          <Card key={group.id} style={styles.card}>
            <Text style={styles.groupTitle}>{group.name}</Text>
            {group.uses.map((use) => (
              <View key={use.id} style={styles.useRow}>
                <View style={styles.useText}>
                  <View style={styles.useTitleRow}>
                    <Text style={styles.useTitle}>{use.dosage}</Text>
                    <Badge
                      label={isOngoing(use) ? "Ongoing" : "Past"}
                      tone={isOngoing(use) ? "success" : "gray"}
                    />
                  </View>
                  <Text style={styles.useMeta}>
                    {use.frequency_per_day}x per day ·{" "}
                    {use.end_date === null
                      ? `${formatDate(use.start_date)} — Ongoing`
                      : use.end_date === use.start_date
                        ? formatDate(use.start_date)
                        : `${formatDate(use.start_date)} — ${formatDate(
                            use.end_date,
                          )}`}
                  </Text>
                </View>
                <View style={styles.useActions}>
                  <Button
                    label="Edit"
                    size="sm"
                    variant="secondary"
                    disabled={!user?.capabilities.edit_medications}
                    onPress={() => open_use(use)}
                  />
                  <Button
                    label="Delete"
                    size="sm"
                    variant="danger"
                    disabled={!user?.capabilities.delete_records}
                    onPress={() => delete_use(use)}
                  />
                </View>
              </View>
            ))}
          </Card>
        ))
      )}

      <MedicationModal
        visible={modal_open}
        use={editing}
        names={medicationNames(data.medications)}
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
  useRow: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  useText: { gap: 3 },
  useTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  useTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
  useMeta: { fontSize: 11, color: colors.textMuted },
  useActions: { flexDirection: "row", gap: 6 },
});
