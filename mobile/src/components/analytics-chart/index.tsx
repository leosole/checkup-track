import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, {
  Circle,
  Line,
  Path,
  Text as SvgText,
} from "react-native-svg";
import { api } from "../../api-client";
import { formatDate } from "../../date-utils";
import {
  radius,
  seriesColor,
  useAppStyles,
  useTheme,
  type Palette,
} from "../../theme";
import type { TimeSeries } from "../../types";
import { Badge, Card, EmptyState, Spinner } from "../ui/card";
import { Button } from "../ui/button";
import { Chip, TextField } from "../ui/input";
import { CHART_HEIGHT, CHART_PAD, buildGeometry } from "./geometry";
import type { ChartExam, DisplaySeries, SeriesLoader, Tooltip } from "./types";

const MERGED_SPECS_KEY = "vitals.trends.merged";
const GUEST_MERGED_SPECS_KEY = "vitals.guest.trends.merged";

function marker_key(spec: string): string {
  return spec.trim().toLowerCase();
}

function unique_specs(specs: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const spec of specs) {
    const key = marker_key(spec);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(spec.trim());
  }
  return unique;
}

function read_groups(raw: string | null): string[][] {
  try {
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (group): group is string[] =>
              Array.isArray(group) &&
              group.every((name) => typeof name === "string"),
          )
          .map(unique_specs)
          .filter((group) => group.length > 1)
      : [];
  } catch {
    return [];
  }
}

