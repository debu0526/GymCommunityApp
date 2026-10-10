/** Per-exercise log: every finished-session's sets for one exercise, newest first. */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getExerciseLog, workoutTypeLabel, type ExerciseLogSession } from '@/db/workouts';
import { prettyDate } from '@/lib/attendance';
import { colors, spacing, radius, fonts } from '@/theme/theme';

export default function ExerciseLogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ key: string; name?: string; id?: string }>();
  const name = (params.name ?? decodeURIComponent(params.key ?? '')) || 'Exercise';
  const exerciseId = params.id && params.id.length > 0 ? params.id : null;

  const [log, setLog] = useState<ExerciseLogSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    getExerciseLog(exerciseId, name).then((l) => { setLog(l); setLoaded(true); });
  }, [exerciseId, name]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalSets = log.reduce((n, s) => n + s.sets.length, 0);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>EXERCISE LOG</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.exName}>{name}</Text>
        {loaded && (
          <Text style={styles.subtitle}>
            {log.length} {log.length === 1 ? 'session' : 'sessions'} · {totalSets} {totalSets === 1 ? 'set' : 'sets'} logged
          </Text>
        )}

        {loaded && log.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No logged sessions for this exercise yet.</Text>
          </View>
        ) : (
          log.map((s) => (
            <Pressable
              key={s.workoutId}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push(`/workout/${s.workoutId}`)}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.date}>{prettyDate(s.date)}</Text>
                <Text style={styles.type}>{workoutTypeLabel(s.type, s.customTypeName)}</Text>
              </View>
              {s.sets.length === 0 ? (
                <Text style={styles.noSets}>No sets recorded</Text>
              ) : (
                <View style={styles.sets}>
                  {s.sets.map((set, i) => (
                    <View key={i} style={styles.setRow}>
                      <Text style={styles.setNum}>{i + 1}</Text>
                      <Text style={styles.setVal}>
                        {set.weight != null ? `${set.weight} kg` : '—'}
                        <Text style={styles.setX}>  ×  </Text>
                        {set.reps != null ? `${set.reps}` : '—'}
                        <Text style={styles.setUnit}> reps</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              )}
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
  headerTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text3, letterSpacing: 1.5 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  exName: { fontFamily: fonts.display, fontSize: 30, color: colors.text, letterSpacing: 0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, marginTop: 2, marginBottom: spacing.lg },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  date: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  type: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3 },
  noSets: { fontFamily: fonts.regular, fontSize: 13, color: colors.text3 },
  sets: { gap: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  setNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface2, color: colors.text3, textAlign: 'center', lineHeight: 22, fontFamily: fonts.bold, fontSize: 12, overflow: 'hidden' },
  setVal: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  setX: { fontFamily: fonts.regular, color: colors.text3 },
  setUnit: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2 },
});
