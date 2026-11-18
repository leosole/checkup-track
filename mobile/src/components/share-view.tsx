import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { api } from "../api-client";
import { useAuth } from "../auth-context";
import { useData } from "../data-context";
import { formatDate, formatTimestamp } from "../date-utils";
import { groupSymptoms } from "../forms";
import { radius, useAppStyles, type Palette } from "../theme";
import type { ShareCreated, ShareGroup } from "../types";
import { Badge, Card, EmptyState, Spinner } from "./ui/card";
import { Button } from "./ui/button";
import { Chip, SelectRow, TextField } from "./ui/input";
import { SectionHeader } from "./ui/screen";

const EXPIRY_OPTIONS = [1, 3, 7, 30];

const STATUS_TONES = {
  active: "success",
  used: "info",
  expired: "gray",
  revoked: "danger",
} as const;

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function ShareView() {
  const { user } = useAuth();
  const { exams, medications, calendar } = useData();
  const styles = useAppStyles(make_styles);
  const [selected_exams, set_selected_exams] = useState<Set<number>>(new Set());
  const [selected_medications, set_selected_medications] = useState<Set<number>>(
    new Set(),
  );
  const [selected_symptoms, set_selected_symptoms] = useState<Set<number>>(
    new Set(),
  );
  const [expires_in_days, set_expires_in_days] = useState(7);
  const [groups, set_groups] = useState<ShareGroup[]>([]);
  const [loading_groups, set_loading_groups] = useState(true);
  const [creating, set_creating] = useState(false);
  const [sharing_key, set_sharing_key] = useState<string | null>(null);
  const [renaming_key, set_renaming_key] = useState<string | null>(null);
  const [rename_value, set_rename_value] = useState("");
  const [revoking_id, set_revoking_id] = useState<number | null>(null);
  const [created, set_created] = useState<ShareCreated | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const load_groups = useCallback(async () => {
    try {
      set_groups(await api.listShareGroups());
      set_error(null);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not load shared items.",
      );
    } finally {
      set_loading_groups(false);
    }
  }, []);

  useEffect(() => {
    void load_groups();
  }, [load_groups]);

  // Drop selections for records that disappeared while this screen was open.
  useEffect(() => {
    set_selected_exams((current) => {
      const next = new Set(
        [...current].filter((id) => exams.some((exam) => exam.id === id)),
      );
      return next.size === current.size ? current : next;
    });
  }, [exams]);

  useEffect(() => {
    set_selected_medications((current) => {
      const next = new Set(
        [...current].filter((id) =>
          medications.some((medication) => medication.id === id),
        ),
      );
      return next.size === current.size ? current : next;
    });
  }, [medications]);

  useEffect(() => {
    const available = new Set(calendar.symptoms.map((symptom) => symptom.id));
    set_selected_symptoms((current) => {
      const next = new Set([...current].filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [calendar.symptoms]);

  const symptom_groups = groupSymptoms(calendar.symptoms);
  const has_selection =
    selected_exams.size > 0 ||
    selected_medications.size > 0 ||
    selected_symptoms.size > 0;

  function toggle(
    setter: Dispatch<SetStateAction<Set<number>>>,
    id: number,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggle_group(ids: number[]) {
    set_selected_symptoms((current) => {
      const next = new Set(current);
      const all_selected = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (all_selected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function create_share() {
    if (!has_selection) return;
    set_creating(true);
    set_error(null);
    try {
      const result = await api.createShare({
        exam_ids: [...selected_exams],
        medication_use_ids: [...selected_medications],
        symptom_occurrence_ids: [...selected_symptoms],
        expires_in_days,
      });
      set_created(result);
      if (result.share.code) {
        await Share.share({
          message: `CheckUpTrack share code: ${result.share.code}\nExpires ${formatTimestamp(
            result.share.expires_at,
          )}. Open the app's "View shared records" screen and enter this code.`,
        });
      }
      await load_groups();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not create a share code.",
      );
    } finally {
      set_creating(false);
    }
  }

  async function share_again(group: ShareGroup) {
    set_sharing_key(group.group_key);
    set_error(null);
    try {
      const result = await api.createShare({
        exam_ids: group.exam_ids,
        medication_use_ids: group.medication_use_ids,
        symptom_occurrence_ids: group.symptom_occurrence_ids,
        expires_in_days,
      });
      set_created(result);
      if (result.share.code) {
        await Share.share({
          message: `CheckUpTrack share code: ${result.share.code}`,
        });
      }
      await load_groups();
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not create a share code.",
      );
    } finally {
      set_sharing_key(null);
    }
  }

  async function save_rename(group: ShareGroup) {
    set_renaming_key(group.group_key);
    set_error(null);
    try {
      const title = rename_value.trim() || null;
      set_groups(await api.renameShareGroup(group.group_key, title));
      set_renaming_key(null);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not rename the group.",
      );
    } finally {
      set_renaming_key(null);
    }
  }

  function revoke(code_id: number) {
    if (!user?.capabilities.revoke_shares) return;
    Alert.alert(
      "Revoke this code?",
      "Anyone using it loses access immediately. The records stay in your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => {
            void (async () => {
              set_revoking_id(code_id);
              set_error(null);
              try {
                await api.revokeShare(code_id);
                await load_groups();
              } catch (err) {
                set_error(
                  err instanceof Error
                    ? err.message
                    : "Could not revoke this code.",
                );
              } finally {
                set_revoking_id(null);
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        Pick the exams, medications and symptoms to share, then send the
        one-time code.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {created?.share.code ? (
        <Card style={styles.created}>
          <Text style={styles.createdLabel}>Share code</Text>
          <Text style={styles.code}>{created.share.code}</Text>
          <Text style={styles.createdHint}>
            Expires {formatTimestamp(created.share.expires_at)} · single use ·
            read-only
          </Text>
          <View style={styles.actions}>
            <Button
              label="Share code"
              size="sm"
              onPress={() =>
                void Share.share({
                  message: `CheckUpTrack share code: ${created.share.code}`,
                })
              }
            />
            <Button
              label="Dismiss"
              size="sm"
              variant="ghost"
              onPress={() => set_created(null)}
            />
          </View>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <SectionHeader
          title="Exams"
          right={
            <Button
              label={selected_exams.size === exams.length && exams.length > 0 ? "Clear" : "Select all"}
              size="sm"
              variant="secondary"
              disabled={exams.length === 0}
              onPress={() =>
                set_selected_exams(
                  selected_exams.size === exams.length
                    ? new Set()
                    : new Set(exams.map((exam) => exam.id)),
                )
              }
            />
          }
        />
        {exams.length === 0 ? (
          <Text style={styles.hint}>No exams to share yet.</Text>
        ) : (
          exams.map((exam) => (
            <SelectRow
              key={exam.id}
              label={exam.title}
              hint={`${formatDate(exam.date_performed)} · ${plural(
                exam.biomarkers.length,
                "biomarker",
              )}`}
              selected={selected_exams.has(exam.id)}
              onPress={() => toggle(set_selected_exams, exam.id)}
            />
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <SectionHeader
          title="Medications"
          right={
            <Button
              label={selected_medications.size === medications.length && medications.length > 0 ? "Clear" : "Select all"}
              size="sm"
              variant="secondary"
              disabled={medications.length === 0}
              onPress={() =>
                set_selected_medications(
                  selected_medications.size === medications.length
                    ? new Set()
                    : new Set(medications.map((medication) => medication.id)),
                )
              }
            />
          }
        />
        {medications.length === 0 ? (
          <Text style={styles.hint}>No medications to share yet.</Text>
        ) : (
          medications.map((medication) => (
            <SelectRow
              key={medication.id}
              label={medication.name}
              hint={`${medication.dosage} · ${medication.frequency_per_day}x per day · ${formatDate(
                medication.start_date,
              )} ${
                medication.end_date
                  ? `– ${formatDate(medication.end_date)}`
                  : "– ongoing"
              }`}
              selected={selected_medications.has(medication.id)}
              onPress={() => toggle(set_selected_medications, medication.id)}
            />
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Symptoms" />
        {symptom_groups.length === 0 ? (
          <Text style={styles.hint}>No symptoms to share yet.</Text>
        ) : (
          symptom_groups.map((group) => {
            const ids = group.occurrences.map((occurrence) => occurrence.id);
            const all_selected = ids.every((id) =>
              selected_symptoms.has(id),
            );
            return (
              <View key={group.id} style={styles.symptomGroup}>
                <View style={styles.symptomHeader}>
                  <Text style={styles.symptomTitle}>{group.title}</Text>
                  <Button
                    label={all_selected ? "Clear" : "All"}
                    size="sm"
                    variant="ghost"
                    onPress={() => toggle_group(ids)}
                  />
                </View>
                {group.occurrences.map((occurrence) => (
                  <SelectRow
                    key={occurrence.id}
                    label={
                      occurrence.end_date === null
                        ? `${formatDate(occurrence.start_date)} — Ongoing`
                        : occurrence.end_date === occurrence.start_date
                          ? formatDate(occurrence.start_date)
                          : `${formatDate(occurrence.start_date)} – ${formatDate(
                              occurrence.end_date,
                            )}`
                    }
                    hint={occurrence.observation ?? undefined}
                    selected={selected_symptoms.has(occurrence.id)}
                    onPress={() => toggle(set_selected_symptoms, occurrence.id)}
                  />
                ))}
              </View>
            );
          })
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>Code expires after</Text>
        <View style={styles.chips}>
          {EXPIRY_OPTIONS.map((days) => (
            <Chip
              key={days}
              label={plural(days, "day")}
              active={expires_in_days === days}
              onPress={() => set_expires_in_days(days)}
            />
          ))}
        </View>
        <Button
          label="Create one-time code"
          loading={creating}
          disabled={!has_selection}
          onPress={() => void create_share()}
        />
        <Text style={styles.hint}>
          A code can be redeemed once and only allows viewing the selected
          records, including individual symptom occurrences.
        </Text>
      </Card>

      <View style={styles.groupsHeader}>
        <SectionHeader
          title="Previously shared"
          subtitle="Each group is one selection. Sharing it again issues a new code."
        />
      </View>

      {loading_groups ? (
        <Spinner label="Loading share groups" />
      ) : groups.length === 0 ? (
        <EmptyState
          title="Nothing shared yet"
          hint="Select exams, medications or symptoms above to create your first one-time code."
        />
      ) : (
        groups.map((group) => (
          <Card key={group.group_key} style={styles.card}>
            <View style={styles.groupHeader}>
              <View style={styles.groupTitleWrap}>
                {renaming_key === group.group_key ? (
                  <View style={styles.renameRow}>
                    <TextField
                      value={rename_value}
                      onChangeText={set_rename_value}
                      placeholder="Group name"
                      style={styles.flex}
                    />
                    <Button
                      label="Save"
                      size="sm"
                      onPress={() => void save_rename(group)}
                    />
                    <Button
                      label="Cancel"
                      size="sm"
                      variant="ghost"
                      onPress={() => set_renaming_key(null)}
                    />
                  </View>
                ) : (
                  <Text style={styles.groupTitle}>
                    {group.title ?? "Untitled group"}
                  </Text>
                )}
                <Text style={styles.meta}>
                  Shared {plural(group.times_shared, "time")} · last{" "}
                  {formatTimestamp(group.last_shared_at)}
                </Text>
              </View>
              <View style={styles.groupActions}>
                <Button
                  label="Share again"
                  size="sm"
                  variant="secondary"
                  loading={sharing_key === group.group_key}
                  onPress={() => void share_again(group)}
                />
                {user?.capabilities.create_shares && (
                  <Button
                    label="Rename"
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      set_renaming_key(group.group_key);
                      set_rename_value(group.title ?? "");
                    }}
                  />
                )}
              </View>
            </View>

            <View style={styles.badges}>
              {group.exams.map((exam) => (
                <Badge key={`e-${exam.id}`} label={exam.title} tone="brand" />
              ))}
              {group.medications.map((medication) => (
                <Badge
                  key={`m-${medication.id}`}
                  label={`${medication.name} · ${medication.dosage}`}
                  tone="info"
                />
              ))}
              {group.symptoms.map((symptom) => (
                <Badge
                  key={`s-${symptom.id}`}
                  label={`${symptom.title} · ${plural(
                    symptom.occurrences.length,
                    "occurrence",
                  )}`}
                  tone="danger"
                />
              ))}
            </View>

            <View style={styles.codes}>
              {group.codes.map((code) => (
                <View key={code.id} style={styles.codeRow}>
                  <Badge label={code.status} tone={STATUS_TONES[code.status]} />
                  <Text style={styles.codeMeta}>
                    created {formatTimestamp(code.created_at)}
                  </Text>
                  {(code.status === "active" || code.status === "used") && (
                    <Button
                      label={revoking_id === code.id ? "Revoking…" : "Revoke"}
                      size="sm"
                      variant="danger"
                      loading={revoking_id === code.id}
                      disabled={!user?.capabilities.revoke_shares}
                      onPress={() => revoke(code.id)}
                    />
                  )}
                </View>
              ))}
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  wrap: { gap: 12 },
  intro: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.md,
    padding: 9,
  },
  created: {
    gap: 6,
    borderColor: colors.brand300,
    backgroundColor: colors.brand50,
  },
  createdLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.brand700,
  },
  code: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.text,
  },
  createdHint: { fontSize: 11, color: colors.textMuted },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
  card: { gap: 8 },
  flex: { flex: 1 },
  hint: { fontSize: 12, color: colors.textSubtle, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  symptomGroup: { gap: 2, marginBottom: 8 },
  symptomHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  symptomTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  groupsHeader: { marginTop: 8 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  groupTitleWrap: { flex: 1, gap: 2 },
  renameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  groupTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  meta: { fontSize: 11, color: colors.textMuted },
  groupActions: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  codes: { gap: 4, marginTop: 4 },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  codeMeta: { fontSize: 10, color: colors.textSubtle, flex: 1 },
});
