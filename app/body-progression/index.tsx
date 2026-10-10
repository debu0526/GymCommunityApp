/**
 * Body progression — the body measurements you've recorded (weight + waist, chest,
 * arms, calves, thighs). Only measurements that have at least one entry are shown.
 * Tap one to see its progression graph over time.
 */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllMeasurements, type Measurement, type MeasurementFields } from '@/db/database';
import { useSettings } from '@/settings/SettingsProvider';
import { ALL_DEFS, CM_PER_IN, round1, type MeasureDef } from '@/lib/measures';
import { colors, spacing, radius, fonts } from '@/theme/theme';

type Item = { def: MeasureDef; count: number; latest: number | null };

export default function BodyProgressionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { measureUnit } = useSettings();
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    getAllMeasurements().then((rows: Measurement[]) => {
      const out: Item[] = [];
      for (const def of ALL_DEFS) {
        const series = rows.map((r) => r[def.key as keyof MeasurementFields]).filter((v): v is number => v != null);
        if (series.length === 0) continue;
        out.push({ def, count: series.length, latest: series[series.length - 1] });
      }
      setItems(out);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const displayLatest = (it: Item) => {
    if (it.latest == null) return '—';
    if (it.def.kind === 'weight') return `${round1(it.latest)} kg`;
    const v = measureUnit === 'in' ? it.latest / CM_PER_IN : it.latest;
    return `${round1(v)} ${measureUnit}`;
  };

  const open = (it: Item) => {
    router.push({ pathname: '/body-progression/[field]', params: { field: String(it.def.key) } });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>BODY PROGRESSION</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>BODY PROGRESSION</Text>
        <Text style={styles.subtitle}>Your body measurements over time</Text>

        {loaded && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No measurements yet. Add a body check-in from the Log tab.</Text>
          </View>
        ) : (
          items.map((it) => (
            <Pressable key={String(it.def.key)} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => open(it)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{it.def.label}</Text>
                <Text style={styles.meta}>{it.count} {it.count === 1 ? 'entry' : 'entries'}</Text>
              </View>
              <Text style={styles.value}>{displayLatest(it)}</Text>
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
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2 },
  value: { fontFamily: fonts.bold, fontSize: 16, color: colors.amber },
});
