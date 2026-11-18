import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/auth-context";
import { useData } from "../../../src/data-context";
import { Badge, Card } from "../../../src/components/ui/card";
import { Button } from "../../../src/components/ui/button";
import { Chip } from "../../../src/components/ui/input";
import { Screen, ScreenHeader, SectionHeader } from "../../../src/components/ui/screen";
import {
  radius,
  useAppStyles,
  useTheme,
  type Palette,
  type ThemeMode,
} from "../../../src/theme";

export default function MoreScreen() {
  const router = useRouter();
  const { user, sign_out } = useAuth();
  const data = useData();
  const { mode, set_mode } = useTheme();
  const styles = useAppStyles(make_styles);

  return (
    <Screen>
      <ScreenHeader title="Account" subtitle={user?.email} />

      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <Badge
          label={`${data.exams.length} exams`}
          tone="brand"
        />
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Records" />
        <Card style={styles.links}>
          <Button
            label="Share your records"
            variant="secondary"
            onPress={() => router.push("/share")}
          />
          <Button
            label="View a shared code"
            variant="secondary"
            onPress={() => router.push("/guest")}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Appearance"
          subtitle="Follow your device, or choose a theme."
        />
        <Card style={styles.links}>
          <View style={styles.appearanceRow}>
            {(
              [
                ["system", "System"],
                ["light", "Light"],
                ["dark", "Dark"],
              ] as [ThemeMode, string][]
            ).map(([value, label]) => (
              <Chip
                key={value}
                label={label}
                active={mode === value}
                onPress={() => set_mode(value)}
              />
            ))}
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Settings"
          subtitle="Extraction runs with your own LLM provider keys."
        />
        <Card style={styles.links}>
          <Button
            label="API keys & provider order"
            variant="secondary"
            onPress={() => router.push("/profile")}
          />
          <Button
            label={data.loading ? "Refreshing…" : "Refresh data"}
            variant="secondary"
            loading={data.loading}
            onPress={() => void data.refresh()}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Button
          label="Sign out"
          variant="danger"
          onPress={() => void sign_out()}
        />
        <Text style={styles.footer}>
          CheckUpTrack · API-first for web and mobile clients
        </Text>
      </View>
    </Screen>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand100,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.brand700,
  },
  profileText: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: "700", color: colors.text },
  email: { fontSize: 12, color: colors.textMuted },
  section: { gap: 8 },
  links: { gap: 8 },
  appearanceRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textSubtle,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: 6,
  },
});
