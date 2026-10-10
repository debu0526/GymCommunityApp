/**
 * Log tab: gym attendance calendar (short press = gym day, long press = weight /
 * rest day) + a weekly weight check-in. The weight/BMI trend chart lives in Progress.
 * Fully offline.
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { haptics } from '@/lib/haptics';
import { Screen } from '@/components/Screen';
import { PillButton } from '@/components/PillButton';
import { AttendanceCalendar } from '@/components/AttendanceCalendar';
import { DayActionSheet, DayState } from '@/components/DayActionSheet';
import { MeasurementModal } from '@/components/MeasurementModal';
import { WeightEntryModal } from '@/components/WeightEntryModal';
import {
  getAllAttendance,
  getAllRestDays,
  getAllMeasurements,
  setMeasurement,
  toggleAttendance,
  toggleRestDay,
  type Measurement,
} from '@/db/database';
import { getWorkoutHistory, getTemplates, createTemplate, deleteWorkouts, workoutTypeLabel, type RecentWorkout, type TemplateSummary } from '@/db/workouts';
import { computeStreak, monthPrefix, startOfMonth, todayISO, prettyDate, daysAgoISO } from '@/lib/attendance';
import { useWorkoutSession } from '@/session/WorkoutSession';
import { useCountdown } from '@/components/Countdown';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { colors, spacing, radius, fonts } from '@/theme/theme';

/** Log tab shows the workout builder while a session is active, else the calendar. */
export default function LogScreen() {
  const { isActive } = useWorkoutSession();
  return isActive ? <WorkoutBuilder /> : <IdleLog />;
}

