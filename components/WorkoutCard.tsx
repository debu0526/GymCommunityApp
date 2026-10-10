/** Shared workout list row (Home Recent + Past Logs), with multi-select support. */
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTypeLabel, type RecentWorkout } from '@/db/workouts';
import { prettyDate } from '@/lib/attendance';
import { formatDuration } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { colors, spacing, radius, fonts } from '@/theme/theme';

type Props = {
  w: RecentWorkout;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

export function WorkoutCard({ w, selecting, selected, onPress, onLongPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed, selecting && selected && styles.selected]}
      onPress={onPress}
      onLongPress={() => { haptics.longPress(); onLongPress(); }}
      delayLongPress={300}
    >
      {selecting && (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={selected ? colors.amber : colors.text3}
          style={styles.check}
        />
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{workoutTypeLabel(w.type, w.customTypeName)}</Text>
          <Text style={styles.meta}>{prettyDate(w.date)}</Text>
        </View>
        <Text style={styles.sub}>
          {formatDuration(w.durationSec)}
          {w.exerciseCount > 0 ? ` · ${w.exerciseCount} ex · ${w.setCount} sets` : ' · quick session'}
          {w.volume > 0 ? ` · ${Math.round(w.volume)} kg vol` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  selected: { borderColor: colors.amber },
  check: { marginRight: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3 },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: 4 },
});
