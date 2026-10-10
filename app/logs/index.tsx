/**
 * "Past Logs" page. Two swipeable views:
 *  • Workouts — finished sessions (last 60 days), newest first, multi-select delete.
 *  • Exercises — every exercise ever logged; tap one to see its full per-session set history.
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getWorkoutHistory, getLoggedExercises, type RecentWorkout, type LoggedExercise } from '@/db/workouts';
import { daysAgoISO, prettyDate } from '@/lib/attendance';
import { WorkoutCard } from '@/components/WorkoutCard';
import { SelectionBar } from '@/components/SelectionBar';
import { SwipeTabs } from '@/components/SwipeTabs';
import { useSelection } from '@/hooks/useSelection';
import { confirmDeleteWorkouts } from '@/lib/confirmDelete';
import { colors, spacing, radius, fonts } from '@/theme/theme';

const RETENTION_DAYS = 60;
const TABS = [{ key: 'workouts', label: 'Workouts' }, { key: 'exercises', label: 'Exercises' }];

export default function PastLogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<RecentWorkout[]>([]);
  const [exercises, setExercises] = useState<LoggedExercise[]>([]);
  const [loaded, setLoaded] = useState(false);
  const sel = useSelection();

  const load = useCallback(() => {
    Promise.all([getWorkoutHistory(daysAgoISO(RETENTION_DAYS)), getLoggedExercises()]).then(([h, ex]) => {
      setHistory(h);
      setExercises(ex);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = () => confirmDeleteWorkouts([...sel.ids], () => { sel.clear(); load(); });

  const openExercise = (ex: LoggedExercise) => {
    router.push({
      pathname: '/exercise-log/[key]',
      params: { key: encodeURIComponent(ex.name), name: ex.name, id: ex.exerciseId ?? '' },
    });
  };

  const workoutsPage = (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {!sel.selecting && <Text style={styles.subtitle}>Workouts from the last {RETENTION_DAYS} days. Long-press to select & delete.</Text>}
      {loaded && history.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>No workouts in the last {RETENTION_DAYS} days.</Text></View>
      ) : (
        history.map((w) => (
          <WorkoutCard
            key={w.id}
            w={w}
            selecting={sel.selecting}
            selected={sel.isSelected(w.id)}
            onPress={() => (sel.selecting ? sel.toggle(w.id) : router.push(`/workout/${w.id}`))}
            onLongPress={() => sel.enter(w.id)}
          />
        ))
      )}
    </ScrollView>
  );

  const exercisesPage = (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.subtitle}>Every exercise you&apos;ve logged. Tap one to see its full set-by-set history.</Text>
      {loaded && exercises.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>No exercises logged yet.</Text></View>
      ) : (
        exercises.map((ex) => (
          <Pressable key={ex.key} style={({ pressed }) => [styles.exCard, pressed && styles.pressed]} onPress={() => openExercise(ex)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.exName}>{ex.name}</Text>
              <Text style={styles.exSub}>
                {ex.sessions} {ex.sessions === 1 ? 'session' : 'sessions'} · {ex.sets} {ex.sets === 1 ? 'set' : 'sets'} · last {prettyDate(ex.lastDate)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text3} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {sel.selecting ? (
          <View style={{ flex: 1 }}>
            <SelectionBar count={sel.count} onCancel={sel.clear} onDelete={confirmDelete} />
          </View>
        ) : (
          <>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>PAST LOGS</Text>
            <View style={{ width: 24 }} />
          </>
        )}
      </View>

      <View style={styles.tabsWrap}>
        <SwipeTabs
          tabs={TABS}
          index={index}
          onIndexChange={(i) => { sel.clear(); setIndex(i); }}
          swipeEnabled={!sel.selecting}
          showTabBar={!sel.selecting}
          renderPage={(key) => (key === 'workouts' ? workoutsPage : exercisesPage)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { width: 24 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text3, letterSpacing: 1.5 },
  tabsWrap: { flex: 1, paddingHorizontal: spacing.xl },
  content: { paddingBottom: spacing.xxxl },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, marginBottom: spacing.lg },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  exCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  exName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  exSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: 4 },
});
