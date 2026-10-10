/**
 * Reusable completion-celebration overlay. Call `useCelebration().celebrate({title, subtitle})`
 * from anywhere (finish workout, new PR, streak milestone, future features) to show a brief
 * centered card. Respects the animations toggle: animates when on, appears instantly when off.
 * Rendered at the root so it survives navigation/unmounts.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/settings/SettingsProvider';
import { colors, spacing, radius, fonts } from '@/theme/theme';

type Cel = { title: string; subtitle?: string };
const CelebrationContext = createContext<{ celebrate: (c: Cel) => void }>({ celebrate: () => {} });

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const { animationsEnabled } = useSettings();
  const [cel, setCel] = useState<Cel | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrate = useCallback((c: Cel) => setCel(c), []);

  useEffect(() => {
    if (!cel) return;
    if (animationsEnabled) {
      opacity.setValue(0);
      scale.setValue(0.9);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 14 }),
      ]).start();
    } else {
      opacity.setValue(1);
      scale.setValue(1);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (animationsEnabled) {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setCel(null));
      } else {
        setCel(null);
      }
    }, 1600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [cel, animationsEnabled, opacity, scale]);

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      {cel && (
        <Animated.View pointerEvents="none" style={[styles.overlay, { opacity }]}>
          <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.amber} />
            <Text style={styles.title}>{cel.title}</Text>
            {cel.subtitle ? <Text style={styles.sub}>{cel.subtitle}</Text> : null}
          </Animated.View>
        </Animated.View>
      )}
    </CelebrationContext.Provider>
  );
}

export const useCelebration = () => useContext(CelebrationContext);

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { backgroundColor: colors.surface2, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xxxl, alignItems: 'center', gap: spacing.sm, maxWidth: 300 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.text, letterSpacing: 0.5, textAlign: 'center' },
  sub: { fontFamily: fonts.semibold, fontSize: 14, color: colors.amber, textAlign: 'center' },
});
