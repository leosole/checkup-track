import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  radius,
  shadow,
  useAppStyles,
  useTheme,
  type Palette,
} from "../../theme";

type BadgeTone = "gray" | "brand" | "success" | "warning" | "danger" | "info";

function tones(
  colors: Palette,
): Record<BadgeTone, { bg: string; text: string; border: string }> {
  return {
    gray: { bg: colors.grayBg, text: colors.textMuted, border: colors.border },
    brand: {
      bg: colors.brand50,
      text: colors.brand700,
      border: colors.brand200,
    },
    success: {
      bg: colors.successBg,
      text: colors.success,
      border: colors.successBorder,
    },
    warning: {
      bg: colors.warningBg,
      text: colors.warning,
      border: colors.warningBorder,
    },
    danger: {
      bg: colors.dangerBg,
      text: colors.danger,
      border: colors.dangerBorder,
    },
    info: { bg: colors.infoBg, text: colors.info, border: colors.infoBorder },
  };
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useAppStyles(make_styles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  label,
  tone = "gray",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);
  const palette = tones(colors)[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.badgeText, { color: palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);
  return (
    <View style={styles.spinner}>
      <ActivityIndicator size="large" color={colors.brand600} />
      <Text style={styles.spinnerLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const styles = useAppStyles(make_styles);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadow.card,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    maxWidth: "100%",
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
  spinner: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  spinnerLabel: { marginTop: 8, color: colors.textMuted, fontSize: 13 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  emptyHint: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },
});
