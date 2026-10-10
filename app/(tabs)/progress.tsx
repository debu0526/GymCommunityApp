/** Progress: weight/BMI trend (existing) + "Your Lifts" (PRs, heaviest lifts, this month). */
import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { WeightChart, ChartMode } from '@/components/WeightChart';
import { getAllWeights, getProfile, type WeightEntry, type Profile } from '@/db/database';
import { getPR, type PR } from '@/db/workouts';
import { bmi, bmiCategory } from '@/lib/health';
import { epley1RM } from '@/lib/strength';
import { prettyDate } from '@/lib/attendance';
import { colors, spacing, radius, fonts } from '@/theme/theme';

function oneRm(pr: PR): number | null {
  return pr ? epley1RM(pr.weight, pr.reps) : null;
}

export default function ProgressScreen() {
  const router = useRouter();
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<ChartMode>('weight');
  const [prs, setPrs] = useState<{ deadlift: PR; squat: PR; bench: PR; ohp: PR }>({ deadlift: null, squat: null, bench: null, ohp: null });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAllWeights().then((w) => active && setWeights(w));
      getProfile().then((p) => active && setProfile(p));
      Promise.all([getPR('deadlift'), getPR('squat'), getPR('bench'), getPR('overhead press')]).then(([deadlift, squat, bench, ohp]) => active && setPrs({ deadlift, squat, bench, ohp }));
      return () => { active = false; };
    }, [])
  );

  // Personal records ordered dynamically — heaviest on top.
  const prCards = [
    { label: 'Deadlift', pr: prs.deadlift },
    { label: 'Squat', pr: prs.squat },
    { label: 'Bench', pr: prs.bench },
  ].sort((a, b) => (b.pr?.weight ?? -1) - (a.pr?.weight ?? -1));
  const heroPR = prCards[0];
  const tilePRs = prCards.slice(1);

  const latest = weights.length ? weights[weights.length - 1] : null;
  const hasHeight = profile?.heightCm != null && profile.heightCm > 0;
  const latestBmi = latest && hasHeight ? bmi(latest.weight, profile!.heightCm as number) : null;

  return (
    <Screen>
      <Text style={styles.title}>PROGRESS</Text>
      <Text style={styles.subtitle}>Your weight, BMI, and lifts over time.</Text>

      {/* --- Weight section (unchanged) --- */}
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Current weight</Text>
          <Text style={styles.statNum}>{latest ? latest.weight : '—'}<Text style={styles.statUnit}> kg</Text></Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Current BMI</Text>
          {latestBmi != null ? (
            <>
              <Text style={[styles.statNum, { color: colors.amber }]}>{latestBmi.toFixed(1)}</Text>
              <Text style={styles.statSub}>{bmiCategory(latestBmi)}</Text>
            </>
          ) : (
            <Text style={styles.statNum}>—</Text>
          )}
        </View>
      </View>

      <View style={{ height: spacing.md }} />

      <WeightChart entries={weights} mode={mode} onModeChange={setMode} heightCm={profile?.heightCm ?? null} gender={profile?.gender ?? null} />

      <Text style={styles.hint}>
        Add weight check-ins in the Log tab. Set your height{profile?.gender ? '' : ' and gender'} in Profile for BMI and reference lines.
      </Text>

      {/* Body progression → per-measurement graphs */}
      <Pressable style={({ pressed }) => [styles.navPill, pressed && styles.navPillPressed]} onPress={() => router.push('/body-progression')}>
        <Ionicons name="body-outline" size={20} color={colors.amber} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navPillTitle}>Body progression</Text>
          <Text style={styles.navPillSub}>Waist, chest, arms, calves, thighs & weight over time</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text3} />
      </Pressable>

      {/* --- Your Lifts --- */}
      <Text style={styles.sectionLabel}>YOUR LIFTS</Text>

      {/* Personal records — heaviest lift shown as the hero */}
      <Text style={styles.subLabel}>Personal records</Text>
      <View style={styles.prHero}>
        <Text style={styles.prLabel}>{heroPR.label.toUpperCase()} · BEST</Text>
        {heroPR.pr ? (
          <>
            <Text style={styles.prHeroNum}>{heroPR.pr.weight}<Text style={styles.prUnit}> kg</Text></Text>
            <Text style={styles.prSub}>{heroPR.pr.reps ?? '–'} reps · {prettyDate(heroPR.pr.date)}</Text>
            <Text style={styles.prRm}>1RM ≈ {Math.round(oneRm(heroPR.pr)!)} kg (Epley)</Text>
          </>
        ) : (
          <Text style={styles.prEmpty}>No lifts logged yet</Text>
        )}
      </View>
      <View style={styles.prRow}>
        {tilePRs.map((t) => (
          <PRTile key={t.label} label={t.label} pr={t.pr} />
        ))}
      </View>

      {/* Estimated 1RM (Epley) for the main compound lifts */}
      <Text style={styles.subLabel}>Estimated 1RM (Epley)</Text>
      <View style={styles.rmWrap}>
        {[
          { label: 'Squat', pr: prs.squat },
          { label: 'Bench', pr: prs.bench },
          { label: 'Deadlift', pr: prs.deadlift },
          { label: 'OHP', pr: prs.ohp },
        ].map((l) => {
          const rm = oneRm(l.pr);
          return (
            <View key={l.label} style={styles.rmChip}>
              <Text style={styles.rmChipLabel}>{l.label}</Text>
              <Text style={styles.rmChipNum}>{rm != null ? `${Math.round(rm)}` : '—'}<Text style={styles.rmChipUnit}>{rm != null ? ' kg' : ''}</Text></Text>
            </View>
          );
        })}
      </View>

      {/* Per-exercise trends → heaviest lifts, each with its own progression graph */}
      <Pressable style={({ pressed }) => [styles.navPill, { marginTop: spacing.lg }, pressed && styles.navPillPressed]} onPress={() => router.push('/exercise-trends')}>
        <Ionicons name="trending-up" size={20} color={colors.amber} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navPillTitle}>Per exercise trends</Text>
          <Text style={styles.navPillSub}>Your heaviest lifts — tap any exercise for its graph</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text3} />
      </Pressable>

      {/* Training volume → this-month totals + Volume by Muscle */}
      <Pressable style={({ pressed }) => [styles.navPill, { marginTop: spacing.md }, pressed && styles.navPillPressed]} onPress={() => router.push('/volume')}>
        <Ionicons name="stats-chart" size={20} color={colors.amber} />
        <View style={{ flex: 1 }}>
          <Text style={styles.navPillTitle}>Volume by muscle</Text>
          <Text style={styles.navPillSub}>This month + weekly sets per muscle vs your goal</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text3} />
      </Pressable>

      <Text style={styles.sectionLabel}>COMING SOON</Text>
      <View style={styles.pillWrap}>
        {COMING_SOON.map((t) => (
          <View key={t} style={styles.comingPill}><Text style={styles.comingPillText}>{t}</Text></View>
        ))}
      </View>
    </Screen>
  );
}

