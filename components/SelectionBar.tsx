/** Shared iOS-style selection action bar: Cancel · count · Delete, with a retention note. */
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, fonts } from '@/theme/theme';

export function SelectionBar({ count, onCancel, onDelete }: { count: number; onCancel: () => void; onDelete: () => void }) {
  return (
    <View>
      <View style={styles.bar}>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.count}>{count} selected</Text>
        <Pressable onPress={onDelete} hitSlop={8} disabled={count === 0}>
          <Text style={[styles.delete, count === 0 && styles.disabled]}>Delete</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>Deleted workouts can’t be retrieved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  cancel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text2 },
  count: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  delete: { fontFamily: fonts.bold, fontSize: 15, color: colors.amber },
  disabled: { color: colors.text3, opacity: 0.5 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2, marginBottom: spacing.sm },
});