export function AnalyticsChart({
  exams,
  exams_loading = false,
  selected,
  on_toggle_spec,
  load_series = api.timeSeries,
  merge_storage_key = MERGED_SPECS_KEY,
}: {
  exams: ChartExam[];
  exams_loading?: boolean;
  selected: string[];
  on_toggle_spec: (spec: string) => void;
  load_series?: SeriesLoader;
  merge_storage_key?: string;
}) {
  const { colors } = useTheme();
  const styles = useAppStyles(make_styles);

  const [series, set_series] = useState<TimeSeries[]>([]);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [filter, set_filter] = useState("");
  const [width, set_width] = useState(0);
  const [tooltip, set_tooltip] = useState<Tooltip | null>(null);

  const [merge_groups, set_merge_groups] = useState<string[][]>([]);
  const [merge_loaded, set_merge_loaded] = useState(false);
  const [merge_selection, set_merge_selection] = useState<string[]>([]);

  const specs = useMemo(() => {
    const names = unique_specs(
      exams.flatMap((exam) => exam.biomarkers.map((b) => b.biomarker_name)),
    );
    return names.sort((a, b) => a.localeCompare(b));
  }, [exams]);

  const units_by_spec = useMemo(() => {
    const units = new Map<string, Set<string>>();
    for (const exam of exams) {
      for (const biomarker of exam.biomarkers) {
        const key = marker_key(biomarker.biomarker_name);
        const values = units.get(key) ?? new Set<string>();
        values.add(biomarker.unit.trim());
        units.set(key, values);
      }
    }
    return units;
  }, [exams]);

  const unit_of = (spec: string): string => {
    const values = units_by_spec.get(marker_key(spec));
    if (!values || values.size === 0) return "";
    return values.size > 1 ? "Mixed units" : [...values][0];
  };

  const exam_dates = useMemo(
    () =>
      [...new Set(exams.map((exam) => exam.date_performed))]
        .filter(Boolean)
        .sort(),
    [exams],
  );
  const start_date = exam_dates[0] ?? "";
  const end_date = exam_dates[exam_dates.length - 1] ?? "";

  useEffect(() => {
    AsyncStorage.getItem(merge_storage_key)
      .then((raw) => set_merge_groups(read_groups(raw)))
      .catch(() => undefined)
      .finally(() => set_merge_loaded(true));
  }, [merge_storage_key]);

  // Only groups with at least two still-selected markers stay merged.
  const active_merge_groups = useMemo(() => {
    const selected_by_key = new Map(
      selected.map((spec) => [marker_key(spec), spec]),
    );
    return merge_groups
      .map((group) =>
        unique_specs(
          group
            .map((name) => selected_by_key.get(marker_key(name)))
            .filter((name): name is string => Boolean(name)),
        ),
      )
      .filter((group) => group.length > 1);
  }, [merge_groups, selected]);

  useEffect(() => {
    if (!merge_loaded) return;
    const active_json = JSON.stringify(active_merge_groups);
    set_merge_groups((previous) => {
      if (JSON.stringify(previous) === active_json) return previous;
      AsyncStorage.setItem(merge_storage_key, active_json).catch(
        () => undefined,
      );
      return active_merge_groups;
    });
  }, [active_merge_groups, merge_loaded, merge_storage_key]);

  useEffect(() => {
    const selected_keys = new Set(selected.map(marker_key));
    set_merge_selection((previous) =>
      previous.filter((name) => selected_keys.has(marker_key(name))),
    );
  }, [selected]);

  const selected_merge_specs = selected.filter((spec) =>
    merge_selection.some(
      (name) => marker_key(name) === marker_key(spec),
    ),
  );
  const merge_members_map = new Map(
    selected_merge_specs.map((spec) => [marker_key(spec), spec]),
  );
  for (const group of active_merge_groups) {
    if (group.some((name) => merge_members_map.has(marker_key(name)))) {
      for (const name of group) {
        merge_members_map.set(marker_key(name), name);
      }
    }
  }
  const merge_members = [...merge_members_map.values()];

  let merge_disabled_reason: string | null = null;
  if (selected_merge_specs.length < 2) {
    merge_disabled_reason = "Select at least two markers to merge.";
  } else {
    const marker_units = merge_members.map((spec) =>
      units_by_spec.get(marker_key(spec)),
    );
    if (marker_units.some((units) => !units || units.size !== 1)) {
      merge_disabled_reason =
        "Each marker must have results with one consistent unit before merging.";
    } else {
      const units = new Set(
        marker_units.map((values) =>
          (Array.from(values ?? [""])[0] ?? "").trim().toLowerCase(),
        ),
      );
      if (units.size > 1) {
        merge_disabled_reason = "Markers must use the same unit to be merged.";
      }
    }
  }

  function toggle_merge_selection(spec: string) {
    set_merge_selection((previous) =>
      previous.some((name) => marker_key(name) === marker_key(spec))
        ? previous.filter(
            (name) => marker_key(name) !== marker_key(spec),
          )
        : [...previous, spec],
    );
  }

  function merge_selected() {
    if (merge_disabled_reason) return;
    set_merge_groups((previous) => [
      ...previous.filter(
        (group) =>
          !group.some((name) =>
            merge_members.some(
              (member) => marker_key(member) === marker_key(name),
            ),
          ),
      ),
      merge_members,
    ]);
    set_merge_selection([]);
  }

  useEffect(() => {
    if (selected.length === 0) {
      set_series([]);
      set_loading(false);
      return;
    }
    if (exams_loading) {
      set_loading(true);
      return;
    }
    if (exams.length === 0) {
      set_series([]);
      set_loading(false);
      return;
    }
    let cancelled = false;
    set_loading(true);
    set_error(null);
    load_series({ start_date, end_date, specs: selected })
      .then((res) => {
        if (!cancelled) set_series(res.series);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          set_error(
            err instanceof Error ? err.message : "Could not load the chart.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) set_loading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, exams_loading, exams, load_series]);

  const display_series = useMemo<DisplaySeries[]>(() => {
    const by_key = new Map(
      series.map((item) => [marker_key(item.spec), item] as const),
    );
    const group_by_key = new Map<string, string[]>();
    for (const group of active_merge_groups) {
      for (const name of group) group_by_key.set(marker_key(name), group);
    }

    const displayed: DisplaySeries[] = [];
    const consumed = new Set<string>();
    selected.forEach((spec, index) => {
      const key = marker_key(spec);
      if (consumed.has(key)) return;
      const group = group_by_key.get(key);
      if (group) {
        const members = group
          .map((name) => by_key.get(marker_key(name)))
          .filter((item): item is TimeSeries => Boolean(item));
        const points = members
          .flatMap((item) => item.points)
          .sort((left, right) => left.date.localeCompare(right.date));
        displayed.push({
          spec: group.join(" + "),
          unit: members[0]?.unit ?? "",
          points,
          color_index: Math.max(
            0,
            selected.findIndex(
              (name) => marker_key(name) === marker_key(group[0]),
            ),
          ),
        });
        group.forEach((name) => consumed.add(marker_key(name)));
      } else {
        const item = by_key.get(key);
        if (item) displayed.push({ ...item, color_index: index });
        consumed.add(key);
      }
    });
    return displayed;
  }, [series, selected, active_merge_groups]);

  const visible = display_series.filter((item) => item.points.length > 0);
  const geometry = buildGeometry(visible, width);

  const filter_lower = filter.trim().toLowerCase();
  const filtered_specs = filter_lower
    ? specs.filter((spec) => spec.toLowerCase().includes(filter_lower))
    : [];

  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.title}>Biomarker trends</Text>
          <Text style={styles.subtitle}>
            Plot multiple lab values against each other over time
          </Text>
        </View>
        <Badge label={`${visible.length} series`} tone="brand" />
      </View>

      {selected.length > 0 && (
        <View style={styles.selectedWrap}>
          <Text style={styles.sectionLabel}>Selected markers</Text>
          <View style={styles.chips}>
            {selected.map((spec, index) => {
              const merge_selected_spec = merge_selection.some(
                (name) => marker_key(name) === marker_key(spec),
              );
              return (
                <View key={spec} style={styles.selectedChip}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: merge_selected_spec }}
                    accessibilityLabel={`Select ${spec} to merge`}
                    onPress={() => toggle_merge_selection(spec)}
                    style={[
                      styles.mergeBox,
                      merge_selected_spec && styles.mergeBoxOn,
                    ]}
                  >
                    {merge_selected_spec ? (
                      <Text style={styles.mergeCheck}>✓</Text>
                    ) : null}
                  </Pressable>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: seriesColor(index) },
                    ]}
                  />
                  <Text style={styles.selectedChipText} numberOfLines={1}>
                    {spec}
                    {unit_of(spec) ? ` (${unit_of(spec)})` : ""}
                  </Text>
                  <Pressable
                    onPress={() => on_toggle_spec(spec)}
                    accessibilityLabel={`Remove ${spec} from trends`}
                    hitSlop={6}
                  >
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          {selected.length > 1 && (
            <Text style={styles.hint}>
              Tick the box on two or more markers, then merge their lines.
            </Text>
          )}
          {merge_selection.length > 0 && (
            <View style={styles.mergeRow}>
              <Button
                label={
                  merge_members.length >= 2
                    ? `Merge ${merge_members.length} markers`
                    : "Select another marker"
                }
                size="sm"
                variant="secondary"
                disabled={merge_disabled_reason !== null}
                onPress={merge_selected}
              />
              {merge_disabled_reason ? (
                <Text style={styles.hint}>{merge_disabled_reason}</Text>
              ) : null}
            </View>
          )}
        </View>
      )}

      {specs.length > 0 ? (
        <View style={styles.filterWrap}>
          <TextField
            value={filter}
            onChangeText={set_filter}
            placeholder="Filter biomarkers…"
            autoCapitalize="none"
          />
          {filter_lower ? (
            <View style={styles.chips}>
              {filtered_specs.length === 0 && (
                <Text style={styles.hint}>
                  No biomarker matches “{filter.trim()}”.
                </Text>
              )}
              {filtered_specs.slice(0, 40).map((spec) => (
                <Chip
                  key={spec}
                  label={spec}
                  active={selected.some(
                    (name) => marker_key(name) === marker_key(spec),
                  )}
                  onPress={() => on_toggle_spec(spec)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>
              Search for a biomarker above and tap the markers you want to plot.
            </Text>
          )}
        </View>
      ) : (
        <Text style={styles.hint}>
          Upload a lab report PDF to populate biomarkers.
        </Text>
      )}

      <View
        style={styles.chartWrap}
        onLayout={(event) => set_width(event.nativeEvent.layout.width)}
      >
        {loading && <Spinner label="Loading trends" />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && selected.length === 0 && (
          <EmptyState
            title="No series selected"
            hint="Pick biomarkers above to plot their values over time."
          />
        )}
        {!loading && !error && selected.length > 0 && visible.length === 0 && (
          <EmptyState
            title="No results for selected markers"
            hint="The selected markers have no results in the current exam date range."
          />
        )}
        {visible.length > 0 && width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            {geometry.y_ticks.map((tick) => (
              <Line
                key={`y-${tick}`}
                x1={CHART_PAD.left}
                x2={width - CHART_PAD.right}
                y1={geometry.yOf(tick)}
                y2={geometry.yOf(tick)}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {geometry.y_ticks.map((tick) => (
              <SvgText
                key={`yl-${tick}`}
                x={CHART_PAD.left - 6}
                y={geometry.yOf(tick) + 3}
                textAnchor="end"
                fontSize={9}
                fill={colors.textSubtle}
              >
                {tick}
              </SvgText>
            ))}
            {geometry.date_ticks.map((tick) => (
              <SvgText
                key={`x-${tick.date}`}
                x={tick.x}
                y={CHART_HEIGHT - CHART_PAD.bottom + 16}
                textAnchor="middle"
                fontSize={9}
                fill={colors.textSubtle}
              >
                {tick.label}
              </SvgText>
            ))}
            <Line
              x1={CHART_PAD.left}
              x2={CHART_PAD.left}
              y1={CHART_PAD.top}
              y2={CHART_HEIGHT - CHART_PAD.bottom}
              stroke={colors.borderStrong}
              strokeWidth={1}
            />
            <Line
              x1={CHART_PAD.left}
              x2={width - CHART_PAD.right}
              y1={CHART_HEIGHT - CHART_PAD.bottom}
              y2={CHART_HEIGHT - CHART_PAD.bottom}
              stroke={colors.borderStrong}
              strokeWidth={1}
            />
            {geometry.paths.map((path) => (
              <Path
                key={path.spec}
                d={path.d}
                fill="none"
                stroke={path.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {geometry.paths.map((path) =>
              path.points.map((point) => (
                <Circle
                  key={`${path.spec}-${point.date}-${point.value}`}
                  cx={geometry.xOf(point.date)}
                  cy={geometry.yOf(point.value)}
                  r={point.is_abnormal ? 4.5 : 3}
                  fill={point.is_abnormal ? colors.surface : path.color}
                  stroke={point.is_abnormal ? colors.danger : path.color}
                  strokeWidth={point.is_abnormal ? 2 : 1}
                  onPress={() =>
                    set_tooltip({
                      series: path.spec,
                      unit: path.unit,
                      value: point.value,
                      date: point.date,
                      exam_title: point.exam_title,
                      is_abnormal: point.is_abnormal,
                      reference_range: point.reference_range,
                      color: path.color,
                    })
                  }
                />
              )),
            )}
          </Svg>
        )}
      </View>

      {tooltip && (
        <View style={styles.tooltip}>
          <View style={styles.tooltipHeader}>
            <View style={[styles.dot, { backgroundColor: tooltip.color }]} />
            <Text style={styles.tooltipSpec}>{tooltip.series}</Text>
            {tooltip.is_abnormal && <Badge label="ABNORMAL" tone="danger" />}
            <Pressable
              accessibilityLabel="Close trend details"
              onPress={() => set_tooltip(null)}
              style={styles.tooltipClose}
            >
              <Text style={styles.tooltipCloseText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.tooltipValue}>
            {tooltip.value}{" "}
            <Text style={styles.tooltipUnit}>{tooltip.unit}</Text>
          </Text>
          <Text style={styles.tooltipMeta}>{formatDate(tooltip.date)}</Text>
          <Text style={styles.tooltipMeta}>
            Normal range:{" "}
            {tooltip.reference_range
              ? `${tooltip.reference_range}${
                  tooltip.unit ? ` ${tooltip.unit}` : ""
                }`
              : "Not reported"}
          </Text>
          <Text style={styles.tooltipMeta} numberOfLines={1}>
            {tooltip.exam_title}
          </Text>
        </View>
      )}

      <View style={styles.legend}>
        {geometry.paths.map((path) => (
          <View key={path.spec} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: path.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {path.spec}
              {path.unit ? ` (${path.unit})` : ""}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const make_styles = (colors: Palette) =>
  StyleSheet.create({
    card: { gap: 12 },
    titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    titleText: { flex: 1, gap: 2 },
    title: { fontSize: 16, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 12, color: colors.textMuted },
    sectionLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
    selectedWrap: { gap: 6 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    selectedChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: radius.full,
      backgroundColor: colors.brand50,
      borderWidth: 1,
      borderColor: colors.brand200,
      paddingHorizontal: 8,
      paddingVertical: 4,
      maxWidth: "100%",
    },
    mergeBox: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.brand300,
      alignItems: "center",
      justifyContent: "center",
    },
    mergeBoxOn: {
      backgroundColor: colors.brand600,
      borderColor: colors.brand600,
    },
    mergeCheck: { color: colors.white, fontSize: 10, fontWeight: "700" },
    selectedChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.brand700,
      maxWidth: 175,
    },
    remove: { fontSize: 10, color: colors.textSubtle },
    dot: { width: 8, height: 8, borderRadius: 4 },
    mergeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    filterWrap: { gap: 8 },
    hint: { fontSize: 12, color: colors.textSubtle },
    chartWrap: { minHeight: 80, justifyContent: "center" },
    error: {
      fontSize: 13,
      color: colors.danger,
      backgroundColor: colors.dangerBg,
      borderRadius: radius.md,
      padding: 8,
    },
    tooltip: {
      borderRadius: radius.lg,
      backgroundColor: colors.tooltipBg,
      padding: 10,
      gap: 2,
    },
    tooltipHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    tooltipSpec: {
      color: colors.tooltipText,
      fontSize: 12,
      fontWeight: "700",
      flexShrink: 1,
    },
    tooltipClose: { marginLeft: "auto", padding: 2 },
    tooltipCloseText: { color: colors.tooltipMuted, fontSize: 12 },
    tooltipValue: {
      color: colors.tooltipText,
      fontSize: 15,
      fontWeight: "700",
    },
    tooltipUnit: {
      color: colors.tooltipMuted,
      fontSize: 12,
      fontWeight: "500",
    },
    tooltipMeta: { color: colors.tooltipMuted, fontSize: 11 },
    legend: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendText: { fontSize: 11, color: colors.textMuted, maxWidth: 170 },
  });

export { GUEST_MERGED_SPECS_KEY };
