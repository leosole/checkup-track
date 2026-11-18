import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import {
  radius,
  useAppStyles,
  useTheme,
  type Palette,
} from "../../theme";

export function TextField({
  label,
  hint,
  style,
  ...input
}: TextInputProps & {
  label?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, input.multiline && styles.multiline]}
        {...input}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const styles = useAppStyles(make_styles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipIdle,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.chipText, active ? styles.chipTextActive : undefined]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const styles = useAppStyles(make_styles);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export function SelectRow({
  label,
  selected,
  onPress,
  hint,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  hint?: string;
}) {
  const styles = useAppStyles(make_styles);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.selectRow, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
        {selected ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <View style={styles.selectTextWrap}>
        <Text style={styles.selectLabel}>{label}</Text>
        {hint ? <Text style={styles.selectHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  multiline: { minHeight: 76, textAlignVertical: "top" },
  hint: { fontSize: 12, color: colors.textMuted },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand50, borderColor: colors.brand300 },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: colors.brand700 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.brand600,
    borderColor: colors.brand600,
  },
  check: { color: colors.white, fontSize: 13, fontWeight: "700" },
  checkLabel: { fontSize: 13, color: colors.text, flexShrink: 1 },
  selectRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectTextWrap: { flex: 1, gap: 2 },
  selectLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  selectHint: { fontSize: 11, color: colors.textMuted },
  pressed: { opacity: 0.7 },
});
