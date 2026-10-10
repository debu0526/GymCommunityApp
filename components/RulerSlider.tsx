/**
 * Horizontal ruler input. Scroll to set a value; a haptic ticks as each whole unit
 * passes the center line. Minor lines every 0.1, major (labelled) lines every whole unit.
 * A live readout floats above the center marker. Controlled via `value`/`onChange`.
 *
 * Uses a virtualized FlatList for the ticks, so a wide 0.1-resolution scale (thousands of
 * lines) only ever mounts the ~60 ticks on screen — smooth even with several rulers stacked.
 *
 * Smoothness: the slider is treated as uncontrolled *while the user scrolls* — an external
 * value change (typing, unit switch) snaps it, but the value it emits itself never snaps it
 * back mid-glide (that was the old "toggling between two values" bug).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { haptics } from '@/lib/haptics';
import { colors, fonts } from '@/theme/theme';

const PX = 9;   // pixels per 0.1 step
const H = 66;   // total height (readout + ruler + labels)

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function RulerSlider({ value, min, max, step = 0.1, unit = '', onChange }: {
  value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  const [w, setW] = useState(0);
  const ref = useRef<FlatList<number>>(null);
  const dragging = useRef(false);
  const lastEmitted = useRef<number | null>(null);
  const lastWhole = useRef(Math.round(value));
  const [display, setDisplay] = useState(value);

  const steps = Math.max(1, Math.round((max - min) / step));
  const data = useRef<number[]>([]);
  if (data.current.length !== steps + 1) data.current = Array.from({ length: steps + 1 }, (_, i) => i);
  const toOffset = (v: number) => ((v - min) / step) * PX;

  // Snap to an EXTERNAL value change only (skip echoes of our own emit, and skip while dragging).
  useEffect(() => {
    if (w <= 0 || dragging.current) return;
    if (lastEmitted.current != null && Math.abs(lastEmitted.current - value) < step / 2) {
      lastEmitted.current = null;
      setDisplay(value);
      return;
    }
    ref.current?.scrollToOffset({ offset: toOffset(value), animated: false });
    setDisplay(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, w]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / PX);
    let v = min + idx * step;
    v = Math.max(min, Math.min(max, Math.round(v * 10) / 10));
    if (v !== display) {
      setDisplay(v);
      const whole = Math.round(v);
      if (whole !== lastWhole.current) { lastWhole.current = whole; haptics.selection(); }
      lastEmitted.current = v;
      onChange(v);
    }
  };

  const renderItem = useCallback(({ item: i }: { item: number }) => {
    const major = i % 10 === 0;
    const mid = i % 5 === 0;
    return (
      <View style={styles.slot}>
        <View style={[styles.tick, { height: major ? 22 : mid ? 14 : 8, backgroundColor: major ? colors.text2 : colors.hairline }]} />
        {major && <Text style={styles.tickLabel} numberOfLines={1}>{Math.round(min + i * step)}</Text>}
      </View>
    );
  }, [min]);

  // Offset includes the w/2 left padding so FlatList's windowing matches what's actually on screen.
  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: PX, offset: PX * index + w / 2, index }), [w]);

  return (
    <View style={styles.box} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View pointerEvents="none" style={styles.readout}>
        <Text style={styles.readoutText}>{fmt(display)}{unit ? ` ${unit}` : ''}</Text>
      </View>
      {w > 0 && (
        <FlatList
          ref={ref}
          data={data.current}
          keyExtractor={(i) => String(i)}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="normal"
          onScroll={onScroll}
          onScrollBeginDrag={() => { dragging.current = true; }}
          onScrollEndDrag={() => { dragging.current = false; }}
          onMomentumScrollEnd={() => { dragging.current = false; }}
          contentContainerStyle={{ paddingHorizontal: w / 2 }}
          initialNumToRender={40}
          windowSize={5}
          removeClippedSubviews={false}
        />
      )}
      <View pointerEvents="none" style={styles.center} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: H, justifyContent: 'flex-end', overflow: 'hidden' },
  slot: { width: PX, height: H, alignItems: 'flex-start', justifyContent: 'flex-end' },
  tick: { position: 'absolute', bottom: 18, left: 0, width: 1.5 },
  tickLabel: { position: 'absolute', bottom: 0, left: -19, width: 40, textAlign: 'center', fontFamily: fonts.medium, fontSize: 10, color: colors.text3 },
  center: { position: 'absolute', left: '50%', width: 2, top: 22, bottom: 18, marginLeft: -1, backgroundColor: colors.amber, borderRadius: 1 },
  readout: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  readoutText: { fontFamily: fonts.bold, fontSize: 14, color: colors.amber },
});
