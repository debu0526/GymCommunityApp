/**
 * Weight-over-time line chart with a Weight / BMI toggle and a timeframe control
 * (1M / 3M / 6M / Max). Single amber series (2px). TIME-BASED x-axis so points sit at
 * their real date and the date labels are evenly spaced across the width. Data points
 * are tappable (tooltip). Dashed BMI/ideal-weight reference lines, labeled on the LEFT,
 * shown only when the profile has the needed metrics.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Pressable } from 'react-native';
import Svg, { Polyline, Line, Circle, Rect, Text as SvgText, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, spacing, radius, fonts } from '@/theme/theme';
import { PillButton } from '@/components/PillButton';
import type { WeightEntry } from '@/db/database';
import type { Gender } from '@/lib/health';
import { bmi, weightForBmi, idealBodyWeight, BMI_THRESHOLDS } from '@/lib/health';
import { monthsAgoISO } from '@/lib/attendance';

export type ChartMode = 'weight' | 'bmi';
type Timeframe = '1m' | '3m' | '6m' | 'max';
type RefLine = { value: number; label: string };

type Props = {
  entries: WeightEntry[]; // ascending by date
  mode: ChartMode;
  onModeChange: (m: ChartMode) => void;
  heightCm: number | null;
  gender: Gender | null;
};

const HEIGHT = 250;
const PAD = { left: 34, right: 14, top: 16, bottom: 30 };
const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: 'max', label: 'Max' },
];

export function WeightChart({ entries, mode, onModeChange, heightCm, gender }: Props) {
  const [width, setWidth] = useState(300);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('max');
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.max(e.nativeEvent.layout.width - spacing.lg * 2, 10));

  const hasHeight = heightCm != null && heightCm > 0;
  const bmiEnabled = hasHeight;
  const effectiveMode: ChartMode = mode === 'bmi' && !bmiEnabled ? 'weight' : mode;
  const isBmi = effectiveMode === 'bmi' && hasHeight;

  // Filter to the selected timeframe.
  const cutoff = timeframe === 'max' ? null : monthsAgoISO(timeframe === '1m' ? 1 : timeframe === '3m' ? 3 : 6);
  const data = cutoff ? entries.filter((e) => e.date >= cutoff) : entries;

  useEffect(() => setSelected(null), [effectiveMode, timeframe, data.length]);

  const values = data.map((e) => (isBmi ? bmi(e.weight, heightCm as number) : e.weight));
  const times = data.map((e) => new Date(e.date).getTime());

  // Reference lines.
  const refs: RefLine[] = [];
  if (isBmi) {
    for (const t of BMI_THRESHOLDS) refs.push({ value: t.value, label: t.label });
  } else if (effectiveMode === 'weight' && hasHeight) {
    for (const t of BMI_THRESHOLDS) refs.push({ value: weightForBmi(t.value, heightCm as number), label: t.label });
    if (gender) refs.push({ value: idealBodyWeight(heightCm as number, gender), label: 'Ideal' });
  }

  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const domainVals = [...values, ...refs.map((r) => r.value)];
  const rawMin = domainVals.length ? Math.min(...domainVals) : 0;
  const rawMax = domainVals.length ? Math.max(...domainVals) : 1;
  const { ticks, niceMin, niceMax } = niceTicks(rawMin, rawMax, 5);
  const yMin = niceMin;
  const yMax = niceMax === niceMin ? niceMin + 1 : niceMax;

  const n = data.length;
  let tMin = times.length ? Math.min(...times) : 0;
  let tMax = times.length ? Math.max(...times) : 1;
  if (tMin === tMax) { tMin -= 86400000; tMax += 86400000; } // single point → center it
  const xForT = (t: number) => PAD.left + ((t - tMin) / (tMax - tMin)) * plotW;
  const yFor = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const points = values.map((v, i) => `${xForT(times[i])},${yFor(v)}`).join(' ');
  const areaPath =
    n > 0
      ? `M ${xForT(times[0])} ${PAD.top + plotH} ` + values.map((v, i) => `L ${xForT(times[i])} ${yFor(v)}`).join(' ') + ` L ${xForT(times[n - 1])} ${PAD.top + plotH} Z`
      : '';

  const unit = isBmi ? '' : ' kg';
  const fmt = (v: number) => (isBmi ? v.toFixed(1) : Math.round(v).toString());
  const latest = values.length ? values[values.length - 1] : null;

  // Evenly spaced x-axis date labels (fixes uneven spacing).
  const tickCount = n <= 1 ? 1 : 5;
  const xTicks = Array.from({ length: tickCount }, (_, k) => {
    const frac = tickCount === 1 ? 0.5 : k / (tickCount - 1);
    return { x: PAD.left + frac * plotW, t: tMin + frac * (tMax - tMin), anchor: (k === 0 ? 'start' : k === tickCount - 1 ? 'end' : 'middle') as 'start' | 'middle' | 'end' };
  });

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>TREND</Text>
        <View style={styles.toggle}>
          <PillButton label="Weight" variant={effectiveMode === 'weight' ? 'primary' : 'ghost'} onPress={() => onModeChange('weight')} style={styles.toggleBtn} />
          <PillButton label="BMI" variant={effectiveMode === 'bmi' ? 'primary' : 'ghost'} onPress={() => bmiEnabled && onModeChange('bmi')} style={StyleSheet.flatten([styles.toggleBtn, !bmiEnabled && styles.disabled])} />
        </View>
      </View>

      {/* Timeframe control */}
      <View style={styles.tfRow}>
        {TIMEFRAMES.map((t) => (
          <Pressable key={t.key} onPress={() => setTimeframe(t.key)} style={[styles.tfChip, timeframe === t.key && styles.tfChipActive]}>
            <Text style={[styles.tfText, timeframe === t.key && styles.tfTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {n === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No check-ins in this range.</Text>
          <Text style={styles.emptySub}>Log a weight in the Log tab or widen the timeframe.</Text>
        </View>
      ) : (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.amber} stopOpacity="0.20" />
              <Stop offset="1" stopColor={colors.amber} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* horizontal gridlines + y labels */}
          {ticks.map((t) => {
            const y = yFor(t);
            if (y < PAD.top - 0.5 || y > PAD.top + plotH + 0.5) return null;
            return (
              <React.Fragment key={`grid-${t}`}>
                <Line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y} stroke={colors.hairline} strokeWidth={1} opacity={0.5} />
                <SvgText x={PAD.left - 6} y={y + 3} fill={colors.text3} fontSize="9" textAnchor="end" fontFamily={fonts.medium}>{fmt(t)}</SvgText>
              </React.Fragment>
            );
          })}

          {/* reference lines — labeled on the LEFT */}
          {refs.map((r) => {
            const y = yFor(r.value);
            if (y < PAD.top || y > PAD.top + plotH) return null;
            return (
              <React.Fragment key={`ref-${r.label}`}>
                <Line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y} stroke={colors.text2} strokeWidth={1} strokeDasharray="5 4" opacity={0.7} />
                <SvgText x={PAD.left + 3} y={y - 3} fill={colors.text2} fontSize="9" textAnchor="start" fontFamily={fonts.semibold}>{r.label}</SvgText>
              </React.Fragment>
            );
          })}

          {/* x-axis date labels (evenly spaced) */}
          {xTicks.map((xt, i) => (
            <SvgText key={`xt-${i}`} x={xt.x} y={HEIGHT - 10} fill={colors.text3} fontSize="9" textAnchor={xt.anchor} fontFamily={fonts.medium}>{labelDate(xt.t)}</SvgText>
          ))}

          {/* area + line */}
          {n > 1 && <Path d={areaPath} fill="url(#fill)" />}
          {n > 1 && <Polyline points={points} fill="none" stroke={colors.amber} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {values.map((v, i) => (
            <Circle key={`pt-${i}`} cx={xForT(times[i])} cy={yFor(v)} r={selected === i ? 5 : 3} fill={colors.amber} stroke={selected === i ? colors.onAmber : 'none'} strokeWidth={selected === i ? 1.5 : 0} />
          ))}

          {selected != null && selected < n && (
            <Tooltip x={xForT(times[selected])} y={yFor(values[selected])} width={width} label={`${fmt(values[selected])}${unit}${isBmi ? ' BMI' : ''}`} date={labelDate(times[selected])} />
          )}

          {/* hit targets */}
          {values.map((v, i) => (
            <Circle key={`hit-${i}`} cx={xForT(times[i])} cy={yFor(v)} r={16} fill="transparent" onPress={() => setSelected(selected === i ? null : i)} />
          ))}
        </Svg>
      )}

      {latest != null && (
        <Text style={styles.latest}>
          {selected != null ? 'Selected' : 'Latest'}:{' '}
          <Text style={styles.latestVal}>{fmt(selected != null ? values[selected] : latest)}{unit}</Text>
          {isBmi ? ' BMI' : ''} · tap a point for details
        </Text>
      )}
      {!bmiEnabled && <Text style={styles.note}>Add your height in Profile to unlock BMI and reference lines.</Text>}
    </View>
  );
}

