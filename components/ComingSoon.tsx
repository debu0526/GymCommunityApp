/** Themed placeholder for screens whose features arrive in later phases. */
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { colors, spacing, radius, fonts } from '@/theme/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export function ComingSoon({ title, icon, blurb }: { title: string; icon: IoniconName; blurb: string }) {
  return (
    <Screen>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      <View style={styles.card}>
        <Ionicons name={icon} size={40} color={colors.amber} />
        <Text style={styles.soon}>Coming soon</Text>
        <Text style={styles.blurb}>{blurb}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, letterSpacing: 0.5, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  soon: { fontFamily: fonts.display, fontSize: 24, color: colors.text, marginTop: spacing.sm },
  blurb: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },
});
