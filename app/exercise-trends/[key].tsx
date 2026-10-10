/** Per-exercise progression chart (max weight / volume over time) for one exercise. */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getExerciseProgression } from '@/db/workouts';
import { getBaseline } from '@/db/database';
import { ProgressionChart } from '@/components/ProgressionChart';
import { colors, spacing, fonts } from '@/theme/theme';

type ProgPoint = { date: string; weight: number; reps: number | null };

export default function ExerciseTrendDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ key: string; name?: string; id?: string }>();
  const name = (params.name ?? decodeURIComponent(params.key ?? '')) || 'Exercise';
  const exerciseId = params.id && params.id.length > 0 ? params.id : null;

  const [prog, setProg] = useState<ProgPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    let active = true;
    Promise.all([getExerciseProgression(exerciseId, name), getBaseline(name)]).then(([p, base]) => {
      if (!active) return;
      const pts: ProgPoint[] = [...p];
      if (base && base.weight != null) pts.unshift({ date: base.date, weight: base.weight, reps: base.reps });
      pts.sort((a, b) => a.date.localeCompare(b.date));
      setProg(pts);
      setLoaded(true);
    });
    return () => { active = false; };
  }, [exerciseId, name]);

  useFocusEffect(useCallback(() => load(), [load]));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>TREND</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.exName}>{name}</Text>
        <Text style={styles.subtitle}>Max weight &amp; volume over time</Text>
        {loaded && <ProgressionChart entries={prog} />}
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
});
