/** Progression graph for a single body measurement (weight in kg; lengths in cm/in). */
import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllMeasurements, type Measurement, type MeasurementFields } from '@/db/database';
import { useSettings } from '@/settings/SettingsProvider';
import { MeasureChart, type MeasurePoint } from '@/components/MeasureChart';
import { ALL_DEFS, CM_PER_IN } from '@/lib/measures';
import { colors, spacing, radius, fonts } from '@/theme/theme';

export default function BodyProgressionDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { measureUnit, setMeasureUnit } = useSettings();
  const params = useLocalSearchParams<{ field: string }>();
  const def = ALL_DEFS.find((d) => String(d.key) === params.field) ?? ALL_DEFS[0];
  const isLen = def.kind === 'len';
  const unit = isLen ? measureUnit : 'kg';

  const [rows, setRows] = useState<Measurement[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    getAllMeasurements().then((r) => { setRows(r); setLoaded(true); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const entries: MeasurePoint[] = useMemo(() => {
    const conv = (v: number) => (isLen && measureUnit === 'in' ? v / CM_PER_IN : v);
    return rows
      .map((r) => ({ date: r.date, raw: r[def.key as keyof MeasurementFields] }))
      .filter((e): e is { date: string; raw: number } => e.raw != null)
      .map((e) => ({ date: e.date, value: Math.round(conv(e.raw) * 10) / 10 }));
  }, [rows, def, isLen, measureUnit]);

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
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{def.label}</Text>
            <Text style={styles.subtitle}>Progression over time</Text>
          </View>
          {isLen && (
            <View style={styles.unitToggle}>
              <Pressable onPress={() => setMeasureUnit('cm')} style={[styles.unitChip, measureUnit === 'cm' && styles.unitChipActive]}><Text style={[styles.unitText, measureUnit === 'cm' && styles.unitTextActive]}>cm</Text></Pressable>
              <Pressable onPress={() => setMeasureUnit('in')} style={[styles.unitChip, measureUnit === 'in' && styles.unitChipActive]}><Text style={[styles.unitText, measureUnit === 'in' && styles.unitTextActive]}>in</Text></Pressable>
            </View>
          )}
        </View>
        {loaded && <MeasureChart entries={entries} unit={unit} />}
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
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  name: { fontFamily: fonts.display, fontSize: 30, color: colors.text, letterSpacing: 0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, marginTop: 2 },
  unitToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, padding: 3, gap: 2 },
  unitChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  unitChipActive: { backgroundColor: colors.amber },
  unitText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text2 },
  unitTextActive: { color: colors.onAmber },
});
