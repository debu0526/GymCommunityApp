/**
 * The visual workout card that gets captured to an image and shared. Fixed-width,
 * gunmetal + amber, with fields toggled by the user's share-card preferences. Pure
 * presentational — the provider wraps it in a ViewShot ref and captures it.
 */
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, fonts } from '@/theme/theme';
import { prettyDate } from '@/lib/attendance';
import type { ShareCardFields } from '@/settings/SettingsProvider';

export type ShareCardData = {
  title: string;
  bestLift: { name: string; weight: number; reps: number | null } | null;
  streak: number;
  dateISO: string;
  quote: string;
};

export const CARD_W = 320;

export function ShareCard({ data, fields }: { data: ShareCardData; fields: ShareCardFields }) {
  return (
    <View style={styles.card}>
      {/* top accent + brand row */}
      <View style={styles.accent} />
      <View style={styles.brandRow}>
        <Text style={styles.brand}>GYM LOG</Text>
        {fields.date ? <Text style={styles.date}>{prettyDate(data.dateISO)}</Text> : null}
      </View>

      {fields.title ? <Text style={styles.title}>{data.title.toUpperCase()}</Text> : null}

      {fields.bestLift && data.bestLift ? (
        <View style={styles.bestBlock}>
          <Text style={styles.bestLabel}>BEST LIFT</Text>
          <Text style={styles.bestNum}>
            {data.bestLift.weight}
            <Text style={styles.bestUnit}> kg</Text>
            {data.bestLift.reps != null ? <Text style={styles.bestReps}> × {data.bestLift.reps}</Text> : null}
          </Text>
          <Text style={styles.bestName} numberOfLines={1}>{data.bestLift.name}</Text>
        </View>
      ) : null}

      {fields.streak ? (
        <View style={styles.streakPill}>
          <Text style={styles.streakText}>🔥 {data.streak} day{data.streak === 1 ? '' : 's'} streak</Text>
        </View>
      ) : null}

      {fields.quote && data.quote ? <Text style={styles.quote}>&ldquo;{data.quote}&rdquo;</Text> : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Tracked with Gym Log</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_W, backgroundColor: colors.appBg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg, overflow: 'hidden' },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: colors.amber },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, marginBottom: spacing.lg },
  brand: { fontFamily: fonts.semibold, fontSize: 12, color: colors.amber, letterSpacing: 2 },
  date: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text, letterSpacing: 0.5, marginBottom: spacing.lg },
  bestBlock: { marginBottom: spacing.lg },
  bestLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 1 },
  bestNum: { fontFamily: fonts.display, fontSize: 56, color: colors.amber, lineHeight: 60, marginTop: 2 },
  bestUnit: { fontFamily: fonts.regular, fontSize: 18, color: colors.text2 },
  bestReps: { fontFamily: fonts.display, fontSize: 40, color: colors.text },
  bestName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text2, marginTop: 2 },
  streakPill: { alignSelf: 'flex-start', backgroundColor: colors.amberDim, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, marginBottom: spacing.lg },
  streakText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.amber },
  quote: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, fontStyle: 'italic', lineHeight: 20, marginBottom: spacing.lg },
  footer: { borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: spacing.md },
  footerText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.5 },
});
