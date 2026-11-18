import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CalendarData } from "../../types";
import {
  WEEKDAY_LABELS,
  addMonths,
  formatMonthLabel,
  isSameDay,
  monthGrid,
  startOfMonth,
  toIso,
} from "../../date-utils";
import { radius, useAppStyles, type Palette } from "../../theme";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Chip } from "../ui/input";
import {
  DEFAULT_EXAM_COLOR,
  barsForWeek,
  medicationRanges,
  rowBounds,
  symptomRanges,
} from "./bars";
import type { Bar, CalendarItemRef } from "./types";

const LANE_HEIGHT = 18;

export function CalendarGrid({
  data,
  onSelect,
}: {
  data: CalendarData;
  onSelect: (item: CalendarItemRef) => void;
}) {
  const [cursor, set_cursor] = useState(() => startOfMonth(new Date()));
  const [show_exams, set_show_exams] = useState(true);
  const [show_medications, set_show_medications] = useState(true);
  const [show_symptoms, set_show_symptoms] = useState(true);
  const styles = useAppStyles(make_styles);

  const exams_data = show_exams ? data.exams : [];
  const med_items = useMemo(
    () => (show_medications ? medicationRanges(data.medications) : []),
    [show_medications, data.medications],
  );
  const symptom_items = useMemo(
    () => (show_symptoms ? symptomRanges(data.symptoms) : []),
    [show_symptoms, data.symptoms],
  );

  const weeks = useMemo(() => {
    const days = monthGrid(cursor);
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [cursor]);

  const med_bounds = useMemo(
    () => rowBounds(med_items, weeks),
    [med_items, weeks],
  );
  const symptom_bounds = useMemo(
    () => rowBounds(symptom_items, weeks),
    [symptom_items, weeks],
  );

  const exams_by_day = useMemo(() => {
    const map = new Map<string, CalendarData["exams"]>();
    for (const exam of exams_data) {
      const list = map.get(exam.date) ?? [];
      list.push(exam);
      map.set(exam.date, list);
    }
    return map;
  }, [exams_data]);

  const today = new Date();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Health calendar</Text>
          <Text style={styles.subtitle}>
            Exams, medication windows and symptoms in one timeline
          </Text>
        </View>
      </View>

      <View style={styles.filters}>
        <Chip
          label="Exams"
          active={show_exams}
          onPress={() => set_show_exams((value) => !value)}
        />
        <Chip
          label="Medications"
          active={show_medications}
          onPress={() => set_show_medications((value) => !value)}
        />
        <Chip
          label="Symptoms"
          active={show_symptoms}
          onPress={() => set_show_symptoms((value) => !value)}
        />
      </View>

      <View style={styles.monthRow}>
        <Pressable
          accessibilityLabel="Previous month"
          onPress={() => set_cursor((value) => addMonths(value, -1))}
          style={styles.navButton}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(cursor)}</Text>
        <Pressable
          accessibilityLabel="Next month"
          onPress={() => set_cursor((value) => addMonths(value, 1))}
          style={styles.navButton}
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
        <Button
          label="Today"
          size="sm"
          variant="secondary"
          onPress={() => set_cursor(startOfMonth(new Date()))}
        />
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, week_index) => {
          const med_lanes = barsForWeek(
            med_items,
            week,
            week_index,
            med_bounds,
          );
          const symptom_lanes = barsForWeek(
            symptom_items,
            week,
            week_index,
            symptom_bounds,
          );
          const lanes = [...med_lanes, ...symptom_lanes];
          return (
            <View key={week_index} style={styles.week}>
              <View style={styles.daysRow}>
                {week.map((day) => {
                  const iso = toIso(day);
                  const in_month = day.getMonth() === cursor.getMonth();
                  const is_today = isSameDay(day, today);
                  const exams = exams_by_day.get(iso) ?? [];
                  return (
                    <View
                      key={iso}
                      style={[
                        styles.dayCell,
                        in_month ? styles.dayIn : styles.dayOut,
                      ]}
                    >
                      <View
                        style={[
                          styles.dayNumberWrap,
                          is_today && styles.dayNumberToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            is_today
                              ? styles.dayNumberTodayText
                              : in_month
                                ? styles.dayNumberIn
                                : styles.dayNumberOut,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                      </View>
                      {exams.slice(0, 2).map((exam) => (
                        <Pressable
                          key={exam.id}
                          onPress={() =>
                            onSelect({ kind: "exam", id: exam.id })
                          }
                          style={styles.examRow}
                        >
                          <View
                            style={[
                              styles.examDot,
                              { backgroundColor: DEFAULT_EXAM_COLOR },
                            ]}
                          />
                          <Text style={styles.examLabel} numberOfLines={1}>
                            {exam.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
              </View>

              {lanes.length > 0 && (
                <View
                  style={[
                    styles.laneArea,
                    { height: lanes.length * LANE_HEIGHT + 6 },
                  ]}
                >
                  {lanes.map((lane, lane_index) =>
                    lane.map((bar: Bar) => (
                      <Pressable
                        key={bar.id}
                        accessibilityLabel={`${bar.label}, ${bar.kind} details`}
                        onPress={() =>
                          onSelect({ kind: bar.kind, id: bar.item_id })
                        }
                        style={[
                          styles.bar,
                          {
                            backgroundColor: bar.color,
                            top: lane_index * LANE_HEIGHT + 3,
                            left: `${(bar.start_col / 7) * 100}%`,
                            width: `${(bar.span / 7) * 100}%`,
                          },
                        ]}
                      >
                        <Text style={styles.barText} numberOfLines={1}>
                          {bar.starts_before_label
                            ? `‹ ${bar.starts_before_label} `
                            : ""}
                          {bar.label}
                          {bar.ends_after_label
                            ? ` ${bar.ends_after_label} ›`
                            : ""}
                        </Text>
                      </Pressable>
                    )),
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  card: { padding: 0, overflow: "hidden" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerText: { gap: 2 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  navText: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },
  monthLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  weekdayRow: { flexDirection: "row", paddingHorizontal: 6 },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSubtle,
    textTransform: "uppercase",
    paddingBottom: 4,
  },
  grid: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.border,
  },
  week: { borderBottomWidth: 1, borderColor: colors.border },
  daysRow: { flexDirection: "row" },
  dayCell: {
    flex: 1,
    minHeight: 64,
    borderRightWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  dayIn: { backgroundColor: colors.surface },
  dayOut: { backgroundColor: colors.bg },
  dayNumberWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumberToday: { backgroundColor: colors.brand600 },
  dayNumber: { fontSize: 11, fontWeight: "600" },
  dayNumberTodayText: { color: colors.white },
  dayNumberIn: { color: colors.text },
  dayNumberOut: { color: colors.textSubtle },
  examRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 1 },
  examDot: { width: 4, height: 4, borderRadius: 2 },
  examLabel: { fontSize: 8, color: colors.brand700, flex: 1 },
  laneArea: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.bg,
  },
  bar: {
    position: "absolute",
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    paddingHorizontal: 4,
    marginLeft: 1,
    marginRight: 1,
  },
  barText: { color: colors.white, fontSize: 8, fontWeight: "600" },
});
