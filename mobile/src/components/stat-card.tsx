import { StyleSheet, Text, View } from "react-native";
import { radius, useAppStyles, useTheme, type Palette } from "../theme";

export function StatCard({
  label,
  value,
  hint,
  tone = "gray",
}: {
  label: string;
  value: number | string;
  hint: string;
  tone?: "brand" | "danger" | "success" | "gray";
}) {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);
  const background =
    tone === "brand"
      ? colors.brand50
      : tone === "danger"
        ? colors.dangerBg
        : tone === "success"
          ? colors.successBg
          : colors.surface;
  const value_color =
    tone === "brand"
      ? colors.brand700
      : tone === "danger"
        ? colors.danger
        : tone === "success"
          ? colors.success
          : colors.text;

  return (
    <View style={[styles.card, { backgroundColor: background }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: value_color }]}>{value}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    gap: 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  label: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  value: { fontSize: 22, fontWeight: "700" },
  hint: { fontSize: 10, color: colors.textSubtle },
});
