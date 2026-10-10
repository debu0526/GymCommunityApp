/**
 * Body-measurement check-in for a date — the length measurements only
 * (waist/chest/arms/calves/thighs), in cm or inch. Body WEIGHT has its own separate
 * entry (WeightEntryModal) since it's in kg. Each field has a number input plus a haptic
 * ruler slider (the slider is hidden when animations are reduced).
 */
import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PillButton } from '@/components/PillButton';
import { RulerSlider } from '@/components/RulerSlider';
import { useSettings } from '@/settings/SettingsProvider';
import { haptics } from '@/lib/haptics';
import { getMeasurement, setMeasurement, type MeasurementFields } from '@/db/database';
import { LENGTH_DEFS, CM_PER_IN, round1, type MeasureDef } from '@/lib/measures';
import { prettyDate } from '@/lib/attendance';
import { colors, spacing, radius, fonts } from '@/theme/theme';

type Key = keyof MeasurementFields;
const fmt = (n: number) => { const r = round1(n); return (r % 1 === 0 ? String(r) : r.toFixed(1)); };
const clearedLengths: Partial<MeasurementFields> = { waist: null, chest: null, armL: null, armR: null, calves: null, thighs: null };

type Props = { visible: boolean; dateISO: string | null; onClose: () => void; onSaved: () => void };

export function MeasurementModal({ visible, dateISO, onClose, onSaved }: Props) {
  const { animationsEnabled, measureUnit, setMeasureUnit } = useSettings();
  const [vals, setVals] = useState<Partial<Record<Key, number | null>>>({});
  const [hadLengths, setHadLengths] = useState(false);

  useEffect(() => {
    if (!visible || !dateISO) return;
    getMeasurement(dateISO).then((m) => {
      if (m) {
        setVals({ waist: m.waist, chest: m.chest, armL: m.armL, armR: m.armR, calves: m.calves, thighs: m.thighs });
        setHadLengths(LENGTH_DEFS.some((d) => m[d.key as keyof typeof m] != null));
      } else { setVals({}); setHadLengths(false); }
    });
  }, [visible, dateISO]);

  const set = (k: Key, v: number | null) => setVals((prev) => ({ ...prev, [k]: v }));

  const onSave = async () => {
    if (!dateISO) return;
    await setMeasurement(dateISO, vals as Partial<MeasurementFields>);
    haptics.success();
    onSaved();
    onClose();
  };
  // Clears only the length fields — leaves this date's weight untouched.
  const onRemove = async () => {
    if (!dateISO) return;
    await setMeasurement(dateISO, clearedLengths);
    haptics.selection();
    onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>BODY MEASUREMENTS</Text>
              {dateISO && <Text style={styles.date}>{prettyDate(dateISO)}</Text>}
            </View>
            <View style={styles.unitToggle}>
              <Pressable onPress={() => setMeasureUnit('cm')} style={[styles.unitChip, measureUnit === 'cm' && styles.unitChipActive]}><Text style={[styles.unitText, measureUnit === 'cm' && styles.unitTextActive]}>cm</Text></Pressable>
              <Pressable onPress={() => setMeasureUnit('in')} style={[styles.unitChip, measureUnit === 'in' && styles.unitChipActive]}><Text style={[styles.unitText, measureUnit === 'in' && styles.unitTextActive]}>in</Text></Pressable>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={{ marginLeft: spacing.sm }}><Ionicons name="close" size={24} color={colors.text2} /></Pressable>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {LENGTH_DEFS.map((d) => (
              <MeasureRow
                key={d.key}
                def={d}
                unit={measureUnit}
                showSlider={animationsEnabled}
                value={vals[d.key] ?? null}
                onChange={(v) => set(d.key, v)}
              />
            ))}

            <View style={{ height: spacing.md }} />
            <PillButton label="Save" block variant="primary" onPress={onSave} />
            {hadLengths && <PillButton label="Clear these measurements" block variant="ghost" onPress={onRemove} style={{ marginTop: spacing.sm }} />}
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MeasureRow({ def, unit, showSlider, value, onChange }: { def: MeasureDef; unit: 'cm' | 'in'; showSlider: boolean; value: number | null; onChange: (v: number | null) => void }) {
  const isLen = def.kind === 'len';
  const toDisplay = (canon: number) => (isLen && unit === 'in' ? canon / CM_PER_IN : canon);
  const toCanon = (disp: number) => (isLen && unit === 'in' ? disp * CM_PER_IN : disp);
  const suffix = isLen ? unit : 'kg';
  const dMin = Math.floor(toDisplay(def.min));
  const dMax = Math.ceil(toDisplay(def.max));

  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value == null ? '' : fmt(toDisplay(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unit, focused]);

  const onText = (t: string) => {
    setText(t);
    const n = parseFloat(t.replace(',', '.'));
    onChange(t.trim() === '' || isNaN(n) ? null : toCanon(n));
  };
  const sliderVal = value != null ? Math.max(dMin, Math.min(dMax, round1(toDisplay(value)))) : dMin;

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowLabel}>{def.label}</Text>
        <View style={styles.inputWrap}>
          <TextInput style={styles.input} value={text} onChangeText={onText} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.text3} maxLength={6} />
          <Text style={styles.suffix}>{suffix}</Text>
        </View>
      </View>
      {showSlider && (
        <RulerSlider value={sliderVal} min={dMin} max={dMax} step={0.1} unit={suffix} onChange={(v) => onChange(toCanon(v))} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.appBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.hairline, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, height: '88%' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.text, letterSpacing: 0.5 },
  date: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: 2 },
  list: { flex: 1 },
  unitToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, padding: 3, gap: 2 },
  unitChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  unitChipActive: { backgroundColor: colors.amber },
  unitText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text2 },
  unitTextActive: { color: colors.onAmber },
  row: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderRadius: radius.card, paddingHorizontal: spacing.md, paddingVertical: 8, minWidth: 100, justifyContent: 'flex-end' },
  input: { fontFamily: fonts.bold, fontSize: 18, color: colors.amber, textAlign: 'right', minWidth: 44, padding: 0 },
  suffix: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2 },
});
