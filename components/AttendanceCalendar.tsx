/**
 * Monthly calendar. SHORT press a day = toggle a gym day (with pop + success haptic
 * on a completion). LONG press = open the action sheet (weight check-in / rest day).
 * Gym days are amber-filled; rest days are outlined; a small amber dot marks a day
 * that has a weight check-in. Future days are not interactive.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fonts } from '@/theme/theme';
import { buildMonthGrid, MONTH_NAMES, WEEKDAYS, toISODate, todayISO } from '@/lib/attendance';
import { haptics } from '@/lib/haptics';
import { useSettings } from '@/settings/SettingsProvider';

type Props = {
  monthDate: Date;
  attended: Set<string>;
  restDays: Set<string>;
  weights: Set<string>;
  onToggle: (dateISO: string) => void;
  onLongPress: (dateISO: string) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function AttendanceCalendar({ monthDate, attended, restDays, weights, onToggle, onLongPress, onPrev, onNext }: Props) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const cells = buildMonthGrid(year, month);
  const today = todayISO();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} hitSlop={12} style={styles.nav}>
          <Ionicons name="chevron-back" size={20} color={colors.text2} />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month].toUpperCase()} {year}</Text>
        <Pressable onPress={onNext} hitSlop={12} style={styles.nav}>
          <Ionicons name="chevron-forward" size={20} color={colors.text2} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`pad-${i}`} style={styles.cell} />;
          const iso = toISODate(new Date(year, month, day));
          const isFuture = iso > today;
          return (
            <DayCell
              key={iso}
              day={day}
              attended={attended.has(iso)}
              rest={restDays.has(iso)}
              hasWeight={weights.has(iso)}
              isToday={iso === today}
              isFuture={isFuture}
              onPress={() => !isFuture && onToggle(iso)}
              onLongPress={() => !isFuture && onLongPress(iso)}
            />
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendDot kind="gym" label="Gym" />
        <LegendDot kind="rest" label="Rest" />
        <LegendDot kind="weight" label="Weigh-in" />
      </View>
    </View>
  );
}

type DayProps = {
  day: number;
  attended: boolean;
  rest: boolean;
  hasWeight: boolean;
  isToday: boolean;
  isFuture: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

function DayCell({ day, attended, rest, hasWeight, isToday, isFuture, onPress, onLongPress }: DayProps) {
  const { animationsEnabled } = useSettings();
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(attended);

  useEffect(() => {
    if (attended && !prev.current && animationsEnabled) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      ]).start();
    }
    prev.current = attended;
  }, [attended, scale, animationsEnabled]);

  return (
    <Pressable style={styles.cell} onPress={onPress} onLongPress={() => { haptics.longPress(); onLongPress(); }} delayLongPress={280} disabled={isFuture}>
      <Animated.View
        style={[
          styles.dayInner,
          attended && styles.dayAttended,
          rest && styles.dayRest,
          isToday && !attended && !rest && styles.dayToday,
          { transform: [{ scale }] },
        ]}
      >
        <Text
          style={[
            styles.dayText,
            attended && styles.dayTextAttended,
            rest && styles.dayTextRest,
            isFuture && styles.dayTextFuture,
          ]}
        >
          {day}
        </Text>
      </Animated.View>
      {hasWeight && <View style={styles.weightDot} />}
    </Pressable>
  );
}

function LegendDot({ kind, label }: { kind: 'gym' | 'rest' | 'weight'; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, kind === 'gym' && styles.legGym, kind === 'rest' && styles.legRest, kind === 'weight' && styles.legWeight]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  nav: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  monthLabel: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: 0.5 },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekday: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 11, color: colors.text3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 3 },
  dayInner: { width: '100%', height: '100%', borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dayAttended: { backgroundColor: colors.amber },
  dayRest: { backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.text3 },
  dayToday: { borderWidth: 1.5, borderColor: colors.amber },
  dayText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  dayTextAttended: { color: colors.onAmber, fontFamily: fonts.bold },
  dayTextRest: { color: colors.text2 },
  dayTextFuture: { color: colors.text3, opacity: 0.5 },
  weightDot: { position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.amber },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.hairline },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 6 },
  legGym: { backgroundColor: colors.amber },
  legRest: { backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.text3 },
  legWeight: { backgroundColor: colors.amber, width: 6, height: 6, borderRadius: 3 },
  legendText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text2 },
});
