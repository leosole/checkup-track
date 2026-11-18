import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { api, getGuestToken, setGuestToken } from "../api-client";
import { formatDate, formatTimestamp } from "../date-utils";
import { openStoredExam } from "../files";
import { radius, useAppStyles, type Palette } from "../theme";
import type { GuestShareData } from "../types";
import { AnalyticsChart, GUEST_MERGED_SPECS_KEY } from "./analytics-chart";
import { Badge, Card, EmptyState, Spinner } from "./ui/card";
import { Button } from "./ui/button";
import { TextField } from "./ui/input";
import { Screen, ScreenHeader, SectionHeader } from "./ui/screen";

export function GuestView() {
  const [token, set_token] = useState<string | null>(null);
  const [data, set_data] = useState<GuestShareData | null>(null);
  const [code, set_code] = useState("");
  const [loading, set_loading] = useState(true);
  const [busy, set_busy] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [selected, set_selected] = useState<string[]>([]);
  const styles = useAppStyles(make_styles);

  useEffect(() => {
    let active = true;
    (async () => {
      const existing = await getGuestToken();
      if (existing) {
        if (active) set_token(existing);
        try {
          const payload = await api.guestData();
          if (active) set_data(payload);
        } catch {
          await setGuestToken(null);
          if (active) set_token(null);
        }
      }
      if (active) set_loading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function redeem() {
    if (!code.trim()) {
      set_error("Enter the share code first.");
      return;
    }
    set_busy(true);
    set_error(null);
    try {
      const res = await api.redeemShareCode(code);
      await setGuestToken(res.access_token);
      set_token(res.access_token);
      set_data(await api.guestData());
      set_code("");
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not open this share code.",
      );
    } finally {
      set_busy(false);
    }
  }

  async function reload() {
    if (!token) return;
    try {
      set_data(await api.guestData());
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not refresh this view.",
      );
    }
  }

  async function exit() {
    await setGuestToken(null);
    set_token(null);
    set_data(null);
    set_selected([]);
  }

  function open_pdf(exam_id: number, title: string) {
    void openStoredExam(exam_id, title, "pdf", true).catch((err: unknown) =>
      Alert.alert(
        "Could not open the file",
        err instanceof Error ? err.message : "Try again.",
      ),
    );
  }

  function toggle_marker(name: string) {
    set_selected((current) =>
      current.some((item) => item.toLowerCase() === name.toLowerCase())
        ? current.filter((item) => item.toLowerCase() !== name.toLowerCase())
        : [...current, name],
    );
  }

  if (loading) {
    return (
      <Screen>
        <Spinner label="Opening shared records" />
      </Screen>
    );
  }

  if (!token || !data) {
    return (
      <Screen>
          <ScreenHeader
            title="Shared records"
            subtitle="Enter the one-time code you were given to view a read-only copy."
          />
          <Card style={styles.card}>
            <TextField
              label="Share code"
              value={code}
              onChangeText={(value) => set_code(value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Open shared records"
              loading={busy}
              onPress={() => void redeem()}
            />
            <Text style={styles.hint}>
              A share code works once and only exposes the records its owner
              selected.
            </Text>
          </Card>
          <Link href="/sign-in" style={styles.link}>
            Back to sign in
          </Link>
      </Screen>
    );
  }

  const guest_exams = data.exams.map((exam) => ({
    date_performed: exam.date_performed,
    biomarkers: exam.biomarkers,
  }));

  return (
    <Screen onRefresh={() => void reload()}>
        <ScreenHeader
          title="Shared records"
          subtitle={`Shared by ${data.share.owner_name} · expires ${formatTimestamp(
            data.share.expires_at,
          )}`}
          right={<Button label="Exit" size="sm" variant="secondary" onPress={() => void exit()} />}
        />

        <View style={styles.summary}>
          <Badge label={`${data.share.exam_count} exams`} tone="brand" />
          <Badge label={`${data.share.medication_count} medications`} tone="info" />
          <Badge label={`${data.share.symptom_count} symptoms`} tone="danger" />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Card style={styles.card}>
          <AnalyticsChart
            exams={guest_exams}
            selected={selected}
            on_toggle_spec={toggle_marker}
            load_series={(params) => api.guestTimeSeries(params)}
            merge_storage_key={GUEST_MERGED_SPECS_KEY}
          />
        </Card>

        <View style={styles.section}>
          <SectionHeader title={`Exams (${data.exams.length})`} />
          {data.exams.length === 0 ? (
            <EmptyState
              title="No exams shared"
              hint="The owner did not include any lab reports in this code."
            />
          ) : (
            data.exams.map((exam) => (
              <Card key={exam.id} style={styles.card}>
                <View style={styles.rowHeader}>
                  <View style={styles.rowTitleWrap}>
                    <Text style={styles.rowTitle}>{exam.title}</Text>
                    <Text style={styles.meta}>
                      {formatDate(exam.date_performed)}
                    </Text>
                  </View>
                  <Button
                    label="Open PDF"
                    size="sm"
                    variant="secondary"
                    onPress={() => open_pdf(exam.id, exam.title)}
                  />
                </View>
                {exam.biomarkers.length === 0 ? (
                  <Text style={styles.hint}>No parsed results for this exam.</Text>
                ) : (
                  exam.biomarkers.map((biomarker) => {
                    const plotted = selected.some(
                      (name) =>
                        name.toLowerCase() ===
                        biomarker.biomarker_name.toLowerCase(),
                    );
                    return (
                      <Pressable
                        key={biomarker.id}
                        onPress={() => toggle_marker(biomarker.biomarker_name)}
                        style={styles.biomarkerRow}
                      >
                        <View style={styles.biomarkerNameWrap}>
                          <Text style={styles.biomarkerName}>
                            {plotted ? "✓ " : ""}
                            {biomarker.biomarker_name}
                          </Text>
                          {biomarker.reference_range ? (
                            <Text style={styles.reference}>
                              ref {biomarker.reference_range}
                            </Text>
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.biomarkerValue,
                            biomarker.is_abnormal && styles.abnormalText,
                          ]}
                        >
                          {biomarker.value} {biomarker.unit}
                        </Text>
                        <Badge
                          label={
                            biomarker.is_abnormal ? "Out of range" : "In range"
                          }
                          tone={biomarker.is_abnormal ? "danger" : "success"}
                        />
                      </Pressable>
                    );
                  })
                )}
              </Card>
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title={`Medications (${data.medications.length})`} />
          {data.medications.length === 0 ? (
            <EmptyState title="No medications shared" />
          ) : (
            data.medications.map((medication) => (
              <Card key={medication.id} style={styles.card}>
                <Text style={styles.rowTitle}>{medication.name}</Text>
                {medication.uses.map((use) => (
                  <Text key={use.id} style={styles.meta}>
                    {use.dosage} · {use.frequency_per_day}x/day ·{" "}
                    {formatDate(use.start_date)}{" "}
                    {use.end_date ? `– ${formatDate(use.end_date)}` : "– ongoing"}
                  </Text>
                ))}
              </Card>
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title={`Symptoms (${data.symptoms.length})`} />
          {data.symptoms.length === 0 ? (
            <EmptyState title="No symptoms shared" />
          ) : (
            data.symptoms.map((symptom) => (
              <Card key={symptom.id} style={styles.card}>
                <Text style={styles.rowTitle}>{symptom.title}</Text>
                {symptom.occurrences.map((occurrence) => (
                  <View key={occurrence.id} style={styles.occurrence}>
                    <Text style={styles.meta}>
                      {formatDate(occurrence.start_date)}{" "}
                      {occurrence.end_date
                        ? `– ${formatDate(occurrence.end_date)}`
                        : "— Ongoing"}
                    </Text>
                    {occurrence.observation ? (
                      <Text style={styles.observation}>
                        {occurrence.observation}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </Card>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          This view is read-only. The owner can revoke access at any time.
        </Text>
    </Screen>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  card: { gap: 8 },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 9,
  },
  hint: { fontSize: 12, color: colors.textSubtle },
  link: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand700,
  },
  section: { gap: 8 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    justifyContent: "space-between",
  },
  rowTitleWrap: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  biomarkerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 7,
  },
  biomarkerNameWrap: { flex: 1, gap: 1 },
  biomarkerName: { fontSize: 12, color: colors.text },
  reference: { fontSize: 10, color: colors.textSubtle },
  biomarkerValue: { fontSize: 12, fontWeight: "600", color: colors.text },
  abnormalText: { color: colors.danger },
  occurrence: { gap: 2 },
  observation: { fontSize: 12, color: colors.textMuted },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: colors.textSubtle,
  },
});