function IdleLog() {
  const router = useRouter();
  const { start, startFrom } = useWorkoutSession();
  const { runCountdown } = useCountdown();
  const [attended, setAttended] = useState<Set<string>>(new Set());
  const [restDays, setRestDays] = useState<Set<string>>(new Set());
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [history, setHistory] = useState<RecentWorkout[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [monthDate, setMonthDate] = useState<Date>(startOfMonth(new Date()));

  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [measureDate, setMeasureDate] = useState<string | null>(null);
  const [weightDate, setWeightDate] = useState<string | null>(null);

  const reload = useCallback(() => {
    getAllAttendance().then((l) => setAttended(new Set(l)));
    getAllRestDays().then((l) => setRestDays(new Set(l)));
    getAllMeasurements().then(setMeasurements);
    getWorkoutHistory(daysAgoISO(60)).then(setHistory);
    getTemplates().then(setTemplates);
  }, []);

  const onPlan = async () => { const id = await createTemplate(); router.push(`/plan/${id}`); };
  const onStartTemplate = (id: string) => { runCountdown(async () => { await startFrom(id); }); };
  const onDeleteTemplate = (id: string) => {
    Alert.alert('Delete plan?', 'This deletes this planned workout.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteWorkouts([id]); reload(); } },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const measuredDates = new Set(measurements.map((m) => m.date));
  const weightFor = (iso: string) => measurements.find((m) => m.date === iso)?.weight ?? null;
  const latestWeightEntry = [...measurements].reverse().find((m) => m.weight != null) ?? null;
  const hasLengths = (m: Measurement) => m.waist != null || m.chest != null || m.armL != null || m.armR != null || m.calves != null || m.thighs != null;
  const latestMeasureEntry = [...measurements].reverse().find(hasLengths) ?? null;

  const onSaveWeight = async (kg: number) => { if (weightDate) { await setMeasurement(weightDate, { weight: kg }); } reload(); setWeightDate(null); };
  const onRemoveWeight = async () => { if (weightDate) { await setMeasurement(weightDate, { weight: null }); } reload(); setWeightDate(null); };

  const onToggleWorkout = useCallback(async (iso: string) => {
    const nowOn = await toggleAttendance(iso);
    setAttended((prev) => {
      const n = new Set(prev);
      nowOn ? n.add(iso) : n.delete(iso);
      return n;
    });
    if (nowOn) setRestDays((prev) => { const n = new Set(prev); n.delete(iso); return n; });
    if (nowOn) haptics.success();
    else haptics.selection();
  }, []);

  const onToggleRest = useCallback(async (iso: string) => {
    const nowOn = await toggleRestDay(iso);
    setRestDays((prev) => {
      const n = new Set(prev);
      nowOn ? n.add(iso) : n.delete(iso);
      return n;
    });
    if (nowOn) setAttended((prev) => { const n = new Set(prev); n.delete(iso); return n; });
    haptics.selection();
  }, []);

  const changeMonth = (delta: number) =>
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  const streak = computeStreak(attended, restDays);
  const monthCount = [...attended].filter((d) => d.startsWith(monthPrefix(monthDate))).length;

  // Most-recent finished workout id per date (history is ordered newest-first).
  const workoutByDate = new Map<string, string>();
  for (const w of history) if (!workoutByDate.has(w.date)) workoutByDate.set(w.date, w.id);

  const onStartLogging = () => {
    // 3-2-1 countdown, then flip the Log tab into the workout builder.
    runCountdown(async () => { await start(); });
  };

  const sheetState: DayState = sheetDate
    ? { isWorkout: attended.has(sheetDate), isRest: restDays.has(sheetDate), weight: weightFor(sheetDate), workoutId: workoutByDate.get(sheetDate) ?? null }
    : { isWorkout: false, isRest: false, weight: null, workoutId: null };

  return (
    <Screen>
      <Text style={styles.title}>LOG</Text>
      <Text style={styles.subtitle}>Log a workout, or track attendance & measurements.</Text>

      <PillButton label="＋ Start Logging Workout" block variant="primary" onPress={onStartLogging} />
      <PillButton label="🗒  Plan a Workout" block variant="ghost" onPress={onPlan} style={styles.planBtn} />

      {templates.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>PLANNED WORKOUTS</Text>
          {templates.map((t) => (
            <View key={t.id} style={styles.planCard}>
              <Pressable style={{ flex: 1 }} onPress={() => router.push(`/plan/${t.id}`)}>
                <Text style={styles.planTitle}>{workoutTypeLabel(t.type, t.customTypeName)}</Text>
                <Text style={styles.planSub}>{t.exerciseCount} exercise{t.exerciseCount === 1 ? '' : 's'} · tap to edit</Text>
              </Pressable>
              <PillButton label="Start" variant="soft" onPress={() => onStartTemplate(t.id)} style={styles.planStart} />
              <Pressable onPress={() => onDeleteTemplate(t.id)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                <Ionicons name="trash-outline" size={18} color={colors.text3} />
              </Pressable>
            </View>
          ))}
        </>
      )}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Current streak</Text>
          <Text style={styles.summaryNum}>{streak}<Text style={styles.summaryUnit}> d</Text></Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This month</Text>
          <Text style={[styles.summaryNum, { color: colors.amber }]}>{monthCount}<Text style={styles.summaryUnit}> days</Text></Text>
        </View>
      </View>

      <Text style={styles.hintNote}>💡 Long press a date to log weight or body measurements, add a rest day, or view that day's workout.</Text>

      <AttendanceCalendar
        monthDate={monthDate}
        attended={attended}
        restDays={restDays}
        weights={measuredDates}
        onToggle={onToggleWorkout}
        onLongPress={(iso) => setSheetDate(iso)}
        onPrev={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
      />

      <Text style={styles.sectionLabel}>BODY WEIGHT</Text>

      {/* Weight check-in (kg) — its own entry */}
      <View style={styles.checkinCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.checkinLabel}>Body weight</Text>
          {latestWeightEntry ? (
            <Text style={styles.checkinValue}>
              {latestWeightEntry.weight} kg <Text style={styles.checkinSub}>· {prettyDate(latestWeightEntry.date)}</Text>
            </Text>
          ) : (
            <Text style={styles.checkinSub}>No weigh-ins yet</Text>
          )}
        </View>
        <PillButton label="Log" variant="soft" onPress={() => setWeightDate(todayISO())} style={styles.checkinBtn} />
      </View>
      <Text style={styles.hint}>See your weight/BMI trend in Progress.</Text>

      <Text style={styles.sectionLabel}>BODY MEASUREMENTS</Text>

      {/* Length measurements (cm/inch) — separate from weight */}
      <View style={styles.checkinCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.checkinLabel}>Measurements</Text>
          {latestMeasureEntry ? (
            <Text style={styles.checkinValueSm}>Last updated <Text style={styles.checkinSub}>{prettyDate(latestMeasureEntry.date)}</Text></Text>
          ) : (
            <Text style={styles.checkinSub}>No measurements yet</Text>
          )}
        </View>
        <PillButton label="Log" variant="soft" onPress={() => setMeasureDate(todayISO())} style={styles.checkinBtn} />
      </View>
      <Text style={styles.hint}>Waist, chest, arms, calves & thighs. See progression in Progress → Body progression.</Text>

      {/* Past workouts — single pill into the hidden list page */}
      <Text style={styles.sectionLabel}>WORKOUT LOG</Text>
      <PillButton label="View Past Logs" block variant="ghost" onPress={() => router.push('/logs')} />

      {/* Long-press action sheet */}
      <DayActionSheet
        visible={sheetDate != null}
        dateISO={sheetDate}
        state={sheetState}
        onWeight={() => { const d = sheetDate; setSheetDate(null); setWeightDate(d); }}
        onMeasure={() => { const d = sheetDate; setSheetDate(null); setMeasureDate(d); }}
        onToggleRest={() => { if (sheetDate) onToggleRest(sheetDate); setSheetDate(null); }}
        onToggleWorkout={() => { if (sheetDate) onToggleWorkout(sheetDate); setSheetDate(null); }}
        onViewWorkout={() => { const wid = sheetDate ? workoutByDate.get(sheetDate) : null; setSheetDate(null); if (wid) router.push(`/workout/${wid}`); }}
        onClose={() => setSheetDate(null)}
      />

      {/* Weight entry modal (kg) */}
      <WeightEntryModal
        visible={weightDate != null}
        dateISO={weightDate}
        initial={weightDate ? weightFor(weightDate) : null}
        onSave={onSaveWeight}
        onRemove={onRemoveWeight}
        onClose={() => setWeightDate(null)}
      />

      {/* Body-measurement entry modal (cm/inch) */}
      <MeasurementModal
        visible={measureDate != null}
        dateISO={measureDate}
        onSaved={reload}
        onClose={() => setMeasureDate(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, letterSpacing: 0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  summaryLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase' },
  summaryNum: { fontFamily: fonts.display, fontSize: 40, color: colors.text, marginTop: spacing.xs },
  summaryUnit: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  hintNote: { fontFamily: fonts.medium, fontSize: 13, color: colors.text2, marginBottom: spacing.md, lineHeight: 18 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3, letterSpacing: 1.2, marginTop: spacing.xl, marginBottom: spacing.md },
  checkinCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  checkinLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase' },
  checkinValue: { fontFamily: fonts.display, fontSize: 28, color: colors.text, marginTop: 2 },
  checkinValueSm: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginTop: 4 },
  checkinSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2 },
  checkinBtn: { paddingVertical: 12, paddingHorizontal: 18 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.text3, marginTop: spacing.md, lineHeight: 19 },
  startBtn: { marginBottom: spacing.lg },
  planBtn: { marginTop: spacing.sm, marginBottom: spacing.lg },
  planCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  planTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  planSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2 },
  planStart: { paddingVertical: 10, paddingHorizontal: 18 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.xl, alignItems: 'center', gap: 4 },
  emptyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text2 },
  emptySub: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3 },
  logCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  logMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3 },
  logSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: 4 },
});
