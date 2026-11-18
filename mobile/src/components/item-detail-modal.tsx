import { StyleSheet, Text, View } from "react-native";
import { formatDate } from "../date-utils";
import { isOngoing } from "../forms";
import { useAppStyles, type Palette } from "../theme";
import type { MedicationUse, SymptomOccurrence } from "../types";
import { Badge } from "./ui/card";
import { Button } from "./ui/button";
import { Sheet } from "./ui/sheet";

export type DetailItem =
  | { kind: "medication"; medication: MedicationUse }
  | { kind: "symptom"; symptom: SymptomOccurrence };

export function ItemDetailModal({
  item,
  can_delete,
  onClose,
  onEdit,
  onDelete,
}: {
  item: DetailItem | null;
  can_delete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const styles = useAppStyles(make_styles);
  const medication = item?.kind === "medication" ? item.medication : null;
  const symptom = item?.kind === "symptom" ? item.symptom : null;

  return (
    <Sheet
      visible={item !== null}
      title={medication?.name ?? symptom?.title ?? "Details"}
      subtitle={medication ? "Medication details" : "Symptom details"}
      onClose={onClose}
      footer={
        <>
          <Button label="Edit" size="sm" variant="secondary" onPress={onEdit} />
          <Button
            label="Delete"
            size="sm"
            variant="danger"
            disabled={!can_delete}
            onPress={onDelete}
          />
        </>
      }
    >
      {medication ? (
        <View style={styles.grid}>
          <View style={styles.fullRow}>
            <Text style={styles.label}>Status</Text>
            <Badge
              label={isOngoing(medication) ? "Active" : "Inactive"}
              tone={isOngoing(medication) ? "success" : "gray"}
            />
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.label}>Dosage</Text>
              <Text style={styles.value}>{medication.dosage}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>Frequency</Text>
              <Text style={styles.value}>
                {medication.frequency_per_day} per day
              </Text>
            </View>
          </View>
          <View style={styles.fullRow}>
            <Text style={styles.label}>Dates</Text>
            <Text style={styles.value}>
              {medication.end_date === null
                ? `${formatDate(medication.start_date)} — Ongoing`
                : medication.end_date === medication.start_date
                  ? formatDate(medication.start_date)
                  : `${formatDate(medication.start_date)} — ${formatDate(
                      medication.end_date,
                    )}`}
            </Text>
          </View>
        </View>
      ) : symptom ? (
        <View style={styles.grid}>
          <View style={styles.fullRow}>
            <Text style={styles.label}>Dates</Text>
            <Text style={styles.value}>
              {symptom.end_date === null
                ? `${formatDate(symptom.start_date)} — Ongoing`
                : symptom.end_date === symptom.start_date
                  ? formatDate(symptom.start_date)
                  : `${formatDate(symptom.start_date)} — ${formatDate(
                      symptom.end_date,
                    )}`}
            </Text>
          </View>
          <View style={styles.fullRow}>
            <Text style={styles.label}>Observation</Text>
            <Text style={styles.value}>
              {symptom.observation || "No observation for this occurrence."}
            </Text>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  grid: { gap: 14 },
  row: { flexDirection: "row", gap: 16 },
  fullRow: { gap: 4 },
  flex: { flex: 1, gap: 4 },
  label: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  value: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
