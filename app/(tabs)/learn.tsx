/** Learn: "Know your workouts" (opens the browse page) + Coming soon. */
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PillButton } from '@/components/PillButton';
import { colors, spacing, radius, fonts } from '@/theme/theme';

const COMING_SOON = ['Suggested workouts', 'Form videos', 'Knowledge articles', 'Research papers'];

export default function LearnScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Text style={styles.title}>LEARN</Text>

      <PillButton label="Know your workouts  →" block variant="primary" onPress={() => router.push('/browse')} style={styles.kywBtn} />
      <Text style={styles.hint}>Browse every exercise and learn how to do it.</Text>

      <Text style={styles.sectionLabel}>COMING SOON</Text>
      <View style={styles.pillWrap}>
        {COMING_SOON.map((t) => (
          <View key={t} style={styles.comingPill}><Text style={styles.comingPillText}>{t}</Text></View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, letterSpacing: 0.5, marginBottom: spacing.lg },
  kywBtn: { marginBottom: spacing.sm },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.text3, marginBottom: spacing.md },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3, letterSpacing: 1.2, marginTop: spacing.xl, marginBottom: spacing.md },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  comingPill: { backgroundColor: colors.surface2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.md, paddingVertical: 8 },
  comingPillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text2 },
});