function Tooltip({ x, y, width, label, date }: { x: number; y: number; width: number; label: string; date: string }) {
  const w = 92;
  const h = 40;
  const tx = Math.min(Math.max(x - w / 2, 2), width - w - 2);
  const above = y - h - 10 > 0;
  const ty = above ? y - h - 10 : y + 10;
  return (
    <>
      <Line x1={x} y1={PAD.top} x2={x} y2={PAD.top + (HEIGHT - PAD.top - PAD.bottom)} stroke={colors.text3} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
      <Rect x={tx} y={ty} width={w} height={h} rx={8} fill={colors.surface2} stroke={colors.hairline} strokeWidth={1} />
      <SvgText x={tx + w / 2} y={ty + 17} fill={colors.text} fontSize="13" textAnchor="middle" fontFamily={fonts.bold}>{label}</SvgText>
      <SvgText x={tx + w / 2} y={ty + 31} fill={colors.text2} fontSize="10" textAnchor="middle" fontFamily={fonts.regular}>{date}</SvgText>
    </>
  );
}

function labelDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function niceTicks(min: number, max: number, count: number): { ticks: number[]; niceMin: number; niceMax: number } {
  if (min === max) { min -= 1; max += 1; }
  const range = niceNum(max - min, false);
  const step = niceNum(range / Math.max(count - 1, 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) ticks.push(Math.round(v * 100) / 100);
  return { ticks, niceMin, niceMax };
}

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range || 1));
  const frac = (range || 1) / Math.pow(10, exp);
  let nf: number;
  if (round) nf = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  else nf = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nf * Math.pow(10, exp);
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: 0.5 },
  toggle: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  disabled: { opacity: 0.4 },
  tfRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  tfChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  tfChipActive: { backgroundColor: colors.amberDim },
  tfText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3 },
  tfTextActive: { color: colors.amber },
  empty: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: 4 },
  emptyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text2 },
  emptySub: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, textAlign: 'center' },
  latest: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: spacing.sm },
  latestVal: { fontFamily: fonts.bold, color: colors.text },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: spacing.xs },
});
