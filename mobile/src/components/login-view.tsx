import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useAuth } from "../auth-context";
import { radius, useAppStyles, type Palette } from "../theme";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Logo } from "./logo";

export function LoginView() {
  const {
    google_configured,
    google_busy,
    test_user_enabled,
    auth_error,
    sign_in_with_google,
    sign_in_as_test_user,
  } = useAuth();
  const styles = useAppStyles(make_styles);
  const [busy, set_busy] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  async function testSignIn() {
    set_busy(true);
    set_error(null);
    try {
      await sign_in_as_test_user();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Test-user sign-in failed.",
      );
    } finally {
      set_busy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <View style={styles.logoWrap}>
            <Logo size={56} />
          </View>
          <Text style={styles.title}>Welcome to CheckUpTrack</Text>
          <Text style={styles.subtitle}>
            Your lab reports, medications, and biomarker trends — one secure
            health dashboard.
          </Text>

          <View style={styles.actions}>
            {google_configured ? (
              <Button
                label="Continue with Google"
                full
                loading={google_busy}
                onPress={sign_in_with_google}
              />
            ) : (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>
                  Google sign-in is not configured
                </Text>
                <Text style={styles.noticeText}>
                  Add EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (or the web client ID)
                  to mobile/.env.local, rebuild the app, and add the same client
                  ID to GOOGLE_CLIENT_IDS on the backend.
                </Text>
              </View>
            )}

            {test_user_enabled && (
              <Button
                label="Login as test user"
                variant="secondary"
                full
                loading={busy}
                onPress={() => void testSignIn()}
              />
            )}

            {(error || auth_error) && (
              <Text style={styles.error}>{error ?? auth_error}</Text>
            )}
          </View>

          <View style={styles.features}>
            <View style={styles.feature}>
              <Text style={styles.featureTitle}>PDF</Text>
              <Text style={styles.featureText}>Parse lab reports</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureTitle}>Chart</Text>
              <Text style={styles.featureText}>Track biomarkers</Text>
            </View>
            <View style={styles.feature}>
              <Text style={styles.featureTitle}>Plan</Text>
              <Text style={styles.featureText}>Manage meds</Text>
            </View>
          </View>
        </Card>

        <Link href="/guest" style={styles.guestLink}>
          Have a share code? View shared records
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brand50 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    gap: 16,
  },
  card: { padding: 24, gap: 12 },
  logoWrap: { alignItems: "center" },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  actions: { gap: 10, marginTop: 8 },
  notice: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.md,
    padding: 10,
    gap: 3,
  },
  noticeTitle: { fontSize: 13, fontWeight: "700", color: colors.warning },
  noticeText: { fontSize: 12, color: colors.warning, lineHeight: 17 },
  error: {
    fontSize: 12,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 9,
  },
  features: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginTop: 4,
  },
  feature: { flex: 1, alignItems: "center", gap: 2 },
  featureTitle: { fontSize: 12, fontWeight: "700", color: colors.brand700 },
  featureText: { fontSize: 10, color: colors.textMuted, textAlign: "center" },
  guestLink: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand700,
    padding: 4,
  },
});
