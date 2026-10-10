/**
 * "Know your workouts" — full-page exercise browser. Search overrides everything;
 * otherwise the body-part / category filters are horizontally SWIPEABLE pages (like the
 * exercise-info page), with an animated sliding indicator under the pills as you switch.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Animated, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchCatalog, MUSCLE_GROUPS, type CatalogExercise } from '@/db/workouts';
import { useSettings } from '@/settings/SettingsProvider';
import { haptics } from '@/lib/haptics';
import { colors, spacing, radius, fonts } from '@/theme/theme';

type Filter = { key: string; label: string; spec: { groups?: string[]; categories?: string[] } };
const CAT_CHIPS = [
  { key: 'plyometrics', label: 'Plyometrics' },
  { key: 'stretching', label: 'Stretching' },
  { key: 'cardio', label: 'Cardio' },
];
const COMP_CHIPS = [
  { key: 'powerlifting', label: 'Powerlifting' },
  { key: 'olympic weightlifting', label: 'Olympic' },
  { key: 'strongman', label: 'Strongman' },
];

export default function BrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { competitionTypesEnabled, animationsEnabled } = useSettings();

  const FILTERS: Filter[] = useMemo(() => {
    const groups = MUSCLE_GROUPS.map((g) => ({ key: `g:${g}`, label: g, spec: { groups: [g] } }));
    const cats = CAT_CHIPS.map((c) => ({ key: `c:${c.key}`, label: c.label, spec: { categories: [c.key] } }));
    const comp = competitionTypesEnabled ? COMP_CHIPS.map((c) => ({ key: `c:${c.key}`, label: c.label, spec: { categories: [c.key] } })) : [];
    return [{ key: 'all', label: 'All', spec: {} }, ...groups, ...cats, ...comp];
  }, [competitionTypesEnabled]);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogExercise[]>([]);
  const [pages, setPages] = useState<CatalogExercise[][]>([]);
  const searching = query.trim().length > 0;

  useEffect(() => {
    if (!searching) return;
    searchCatalog(query, { limit: 80 }).then(setSearchResults);
  }, [query, searching]);

  useEffect(() => {
    let active = true;
    Promise.all(FILTERS.map((f) => searchCatalog('', { ...f.spec, limit: 200 }))).then((res) => active && setPages(res));
    return () => { active = false; };
  }, [FILTERS]);

  // --- swipeable pager + pill indicator driven directly by scroll position ---
  const [tab, setTab] = useState(0);
  const [w, setW] = useState(0);
  const pager = useRef<ScrollView>(null);
  const strip = useRef<ScrollView>(null);
  const pillLayouts = useRef<{ x: number; width: number }[]>([]);
  const [measureTick, setMeasureTick] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onPillLayout = (i: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    pillLayouts.current[i] = { x, width };
    setMeasureTick((t) => t + 1);
  };

  const ensureVisible = (i: number) => {
    const L = pillLayouts.current[i];
    if (L) strip.current?.scrollTo({ x: Math.max(0, L.x - 48), animated: true });
  };
  const goTab = (i: number) => {
    setTab(i);
    haptics.selection();
    pager.current?.scrollTo({ x: i * w, animated: true });
    ensureVisible(i);
  };
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i !== tab) { setTab(i); haptics.selection(); ensureVisible(i); }
  };

  // The indicator interpolates its x/width across the measured pill layouts as the pager
  // scrolls, so it tracks the swipe frame-for-frame instead of jumping at the end.
  const N = FILTERS.length;
  const layouts = pillLayouts.current;
  const canTrack = w > 0 && N >= 2 && layouts.length >= N && layouts.slice(0, N).every((l) => l && l.width > 0);
  let thumbStyle: { transform: { translateX: Animated.AnimatedInterpolation<number> | number }[]; width: Animated.AnimatedInterpolation<number> | number };
  if (animationsEnabled && canTrack) {
    const inputRange = FILTERS.map((_, i) => i * w);
    thumbStyle = {
      transform: [{ translateX: scrollX.interpolate({ inputRange, outputRange: layouts.map((l) => l.x), extrapolate: 'clamp' }) }],
      width: scrollX.interpolate({ inputRange, outputRange: layouts.map((l) => l.width), extrapolate: 'clamp' }),
    };
  } else {
    const L = layouts[tab];
    thumbStyle = { transform: [{ translateX: L?.x ?? 0 }], width: L?.width ?? 0 };
  }

  const resultRow = (e: CatalogExercise) => (
    <Pressable key={e.id} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => router.push(`/exercise/${encodeURIComponent(e.id)}`)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{e.name}</Text>
        <Text style={styles.rowMeta}>{[e.group, e.category].filter(Boolean).join(' · ')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>KNOW YOUR WORKOUTS</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.text3} />
          <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Search exercises…" placeholderTextColor={colors.text3} autoCorrect={false} />
          {searching && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.text3} /></Pressable>
          )}
        </View>

        {searching ? (
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
            {searchResults.length === 0 ? <Text style={styles.empty}>No exercises found.</Text> : searchResults.map(resultRow)}
          </ScrollView>
        ) : (
          <>
            {/* Pill strip with sliding indicator, bordered top & bottom */}
            <View style={styles.stripWrap}>
              <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripContent}>
                <View style={styles.pillsInner}>
                  <Animated.View pointerEvents="none" style={[styles.thumb, thumbStyle]} />
                  {FILTERS.map((f, i) => (
                    <Pressable key={f.key} onPress={() => goTab(i)} onLayout={(e) => onPillLayout(i, e)} style={styles.pill}>
                      <Text style={[styles.pillText, tab === i && styles.pillTextActive]}>{f.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Swipeable pages */}
            <View style={{ flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
              {w > 0 && (
                <Animated.ScrollView
                  ref={pager as never}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                  onMomentumScrollEnd={onMomentumEnd}
                >
                  {FILTERS.map((f, i) => (
                    <ScrollView key={f.key} style={{ width: w }} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {(pages[i]?.length ?? 0) === 0 ? (
                        <Text style={styles.empty}>No exercises here yet.</Text>
                      ) : (
                        pages[i].map(resultRow)
                      )}
                    </ScrollView>
                  ))}
                </Animated.ScrollView>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { width: 24 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text3, letterSpacing: 1.2 },
  body: { flex: 1, paddingHorizontal: spacing.xl },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.lg, marginBottom: spacing.md, marginTop: spacing.sm },
  search: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text, paddingVertical: 12 },

  stripWrap: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.hairline, marginBottom: spacing.md },
  stripContent: { paddingVertical: spacing.sm, paddingRight: spacing.md },
  pillsInner: { flexDirection: 'row', position: 'relative', padding: 3 },
  thumb: { position: 'absolute', top: 3, bottom: 3, borderRadius: radius.pill, backgroundColor: colors.amber },
  pill: { paddingHorizontal: spacing.lg, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.text2 },
  pillTextActive: { color: colors.onAmber },

  pageContent: { paddingBottom: spacing.xxxl },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.text3, paddingVertical: spacing.xl, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  rowPressed: { opacity: 0.7 },
  rowName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  rowMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2 },
});
