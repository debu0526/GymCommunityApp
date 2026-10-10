/**
 * Training Volume page — this-month totals + Volume by Muscle (working sets vs goal-based
 * weekly targets, with imbalance warnings). Opened from the "Volume by muscle" pill on Progress.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMonthStats, getMuscleGroupBreakdown, type MonthStats, type MuscleBreakdown } from '@/db/workouts';
import { useSettings } from '@/settings/SettingsProvider';
import { monthPrefix, daysAgoISO, todayISO } from '@/lib/attendance';
import { colors, spacing, radius, fonts } from '@/theme/theme';

type VolTf = 'week' | 'month' | '3m';
const VOL_TABS: { key: VolTf; label: string; days: number; weeks: number }[] = [
  { key: 'week', label: 'This Week', days: 7, weeks: 1 },
  { key: 'month', label: 'This Month', days: 30, weeks: 4.3 },
  { key: '3m', label: '3 Months', days: 90, weeks: 12.9 },
];
const GOAL_TARGET = { strength: { min: 6, max: 12 }, hypertrophy: { min: 10, max: 20 } } as const;

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86400000);
}
function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} t`;
  return `${Math.round(v)} kg`;
}

export default function VolumeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { trainingGoal, setTrainingGoal } = useSettings();
  const [month, setMonth] = useState<MonthStats>({ workouts: 0, volume: 0 });
  const [muscle, setMuscle] = useState<MuscleBreakdown[]>([]);
  const [volTf, setVolTf] = useState<VolTf>('week');

  useFocusEffect(useCallback(() => {
    getMonthStats(monthPrefix(new Date())).then(setMonth).catch(() => {});
  }, []));

  const tf = VOL_TABS.find((t) => t.key === volTf)!;
  const loadVolume = useCallback(() => {
    getMuscleGroupBreakdown(daysAgoISO(tf.days)).then(setMuscle).catch(() => {});
  }, [tf.days]);
  useEffect(() => { loadVolume(); }, [loadVolume]);
  useFocusEffect(useCallback(() => { loadVolume(); }, [loadVolume]));

  const target = GOAL_TARGET[trainingGoal];
  const sMin = Math.max(1, Math.round(target.min * tf.weeks));
  const sMax = Math.max(sMin + 1, Math.round(target.max * tf.weeks));
  const today = todayISO();
  const staleGroups = muscle.filter((m) => m.lastDate == null || daysBetween(m.lastDate, today) >= 7);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>TRAINING VOLUME</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>TRAINING VOLUME</Text>
        <Text style={styles.subtitle}>This month at a glance, and how your weekly sets stack up against your goal.</Text>

        {/* This month */}
        <Text style={styles.sectionLabel}>THIS MONTH</Text>
        <View style={styles.card}>
          <View style={styles.monthRow}>
            <Text style={styles.monthLabel}>Workouts</Text>
            <Text style={styles.monthNum}>{month.workouts}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.monthRow}>
            <Text style={styles.monthLabel}>Total volume</Text>
            <Text style={[styles.monthNum, { color: colors.amber }]}>{formatVolume(month.volume)}</Text>
          </View>
        </View>

        {/* Volume by muscle */}
        <Text style={styles.sectionLabel}>VOLUME BY MUSCLE</Text>
        <View style={styles.volTabs}>
          {VOL_TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setVolTf(t.key)} style={[styles.volTab, volTf === t.key && styles.volTabActive]}>
              <Text style={[styles.volTabText, volTf === t.key && styles.volTabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.goalRow}>
          <Text style={styles.goalLabel}>GOAL</Text>
          <View style={styles.goalToggle}>
            {(['strength', 'hypertrophy'] as const).map((g) => (
              <Pressable key={g} onPress={() => setTrainingGoal(g)} style={[styles.goalChip, trainingGoal === g && styles.goalChipActive]}>
                <Text style={[styles.goalChipText, trainingGoal === g && styles.goalChipTextActive]}>{g === 'strength' ? 'Strength' : 'Hypertrophy'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.targetNote}>Target {sMin}–{sMax} working sets per muscle · {tf.label.toLowerCase()}</Text>

        <View style={styles.card}>
          {muscle.map((m, i) => {
            const status = m.sets === 0 ? 'none' : m.sets < sMin ? 'low' : m.sets <= sMax ? 'ok' : 'high';
            const frac = Math.min(1, m.sets / sMax);
            const minFrac = Math.min(0.98, sMin / sMax);
            const fillColor = status === 'ok' || status === 'high' ? colors.amber : colors.text3;
            const tag = status === 'none' ? 'none' : status === 'low' ? 'below' : status === 'ok' ? 'on target' : 'high';
            return (
              <View key={m.group} style={[styles.mgRow, i > 0 && styles.mgRowBorder]}>
                <View style={styles.mgTop}>
                  <Text style={styles.mgName}>{m.group}</Text>
                  <Text style={styles.mgSets}>{m.sets} <Text style={styles.mgSetsUnit}>sets · {tag}</Text></Text>
                </View>
                <View style={styles.mgTrack}>
                  <View style={[styles.mgFill, { width: `${Math.max(2, frac * 100)}%`, backgroundColor: fillColor }]} />
                  <View style={[styles.mgTarget, { left: `${minFrac * 100}%` }]} />
                </View>
              </View>
            );
          })}
          <Text style={styles.mgLegend}>The light marker is your weekly minimum ({sMin}); the bar fills toward the max ({sMax}).</Text>
        </View>

        {staleGroups.length > 0 && (
          <View style={styles.warnCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.amber} />
            <Text style={styles.warnText}>
              {staleGroups.map((m) => m.lastDate == null ? `${m.group} (never)` : `${m.group} (${daysBetween(m.lastDate, today)}d)`).join(' · ')} — not trained in a while.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { width: 24 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text3, letterSpacing: 1.2 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text, letterSpacing: 0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, marginTop: 2, marginBottom: spacing.md },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3, letterSpacing: 1.2, marginTop: spacing.xl, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  monthLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  monthNum: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: spacing.xs },
  volTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  volTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  volTabActive: { backgroundColor: colors.amberDim },
  volTabText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3 },
  volTabTextActive: { color: colors.amber },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  goalLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8 },
  goalToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, padding: 3, gap: 2 },
  goalChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  goalChipActive: { backgroundColor: colors.amber },
  goalChipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text2 },
  goalChipTextActive: { color: colors.onAmber },
  targetNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.text2, marginBottom: spacing.sm },
  mgRow: { paddingVertical: spacing.sm },
  mgRowBorder: { borderTopWidth: 1, borderTopColor: colors.hairline },
  mgTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  mgName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  mgSets: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  mgSetsUnit: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3 },
  mgTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surface2, overflow: 'hidden', position: 'relative' },
  mgFill: { height: 10, borderRadius: 5, backgroundColor: colors.amber },
  mgTarget: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.text, opacity: 0.75 },
  mgLegend: { fontFamily: fonts.regular, fontSize: 11, color: colors.text3, marginTop: spacing.sm, lineHeight: 16 },
  warnCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.amberDim, borderRadius: radius.card, padding: spacing.md, marginTop: spacing.sm },
  warnText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.text, lineHeight: 17 },
});
