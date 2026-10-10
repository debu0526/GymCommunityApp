/** Long-press menu for a calendar day: weight check-in, rest day, or gym day. */
import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts } from '@/theme/theme';
import { prettyDate } from '@/lib/attendance';

export type DayState = {
  isWorkout: boolean;
  isRest: boolean;
  weight: number | null;
  workoutId: string | null;
};

type Props = {
  visible: boolean;
  dateISO: string | null;
  state: DayState;
  onWeight: () => void;
  onMeasure: () => void;
  onToggleRest: () => void;
  onToggleWorkout: () => void;
  onViewWorkout: () => void;
  onClose: () => void;
};

export function DayActionSheet({ visible, dateISO, state, onWeight, onMeasure, onToggleRest, onToggleWorkout, onViewWorkout, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {dateISO && <Text style={styles.date}>{prettyDate(dateISO)}</Text>}

          {state.workoutId ? (
            <Row icon="barbell" label="View logged workout" onPress={onViewWorkout} active />
          ) : null}
          <Row
            icon="scale-outline"
            label={state.weight != null ? `Edit weight (${state.weight} kg)` : 'Log weight'}
            onPress={onWeight}
          />
          <Row
            icon="body-outline"
            label="Log body measurements"
            onPress={onMeasure}
          />
          <Row
            icon="moon-outline"
            label={state.isRest ? 'Remove rest day' : 'Mark as rest day'}
            onPress={onToggleRest}
            active={state.isRest}
          />
          <Row
            icon="barbell-outline"
            label={state.isWorkout ? 'Unmark gym day' : 'Mark as gym day'}
            onPress={onToggleWorkout}
            active={state.isWorkout}
          />

          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ icon, label, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={active ? colors.amber : colors.text} />
      <Text style={[styles.rowLabel, active && { color: colors.amber }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', padding: spacing.lg, paddingBottom: spacing.xxxl },
  sheet: { backgroundColor: colors.surface2, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.md },
  date: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.card },
  rowPressed: { backgroundColor: colors.surface },
  rowLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  cancel: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  cancelText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text2 },
});
