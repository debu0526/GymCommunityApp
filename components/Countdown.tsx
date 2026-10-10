/**
 * Full-screen 3-2-1 countdown shown before a workout starts. Call
 * `useCountdown().runCountdown(onComplete)` — the overlay takes over the whole screen
 * (gunmetal ground, amber number), pulses a haptic on every number change plus a final
 * "go", then runs onComplete (which actually starts the workout). Rendered at the root so
 * it sits above the tab bar and every screen.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { haptics } from '@/lib/haptics';
import { colors, fonts, spacing } from '@/theme/theme';

const CountdownContext = createContext<{ runCountdown: (onComplete: () => void) => void }>({ runCountdown: () => {} });

export function CountdownProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState<number | null>(null);
  const onDone = useRef<null | (() => void)>(null);

  const runCountdown = useCallback((onComplete: () => void) => {
    onDone.current = onComplete;
    setCount(3);
    haptics.selection(); // pulse on the first number
  }, []);

  // `count` is READ in render, so this tick is never optimized away by the React Compiler.
  useEffect(() => {
    if (count == null) return;
    if (count <= 0) {
      haptics.success(); // "go!"
      const cb = onDone.current;
      onDone.current = null;
      setCount(null);
      cb?.();
      return;
    }
    const t = setTimeout(() => {
      if (count > 1) haptics.selection(); // pulse as each next number (2, 1) appears
      setCount((c) => (c == null ? null : c - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <CountdownContext.Provider value={{ runCountdown }}>
      {children}
      {count != null && count > 0 && (
        <View style={styles.overlay}>
          <Text style={styles.count}>{count}</Text>
          <Text style={styles.caption}>Breathe! Smash the PRs</Text>
        </View>
      )}
    </CountdownContext.Provider>
  );
}

export const useCountdown = () => useContext(CountdownContext);

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.appBg, zIndex: 100, elevation: 100 },
  count: { fontFamily: fonts.display, fontSize: 160, lineHeight: 176, color: colors.amber, letterSpacing: 1 },
  caption: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text2, letterSpacing: 0.5, marginTop: spacing.sm },
});
