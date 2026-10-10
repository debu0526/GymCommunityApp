/** Home: greeting, streak, live workout control (Start → Pause/Resume + Stop), recent workouts. */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { PillButton } from '@/components/PillButton';
import { WorkoutCard } from '@/components/WorkoutCard';
import { SelectionBar } from '@/components/SelectionBar';
import { useSelection } from '@/hooks/useSelection';
import { useWorkoutSession } from '@/session/WorkoutSession';
import { useCountdown } from '@/components/Countdown';
import { getAllAttendance, getAllRestDays, getProfile } from '@/db/database';
import { getRecentWorkouts, createTemplate, type RecentWorkout } from '@/db/workouts';
import { computeStreak } from '@/lib/attendance';
import { formatClock } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { confirmDeleteWorkouts } from '@/lib/confirmDelete';
import { colors, spacing, radius, fonts } from '@/theme/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { isActive, isPaused, elapsed, start, pause, resume, finish } = useWorkoutSession();
  const { runCountdown } = useCountdown();
  const [attended, setAttended] = useState<Set<string>>(new Set());
  const [restDays, setRestDays] = useState<Set<string>>(new Set());
  const [name, setName] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWorkout[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const sel = useSelection();

  const load = useCallback(() => {
    getAllAttendance().then((l) => setAttended(new Set(l)));
    getAllRestDays().then((l) => setRestDays(new Set(l)));
    getProfile().then((p) => setName(p?.name?.trim() || null));
    getRecentWorkouts(3).then(setRecent);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = () => confirmDeleteWorkouts([...sel.ids], () => { sel.clear(); load(); });

  const streak = computeStreak(attended, restDays);

  const onStart = () => {
    // 3-2-1 full-screen countdown, then start the session and open the Log tab.
    runCountdown(async () => {
      await start();
      router.navigate('/log');
    });
  };
  const onPlan = async () => {
    haptics.selection();
    const id = await createTemplate();
    router.push(`/plan/${id}`);
  };
  const onPauseResume = async () => {
    haptics.selection();
    if (isPaused) await resume();
    else await pause();
  };
  const onStop = async () => {
    await finish();
    haptics.success(); // completion milestone
    load();
  };

  return (
    <Screen>
      <View style={styles.header}>
        {name ? (
          <>
            <Text style={styles.title}>HI {name.toUpperCase()},</Text>
            <Text style={styles.greet}>Ready to lift?</Text>
          </>
        ) : (
          <Text style={styles.title}>READY TO LIFT?</Text>
        )}
      </View>

      <View style={styles.hero}>
        <Text style={styles.mini}>Current streak</Text>
        <Text style={styles.heroNum}>
          {streak}
          <Text style={styles.heroUnit}> {streak === 1 ? 'DAY' : 'DAYS'}</Text>
        </Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{streak > 0 ? "🔥 Don't break the chain" : 'Log a workout to start a streak'}</Text>
        </View>
      </View>

      {/* Workout control */}
      {!isActive ? (
        <>
          <PillButton label="Start Workout" block variant="primary" onPress={onStart} />
          <PillButton label="🗒  Plan a Workout" block variant="ghost" onPress={onPlan} style={styles.planBtn} />
        </>
      ) : (
        <View style={styles.timerCard}>
          <Text style={[styles.timerLabel, isPaused && { color: colors.text2 }]}>
            {isPaused ? 'PAUSED' : 'WORKOUT IN PROGRESS'}
          </Text>
          <Text style={styles.timerText} numberOfLines={1} adjustsFontSizeToFit>
            {formatClock(elapsed)}
          </Text>
          <View style={styles.controlRow}>
            <PillButton label={isPaused ? 'Resume' : 'Pause'} variant="soft" onPress={onPauseResume} style={styles.flex} />
            <PillButton label="Stop" variant="primary" onPress={onStop} style={styles.flex} />
          </View>
          <Text style={styles.timerHint}>Add exercises from the Log tab.</Text>
        </View>
      )}

      {/* Recent workouts */}
      {sel.selecting ? (
        <>
          <View style={{ marginTop: spacing.xl }}>
            <SelectionBar count={sel.count} onCancel={sel.clear} onDelete={confirmDelete} />
          </View>
          {recent.map((w) => (
            <WorkoutCard
              key={w.id}
              w={w}
              selecting={sel.selecting}
              selected={sel.isSelected(w.id)}
              onPress={() => sel.toggle(w.id)}
              onLongPress={() => sel.enter(w.id)}
            />
          ))}
        </>
      ) : recent.length === 0 ? (
        <>
          <Text style={styles.sectionLabel}>RECENT WORKOUTS</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No workouts yet.</Text>
            <Text style={styles.emptySub}>Press Start Workout to log your first one.</Text>
          </View>
        </>
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [styles.recentHeader, pressed && styles.pressed]}
            onPress={() => { setRecentOpen((o) => !o); haptics.selection(); }}
          >
            <Text style={styles.sectionLabelInline}>RECENT WORKOUTS</Text>
            <View style={styles.recentCount}><Text style={styles.recentCountText}>{recent.length}</Text></View>
            <View style={{ flex: 1 }} />
            <Ionicons name={recentOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text3} />
          </Pressable>
          {recentOpen && recent.map((w) => (
            <WorkoutCard
              key={w.id}
              w={w}
              selecting={sel.selecting}
              selected={sel.isSelected(w.id)}
              onPress={() => router.push(`/workout/${w.id}`)}
              onLongPress={() => sel.enter(w.id)}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.lg },
  greet: { fontFamily: fonts.regular, fontSize: 15, color: colors.text2, marginTop: 2 },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, letterSpacing: 0.5 },
  planBtn: { marginTop: spacing.sm },
  hero: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.xxl, alignItems: 'center', marginBottom: spacing.lg },
  mini: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase' },
  heroNum: { fontFamily: fonts.display, fontSize: 72, color: colors.amber, lineHeight: 78, marginTop: spacing.md, marginBottom: spacing.sm },
  heroUnit: { fontFamily: fonts.regular, fontSize: 20, color: colors.text2 },
  tag: { marginTop: spacing.sm, backgroundColor: colors.amberDim, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tagText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.amber },

  timerCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.amber, padding: spacing.xl, alignItems: 'center' },
  timerLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.amber, letterSpacing: 1.2, textTransform: 'uppercase' },
  timerText: { fontFamily: fonts.display, fontSize: 60, color: colors.text, lineHeight: 64, marginVertical: spacing.xs },
  controlRow: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch', marginTop: spacing.sm },
  flex: { flex: 1 },
  timerHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: spacing.md },

  sectionLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3, letterSpacing: 1.2, marginTop: spacing.xl, marginBottom: spacing.md },
  recentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionLabelInline: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3, letterSpacing: 1.2 },
  recentCount: { minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: colors.amberDim, alignItems: 'center', justifyContent: 'center' },
  recentCountText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.amber },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.xl, alignItems: 'center', gap: 4 },
  emptyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text2 },
  emptySub: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3 },
  recentCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  recentMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3 },
  recentSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: 4 },
});
