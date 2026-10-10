/** Bold pill-shaped button in three weights: primary (amber), soft (amber tint), ghost (outline). */
import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { haptics } from '@/lib/haptics';
import { colors, radius, spacing, fonts } from '@/theme/theme';

type Variant = 'primary' | 'soft' | 'ghost';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  block?: boolean;
  style?: ViewStyle;
};

export function PillButton({ label, onPress, variant = 'primary', block, style }: Props) {
  const handle = () => {
    // Subtle haptic on ordinary taps is fine (celebration is reserved for completions).
    haptics.selection();
    onPress?.();
  };

  return (
    <Pressable
      onPress={handle}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'soft' && styles.soft,
        variant === 'ghost' && styles.ghost,
        block && styles.block,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === 'primary' && { color: colors.onAmber },
          variant === 'soft' && { color: colors.amber },
          variant === 'ghost' && { color: colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.amber },
  soft: { backgroundColor: colors.amberDim },
  ghost: { borderWidth: 1.5, borderColor: colors.hairline },
  block: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fonts.semibold, fontSize: 15 },
});