function PRTile({ label, pr }: { label: string; pr: PR }) {
  return (
    <View style={styles.prTile}>
      <Text style={styles.prTileLabel}>{label}</Text>
      {pr ? (
        <>
          <Text style={styles.prTileNum}>{pr.weight}<Text style={styles.prTileUnit}> kg</Text></Text>
          <Text style={styles.prTileSub}>{pr.reps ?? '–'} reps · {prettyDate(pr.date)}</Text>
        </>
      ) : (
        <Text style={styles.prTileNum}>—</Text>
      )}
    </View>
  );
}

const COMING_SOON = ['Goals & targets', 'Streak insights', 'Shareable cards'];

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, letterSpacing: 0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, marginBottom: spacing.lg },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  statLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase' },
  statNum: { fontFamily: fonts.display, fontSize: 40, color: colors.text, marginTop: spacing.xs },
  statUnit: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  statSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.text2 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.text3, marginTop: spacing.lg, lineHeight: 19 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3, letterSpacing: 1.2, marginTop: spacing.xxl, marginBottom: spacing.md },
  subLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },
  subLabelInline: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase' },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm, paddingVertical: 4 },

  prHero: { backgroundColor: colors.surface2, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.xl, alignItems: 'center' },
  prLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 1, textTransform: 'uppercase' },
  prHeroNum: { fontFamily: fonts.display, fontSize: 60, color: colors.amber, lineHeight: 64, marginTop: spacing.xs },
  prUnit: { fontFamily: fonts.regular, fontSize: 18, color: colors.text2 },
  prSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2 },
  prEmpty: { fontFamily: fonts.regular, fontSize: 14, color: colors.text3, marginTop: spacing.sm },
  prRm: { fontFamily: fonts.semibold, fontSize: 12, color: colors.amber, marginTop: spacing.xs },
  rmWrap: { flexDirection: 'row', gap: spacing.sm },
  rmChip: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center' },
  rmChipLabel: { fontFamily: fonts.semibold, fontSize: 10, color: colors.text3, letterSpacing: 0.5, textTransform: 'uppercase' },
  rmChipNum: { fontFamily: fonts.display, fontSize: 24, color: colors.text, marginTop: 2 },
  rmChipUnit: { fontFamily: fonts.regular, fontSize: 11, color: colors.text2 },
  prRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  prTile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  prTileLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase' },
  prTileNum: { fontFamily: fonts.display, fontSize: 34, color: colors.text, marginTop: spacing.xs },
  prTileUnit: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2 },
  prTileSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2 },

  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  navPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginTop: spacing.md },
  navPillPressed: { opacity: 0.7 },
  navPillTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  navPillSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2 },
  liftRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  liftRowBorder: { borderTopWidth: 1, borderTopColor: colors.hairline },
  liftName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, flex: 1, paddingRight: spacing.md },
  liftWeight: { fontFamily: fonts.bold, fontSize: 15, color: colors.amber },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  monthLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  monthNum: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: spacing.xs },
  mgRow: { paddingVertical: spacing.sm },
  mgTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  mgName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  mgVol: { fontFamily: fonts.bold, fontSize: 14, color: colors.amber },
  mgSets: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  mgSetsUnit: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3 },
  mgTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surface2, overflow: 'hidden', position: 'relative' },
  mgFill: { height: 10, borderRadius: 5, backgroundColor: colors.amber },
  mgTarget: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.text, opacity: 0.75 },
  mgLegend: { fontFamily: fonts.regular, fontSize: 11, color: colors.text3, marginTop: spacing.sm, lineHeight: 16 },

  volTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  volTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  volTabActive: { backgroundColor: colors.amberDim },
  volTabText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3 },
  volTabTextActive: { color: colors.amber },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  goalLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8 },
  goalToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, padding: 3, gap: 2 },
  goalChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  goalChipActive: { backgroundColor: colors.amber },
  goalChipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text2 },
  goalChipTextActive: { color: colors.onAmber },
  targetNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.text2, marginBottom: spacing.sm },
  warnCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.amberDim, borderRadius: radius.card, padding: spacing.md, marginTop: spacing.sm },
  warnText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.text, lineHeight: 17 },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  comingPill: { backgroundColor: colors.surface2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.md, paddingVertical: 8 },
  comingPillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text2 },
});
