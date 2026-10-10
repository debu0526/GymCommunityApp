/**
 * Per-exercise trends — the exercises you've lifted with weight, heaviest first.
 * Tap one to see its max-weight / volume progression over time. Replaces the old
 * "Heaviest lifts" list on the Progress tab.
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLoggedExercises, type LoggedExercise } from '@/db/workouts';
import { prettyDate } from '@/lib/attendance';
import { colors, spacing, radius, fonts } from '@/theme/theme';

export default function ExerciseTrendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LoggedExercise[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    getLoggedExercises().then((all) => {
      // Only exercises with a weight trend, heaviest first.
      const withTrend = all.filter((e) => e.weightedSets > 0).sort((a, b) => (b.maxWeight ?? 0) - (a.maxWeight ?? 0));
      setItems(withTrend);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (ex: LoggedExercise) => {
    router.push({
      pathname: '/exercise-trends/[key]',
      params: { key: encodeURIComponent(ex.name), name: ex.name, id: ex.exerciseId ?? '' },
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>PER EXERCISE TRENDS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>PER EXERCISE TRENDS</Text>
        <Text style={styles.subtitle}>Your heaviest lifts</Text>

        {loaded && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Log a weighted set to build your first trend.</Text>
          </View>
        ) : (
          items.map((ex, i) => (
            <Pressable key={ex.key} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => open(ex)}>
              <View style={styles.rank}><Text style={styles.rankText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{ex.name}</Text>
                <Text style={styles.meta}>{ex.sessions} {ex.sessions === 1 ? 'session' : 'sessions'} · last {prettyDate(ex.lastDate)}</Text>
              </View>
              <Text style={styles.weight}>{ex.maxWeight != null ? `${ex.maxWeight} kg` : '—'}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} style={{ marginLeft: spacing.sm }} />
            </Pressable>
          ))
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
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, marginTop: 2, marginBottom: spacing.lg },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  rank: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.amberDim, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  rankText: { fontFamily: fonts.bold, fontSize: 13, color: colors.amber },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2 },
  weight: { fontFamily: fonts.bold, fontSize: 16, color: colors.amber },
});
