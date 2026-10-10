/**
 * Custom bottom tab bar with an animated amber indicator that slides along the top
 * border between tabs, plus a small "droplet" that pops on switch. Both animations
 * are gated by the Animations setting (off → instant, no droplet).
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSettings } from '@/settings/SettingsProvider';
import { haptics } from '@/lib/haptics';
import { colors, fonts } from '@/theme/theme';

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { animationsEnabled } = useSettings();
  const [width, setWidth] = useState(0);
  const n = state.routes.length;
  const tabW = n > 0 ? width / n : 0;

  const indX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (width <= 0) return;
    const target = state.index * tabW;
    if (animationsEnabled) {
      Animated.spring(indX, { toValue: target, useNativeDriver: true, speed: 16, bounciness: 9 }).start();
    } else {
      indX.setValue(target);
    }
  }, [state.index, tabW, animationsEnabled, width, indX]);

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom, height: 58 + insets.bottom }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View pointerEvents="none" style={[styles.indicatorWrap, { width: tabW, transform: [{ translateX: indX }] }]}>
          <View style={styles.indicator} />
        </Animated.View>
      )}

      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const focused = state.index === i;
        const color = focused ? colors.amber : colors.text3;
        const icon = options.tabBarIcon?.({ focused, color, size: 22 });
        const label = (options.title ?? route.name) as string;
        const onPress = () => {
          haptics.selection();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
        };
        return (
          <Pressable key={route.key} style={styles.tab} onPress={onPress}>
            {icon}
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.appBg, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 8 },
  indicatorWrap: { position: 'absolute', top: 0, left: 0, alignItems: 'center' },
  indicator: { position: 'absolute', top: -1, width: 38, height: 3, borderRadius: 2, backgroundColor: colors.amber },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 10 },
});
