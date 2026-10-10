/** Modal to enter/edit a weight (kg) for a specific date. */
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { PillButton } from '@/components/PillButton';
import { colors, spacing, radius, fonts } from '@/theme/theme';
import { prettyDate } from '@/lib/attendance';

type Props = {
  visible: boolean;
  dateISO: string | null;
  initial: number | null;
  onSave: (kg: number) => void;
  onRemove: () => void;
  onClose: () => void;
};

export function WeightEntryModal({ visible, dateISO, initial, onSave, onRemove, onClose }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText(initial != null ? String(initial) : '');
  }, [visible, initial]);

  const num = parseFloat(text.replace(',', '.'));
  const valid = !isNaN(num) && num > 0 && num < 500;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>WEIGHT CHECK-IN</Text>
            {dateISO && <Text style={styles.date}>{prettyDate(dateISO)}</Text>}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor={colors.text3}
                autoFocus
                maxLength={6}
              />
              <Text style={styles.unit}>kg</Text>
            </View>

            <PillButton label="Save" block variant="primary" onPress={() => valid && onSave(num)} style={!valid ? styles.disabled : undefined} />
            {initial != null && (
              <PillButton label="Remove entry" block variant="ghost" onPress={onRemove} style={styles.mt} />
            )}
            <Pressable onPress={onClose} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  sheet: {
    backgroundColor: colors.surface2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.xl,
  },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: 0.5 },
  date: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginBottom: spacing.lg },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  input: {
    fontFamily: fonts.display,
    fontSize: 56,
    color: colors.amber,
    textAlign: 'center',
    minWidth: 140,
    padding: 0,
  },
  unit: { fontFamily: fonts.regular, fontSize: 20, color: colors.text2, marginLeft: spacing.sm },
  disabled: { opacity: 0.4 },
  mt: { marginTop: spacing.sm },
  cancel: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  cancelText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text2 },
});
