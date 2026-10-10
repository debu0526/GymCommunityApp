/** Read-only detail view of a logged workout. Opened from Recent, Past Workouts, or calendar long-press. */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getWorkoutDetail, workoutTypeLabel, type WorkoutDetail } from '@/db/workouts';
import { prettyDate } from '@/lib/attendance';
import { formatDuration } from '@/lib/format';
import { colors, spacing, radius, fonts } from '@/theme/theme';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (id) getWorkoutDetail(id).then((d) => { setDetail(d); setLoaded(true); });
  }, [id]);

  const w = detail?.workout;
  const volume = detail
    ? detail.exercises.reduce((sum, ex) => sum + ex.sets.reduce((a, s) => a + (s.reps ?? 0) * (s.weight ?? 0), 0), 0)
    : 0;
  const setCount = detail ? detail.exercises.reduce((a, ex) => a + ex.sets.length, 0) : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>WORKOUT</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!loaded ? null : !w ? (
          <Text style={styles.empty}>Workout not found.</Text>
        ) : (
          <>
            <Text style={styles.title}>{workoutTypeLabel(w.type, w.customTypeName).toUpperCase()}</Text>
            <Text style={styles.meta}>
              {prettyDate(w.date)} · {formatDuration(w.durationSec)}
              {setCount > 0 ? ` · ${setCount} sets` : ''}
              {volume > 0 ? ` · ${Math.round(volume)} kg vol` : ''}
            </Text>

            {w.improve ? (
              <View style={styles.noteCard}>
                <Text style={styles.noteLabel}>IMPROVE NEXT TIME</Text>
                {w.improve.moreWeight.length > 0 && <Text style={styles.noteText}><Text style={styles.improveTag}>More weight:</Text> {w.improve.moreWeight.join(', ')}</Text>}
                {w.improve.moreReps.length > 0 && <Text style={styles.noteText}><Text style={styles.improveTag}>More reps:</Text> {w.improve.moreReps.join(', ')}</Text>}
                {w.improve.betterForm.length > 0 && <Text style={styles.noteText}><Text style={styles.improveTag}>Better form:</Text> {w.improve.betterForm.join(', ')}</Text>}
              </View>
            ) : null}

            {w.notes ? (
              <View style={styles.noteCard}>
                <Text style={styles.noteLabel}>NOTE</Text>
                <Text style={styles.noteText}>{w.notes}</Text>
              </View>
            ) : null}

            {detail!.exercises.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptySub}>No exercises logged{w.type === 'cardio' ? ' — cardio session.' : '.'}</Text>
              </View>
            ) : (
              detail!.exercises.map((ex) => (
                <View key={ex.id} style={styles.card}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  {ex.sets.map((s) => (
                    <View key={s.id} style={styles.setRow}>
                      <View style={styles.setBadge}>
                        <Text style={styles.setBadgeText}>{s.setNumber}</Text>
                      </View>
                      <Text style={styles.setText}>
                        {s.reps ?? '–'} reps × {s.weight ?? '–'} kg
                      </Text>
                      {s.completed ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
                    </View>
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { width: 24 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text3, letterSpacing: 1.5 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, letterSpacing: 0.5 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: 4, marginBottom: spacing.lg },
  noteCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.md },
  noteLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 1, marginBottom: 4 },
  noteText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 20 },
  improveTag: { fontFamily: fonts.semibold, color: colors.amber },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.md },
  exName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  setBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  setBadgeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text2 },
  setText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, flex: 1 },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.text2, textAlign: 'center', marginTop: spacing.xxxl },
  emptySub: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
});
