/** Themed screen wrapper: gunmetal background, safe-area aware, optional scroll. */
import React from 'react';
import { ScrollView, View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, scroll = true, style }: Props) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: insets.top + spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  };

  if (scroll) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[pad, style]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.root, pad, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
});
