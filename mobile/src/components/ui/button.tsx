import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  radius,
  useAppStyles,
  useTheme,
  type Palette,
} from "../../theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: "md" | "sm";
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}

function palettes(
  colors: Palette,
): Record<Variant, { background: string; text: string; border?: string }> {
  return {
    primary: { background: colors.brand600, text: colors.white },
    secondary: {
      background: colors.surface,
      text: colors.text,
      border: colors.borderStrong,
    },
    danger: { background: colors.danger, text: colors.white },
    ghost: { background: "transparent", text: colors.textMuted },
  };
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  full = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);
  const palette = palettes(colors)[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.small : styles.medium,
        {
          backgroundColor: palette.background,
          borderColor: palette.border ?? "transparent",
          borderWidth: palette.border ? 1 : 0,
        },
        full && styles.full,
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "secondary" ? colors.brand600 : colors.white}
        />
      ) : (
        <Text
          style={[
            styles.label,
            size === "sm" ? styles.labelSmall : styles.labelMedium,
            { color: palette.text },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  medium: { paddingHorizontal: 16, paddingVertical: 11 },
  small: { paddingHorizontal: 10, paddingVertical: 7 },
  full: { alignSelf: "stretch" },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.45 },
  label: { fontWeight: "600" },
  labelMedium: { fontSize: 14 },
  labelSmall: { fontSize: 12 },
});
