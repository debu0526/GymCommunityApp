/**
 * Reusable exercise-knowledge view: name/meta + horizontally-scrollable pills
 * (How to / Muscles in action / Scientific info) whose panels are ALSO swipeable
 * left/right. Padding-agnostic: it measures its own width, so it works full-screen
 * and inside the Add-exercise sheet. Wrap it in a flex:1, horizontally-padded parent.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent } from 'react-native';
import { getExerciseKnowledge, type ExerciseKnowledge } from '@/db/workouts';
import { useSettings } from '@/settings/SettingsProvider';
import { haptics } from '@/lib/haptics';
import { colors, spacing, radius, fonts } from '@/theme/theme';

const TABS = ['How to', 'Muscles', 'Science'];
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ExerciseInfo({ idOrName }: { idOrName: string }) {
  const { animationsEnabled } = useSettings();
  const [k, setK] = useState<ExerciseKnowledge | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState(0);
  const [w, setW] = useState(0);
  const pager = useRef<ScrollView>(null);

  // Sliding segmented indicator under the pills.
  const pillLayouts = useRef<{ x: number; width: number }[]>([]);
  const [measureTick, setMeasureTick] = useState(0);
  const thumbX = useRef(new Animated.Value(0)).current;
  const thumbW = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (idOrName) getExerciseKnowledge(idOrName).then((v) => { setK(v); setLoaded(true); });
  }, [idOrName]);

  useEffect(() => {
    const L = pillLayouts.current[tab];
    if (!L) return;
    if (animationsEnabled) {
      Animated.parallel([
        Animated.spring(thumbX, { toValue: L.x, useNativeDriver: false, speed: 20, bounciness: 8 }),
        Animated.spring(thumbW, { toValue: L.width, useNativeDriver: false, speed: 20, bounciness: 8 }),
      ]).start();
    } else {
      thumbX.setValue(L.x);
      thumbW.setValue(L.width);
    }
  }, [tab, measureTick, animationsEnabled, thumbX, thumbW]);

  const onPillLayout = (i: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    pillLayouts.current[i] = { x, width };
    setMeasureTick((t) => t + 1);
  };

  const goTab = (i: number) => {
    setTab(i);
    haptics.selection();
    pager.current?.scrollTo({ x: i * w, animated: true });
  };
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    if (i !== tab) { setTab(i); haptics.selection(); }
  };

  if (!loaded) return <View style={{ flex: 1 }} />;
  if (!k) return <Text style={styles.empty}>No details available for this exercise.</Text>;

  const meta = [k.level, k.mechanic, k.equipment].filter(Boolean).map(titleCase).join(' · ');

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>{k.name}</Text>
      {!!meta && <Text style={styles.meta}>{meta}</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pills} contentContainerStyle={styles.pillsContent}>
        <View style={styles.pillsInner}>
          <Animated.View pointerEvents="none" style={[styles.thumb, { transform: [{ translateX: thumbX }], width: thumbW }]} />
          {TABS.map((t, i) => (
            <Pressable key={t} onPress={() => goTab(i)} onLayout={(e) => onPillLayout(i, e)} style={styles.pill}>
              <Text style={[styles.pillText, tab === i && styles.pillTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={{ flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onMomentumEnd}>
            {/* How to */}
            <ScrollView style={{ width: w }} contentContainerStyle={styles.page}>
              {k.instructions.length === 0 ? (
                <Text style={styles.bodyMuted}>No step-by-step instructions available.</Text>
              ) : (
                k.instructions.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Muscles */}
            <ScrollView style={{ width: w }} contentContainerStyle={styles.page}>
              <Text style={styles.subLabel}>PRIMARY</Text>
              {k.primaryMuscles.length ? (
                <View style={styles.chipWrap}>
                  {k.primaryMuscles.map((m) => (
                    <View key={m} style={[styles.mChip, styles.mChipPrimary]}><Text style={styles.mChipPrimaryText}>{titleCase(m)}</Text></View>
                  ))}
                </View>
              ) : <Text style={styles.bodyMuted}>—</Text>}
              <Text style={[styles.subLabel, { marginTop: spacing.lg }]}>SECONDARY</Text>
              {k.secondaryMuscles.length ? (
                <View style={styles.chipWrap}>
                  {k.secondaryMuscles.map((m) => (
                    <View key={m} style={styles.mChip}><Text style={styles.mChipText}>{titleCase(m)}</Text></View>
                  ))}
                </View>
              ) : <Text style={styles.bodyMuted}>None</Text>}
            </ScrollView>

            {/* Science */}
            <ScrollView style={{ width: w }} contentContainerStyle={styles.page}>
              {k.emg ? (<><Text style={styles.subLabel}>EMG ACTIVATION</Text><Text style={styles.body}>{k.emg}</Text></>) : null}
              {k.science ? (<><Text style={[styles.subLabel, { marginTop: spacing.lg }]}>BIOMECHANICS</Text><Text style={styles.body}>{k.science}</Text></>) : null}
              <Text style={[styles.subLabel, { marginTop: spacing.lg }]}>DETAILS</Text>
              <Text style={styles.body}>
                {[
                  k.mechanic && `Mechanic: ${titleCase(k.mechanic)}`,
                  k.force && `Force: ${titleCase(k.force)}`,
                  k.level && `Level: ${titleCase(k.level)}`,
                  k.category && `Category: ${titleCase(k.category)}`,
                ].filter(Boolean).join('\n')}
              </Text>
              {!k.emg && !k.science && (
                <Text style={[styles.bodyMuted, { marginTop: spacing.md }]}>Detailed EMG/research data is available for our curated key lifts and will expand over time.</Text>
              )}
            </ScrollView>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text, letterSpacing: 0.5 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: 4 },
  pills: { marginTop: spacing.lg, flexGrow: 0, marginBottom: spacing.md },
  pillsContent: { paddingRight: spacing.xl },
  pillsInner: { flexDirection: 'row', position: 'relative', backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, padding: 3 },
  thumb: { position: 'absolute', top: 3, bottom: 3, borderRadius: radius.pill, backgroundColor: colors.amber },
  pill: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text2 },
  pillTextActive: { color: colors.onAmber },
  page: { paddingBottom: spacing.xxxl },
  subLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 1, marginBottom: spacing.sm },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 21 },
  bodyMuted: { fontFamily: fonts.regular, fontSize: 14, color: colors.text3, lineHeight: 21 },
  stepRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.amberDim, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.bold, fontSize: 13, color: colors.amber },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 21 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mChip: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  mChipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text2 },
  mChipPrimary: { backgroundColor: colors.amberDim },
  mChipPrimaryText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.amber },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.text2, textAlign: 'center', marginTop: spacing.xxxl },
});
