/**
 * Profile: name, biological gender, age, height. Saved to SQLite.
 * These metrics power BMI / ideal-weight reference lines and future health features.
 */
import { useCallback, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Switch, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PillButton } from '@/components/PillButton';
import { getProfile, saveProfile } from '@/db/database';
import { useSettings, type ShareCardFields } from '@/settings/SettingsProvider';
import { haptics } from '@/lib/haptics';
import type { Gender } from '@/lib/health';
import { colors, spacing, radius, fonts } from '@/theme/theme';

const REST_OPTIONS = [60, 90, 120, 180];
const SHARE_FIELD_OPTIONS: { key: keyof ShareCardFields; label: string }[] = [
  { key: 'title', label: 'Workout title' },
  { key: 'bestLift', label: 'Best lift' },
  { key: 'streak', label: 'Streak' },
  { key: 'date', label: 'Date' },
  { key: 'quote', label: 'Quote' },
];
function restLabel(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec === 0 ? `${m}:00` : `${m}:${String(sec).padStart(2, '0')}`;
}

export default function ProfileScreen() {
  const { animationsEnabled, setAnimationsEnabled, restSeconds, setRestSeconds, competitionTypesEnabled, setCompetitionTypesEnabled, shareOnFinish, setShareOnFinish, shareCardFields, setShareCardField } = useSettings();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [saved, setSaved] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getProfile().then((p) => {
        if (!active || !p) return;
        setName(p.name ?? '');
        setGender(p.gender);
        setAge(p.age != null ? String(p.age) : '');
        setHeight(p.heightCm != null ? String(p.heightCm) : '');
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const ageNum = age.trim() === '' ? null : parseInt(age, 10);
  const heightNum = height.trim() === '' ? null : parseFloat(height.replace(',', '.'));
  const ageValid = ageNum === null || (!isNaN(ageNum) && ageNum > 0 && ageNum < 120);
  const heightValid = heightNum === null || (!isNaN(heightNum) && heightNum > 50 && heightNum < 260);
  const canSave = ageValid && heightValid;

  const onSave = async () => {
    await saveProfile({
      name: name.trim() || null,
      gender,
      age: ageNum,
      heightCm: heightNum,
    });
    haptics.success();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <Screen>
      <Text style={styles.title}>PROFILE</Text>
      <Text style={styles.subtitle}>Used for BMI, ideal-weight references, and future health metrics.</Text>

      <Field label="Name">
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.text3}
          maxLength={40}
        />
      </Field>

      <Field label="Biological gender">
        <View style={styles.genderRow}>
          <PillButton label="Male" variant={gender === 'male' ? 'primary' : 'ghost'} onPress={() => setGender('male')} style={styles.genderBtn} />
          <PillButton label="Female" variant={gender === 'female' ? 'primary' : 'ghost'} onPress={() => setGender('female')} style={styles.genderBtn} />
        </View>
        <Text style={styles.helper}>Used for the Devine ideal-weight formula.</Text>
      </Field>

      <View style={styles.row}>
        <Field label="Age" style={styles.half}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholder="—"
              placeholderTextColor={colors.text3}
              maxLength={3}
            />
            <Text style={styles.unit}>yrs</Text>
          </View>
          {!ageValid && <Text style={styles.error}>Enter 1–119</Text>}
        </Field>

        <Field label="Height" style={styles.half}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.text3}
              maxLength={5}
            />
            <Text style={styles.unit}>cm</Text>
          </View>
          {!heightValid && <Text style={styles.error}>Enter 50–260</Text>}
        </Field>
      </View>

      <View style={{ height: spacing.lg }} />
      <PillButton label={saved ? '✓ Saved' : 'Save profile'} block variant="primary" onPress={onSave} style={!canSave ? styles.disabled : undefined} />

      <Text style={styles.hint}>Your data stays on this device. Nothing is uploaded.</Text>

      <Pressable style={styles.prefHeader} onPress={() => { setPrefsOpen((o) => !o); haptics.selection(); }}>
        <Ionicons name="settings-outline" size={18} color={colors.text2} />
        <Text style={styles.prefHeaderText}>Preferences</Text>
        <View style={{ flex: 1 }} />
        <Ionicons name={prefsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text3} />
      </Pressable>
      {prefsOpen && (<>
      <View style={styles.prefCard}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={styles.prefName}>Animations</Text>
          <Text style={styles.prefSub}>Turn off for smoother performance on older phones.</Text>
        </View>
        <Switch
          value={animationsEnabled}
          onValueChange={(v) => { setAnimationsEnabled(v); haptics.selection(); }}
          trackColor={{ true: colors.amber, false: colors.hairline }}
          thumbColor={colors.text}
        />
      </View>

      <View style={[styles.prefCard, { marginTop: spacing.md, flexDirection: 'column', alignItems: 'stretch' }]}>
        <Text style={styles.prefName}>Rest timer default</Text>
        <Text style={styles.prefSub}>Starting time for the rest timer during a workout.</Text>
        <View style={styles.restRow}>
          {REST_OPTIONS.map((s) => {
            const active = restSeconds === s;
            return (
              <Pressable key={s} onPress={() => { setRestSeconds(s); haptics.selection(); }} style={[styles.restChip, active && styles.restChipActive]}>
                <Text style={[styles.restChipText, active && styles.restChipTextActive]}>{restLabel(s)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.prefCard, { marginTop: spacing.md }]}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={styles.prefName}>Competition workout types</Text>
          <Text style={styles.prefSub}>Show Powerlifting, Olympic Lifting & Strongman as workout types.</Text>
        </View>
        <Switch
          value={competitionTypesEnabled}
          onValueChange={(v) => { setCompetitionTypesEnabled(v); haptics.selection(); }}
          trackColor={{ true: colors.amber, false: colors.hairline }}
          thumbColor={colors.text}
        />
      </View>

      {/* Share card preferences */}
      <View style={[styles.prefCard, { marginTop: spacing.md }]}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={styles.prefName}>Ask to share after workouts</Text>
          <Text style={styles.prefSub}>Show a shareable workout card when you Finish & Save.</Text>
        </View>
        <Switch
          value={shareOnFinish}
          onValueChange={(v) => { setShareOnFinish(v); haptics.selection(); }}
          trackColor={{ true: colors.amber, false: colors.hairline }}
          thumbColor={colors.text}
        />
      </View>

      <View style={[styles.prefCard, { marginTop: spacing.md, flexDirection: 'column', alignItems: 'stretch' }]}>
        <Text style={styles.prefName}>Share card shows</Text>
        <Text style={styles.prefSub}>Pick what appears on your shared workout card.</Text>
        <View style={styles.shareChips}>
          {SHARE_FIELD_OPTIONS.map((o) => {
            const active = shareCardFields[o.key];
            return (
              <Pressable key={o.key} onPress={() => { setShareCardField(o.key, !active); haptics.selection(); }} style={[styles.shareChip, active && styles.shareChipActive]}>
                <Text style={[styles.shareChipText, active && styles.shareChipTextActive]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      </>)}
    </Screen>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, letterSpacing: 0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, marginBottom: spacing.xl },
  field: { marginBottom: spacing.lg },
  label: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 1, marginBottom: spacing.sm },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unit: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  genderRow: { flexDirection: 'row', gap: spacing.md },
  genderBtn: { flex: 1 },
  helper: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.amber, marginTop: spacing.xs },
  disabled: { opacity: 0.4 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.text3, marginTop: spacing.lg, textAlign: 'center' },
  prefLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3, letterSpacing: 1.2, marginTop: spacing.xxl, marginBottom: spacing.sm },
  prefHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl, marginBottom: spacing.md },
  prefHeaderText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text2, letterSpacing: 1, textTransform: 'uppercase' },
  prefCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  prefName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  prefSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2, lineHeight: 16 },
  restRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  restChip: { flex: 1, alignItems: 'center', backgroundColor: colors.surface2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, paddingVertical: 10 },
  restChipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  restChipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text2 },
  restChipTextActive: { color: colors.onAmber },
  shareChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  shareChip: { backgroundColor: colors.surface2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.md, paddingVertical: 8 },
  shareChipActive: { backgroundColor: colors.amberDim, borderColor: colors.amber },
  shareChipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text2 },
  shareChipTextActive: { color: colors.amber },
});

