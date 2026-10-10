/**
 * Reusable equal-width segmented tabs that are BOTH tappable and horizontally swipeable,
 * with an amber indicator that tracks the swipe frame-for-frame (falls back to a plain jump
 * when animations are reduced). Use anywhere a screen has 2+ peer views the user switches
 * between (e.g. Past Logs → Workouts / Exercises).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSettings } from '@/settings/SettingsProvider';
import { haptics } from '@/lib/haptics';
import { colors, radius, fonts } from '@/theme/theme';

export type SwipeTab = { key: string; label: string };

export function SwipeTabs({
  tabs,
  index,
  onIndexChange,
  renderPage,
  swipeEnabled = true,
  showTabBar = true,
}: {
  tabs: SwipeTab[];
  index: number;
  onIndexChange: (i: number) => void;
  renderPage: (key: string, i: number) => React.ReactNode;
  swipeEnabled?: boolean;
  showTabBar?: boolean;
}) {
  const { animationsEnabled } = useSettings();
  const [w, setW] = useState(0);
  const pager = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const n = tabs.length;
  const tabW = n > 0 && w > 0 ? w / n : 0;

  // Keep the pager aligned when the index is changed externally (or width settles).
  useEffect(() => {
    if (w > 0) pager.current?.scrollTo({ x: index * w, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, w]);

  const goTab = (i: number) => {
    if (i === index) return;
    haptics.selection();
    pager.current?.scrollTo({ x: i * w, animated: true });
    onIndexChange(i);
  };
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i !== index) { haptics.selection(); onIndexChange(i); }
  };

  const thumbX: Animated.AnimatedInterpolation<number> | number =
    animationsEnabled && w > 0 && n > 1
      ? scrollX.interpolate({ inputRange: tabs.map((_, i) => i * w), outputRange: tabs.map((_, i) => i * tabW + 3), extrapolate: 'clamp' })
      : index * tabW + 3;

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {showTabBar && w > 0 && (
        <View style={styles.strip}>
          <Animated.View pointerEvents="none" style={[styles.thumb, { width: tabW - 6, transform: [{ translateX: thumbX }] }]} />
          {tabs.map((t, i) => (
            <Pressable key={t.key} onPress={() => goTab(i)} style={[styles.tab, { width: tabW }]}>
              <Text style={[styles.tabText, index === i && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {w > 0 && (
        <Animated.ScrollView
          ref={pager as never}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={swipeEnabled}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {tabs.map((t, i) => (
            <View key={t.key} style={{ width: w }}>{renderPage(t.key, i)}</View>
          ))}
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', position: 'relative', backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, marginBottom: 12 },
  thumb: { position: 'absolute', top: 3, bottom: 3, left: 0, borderRadius: radius.pill, backgroundColor: colors.amber },
  tab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text2 },
  tabTextActive: { color: colors.onAmber },
});
