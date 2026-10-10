/**
 * Generic single-series line chart over time (1M/3M/6M/Max), styled like the
 * weight/BMI chart. Used for body-measurement progression. Values are pre-converted
 * to the display unit by the caller; `unit` is just the label shown in the readout.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Pressable } from 'react-native';
import Svg, { Polyline, Line, Circle, Rect, Text as SvgText, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, spacing, radius, fonts } from '@/theme/theme';
import { monthsAgoISO } from '@/lib/attendance';

export type MeasurePoint = { date: string; value: number };
type Timeframe = '1m' | '3m' | '6m' | 'max';

const HEIGHT = 240;
const PAD = { left: 40, right: 14, top: 16, bottom: 30 };
const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '1m', label: '1M' }, { key: '3m', label: '3M' }, { key: '6m', label: '6M' }, { key: 'max', label: 'Max' },
];

export function MeasureChart({ entries, unit, decimals = 1 }: { entries: MeasurePoint[]; unit: string; decimals?: number }) {
  const [width, setWidth] = useState(300);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('max');
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.max(e.nativeEvent.layout.width - spacing.lg * 2, 10));

  const cutoff = timeframe === 'max' ? null : monthsAgoISO(timeframe === '1m' ? 1 : timeframe === '3m' ? 3 : 6);
  const data = cutoff ? entries.filter((e) => e.date >= cutoff) : entries;
  useEffect(() => setSelected(null), [timeframe, data.length]);

  const values = data.map((e) => e.value);
  const times = data.map((e) => new Date(e.date).getTime());

  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const { ticks, niceMin, niceMax } = niceTicks(rawMin, rawMax, 5);
  const yMin = niceMin;
  const yMax = niceMax === niceMin ? niceMin + 1 : niceMax;

  const n = data.length;
  let tMin = times.length ? Math.min(...times) : 0;
  let tMax = times.length ? Math.max(...times) : 1;
  if (tMin === tMax) { tMin -= 86400000; tMax += 86400000; }
  const xForT = (t: number) => PAD.left + ((t - tMin) / (tMax - tMin)) * plotW;
  const yFor = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const points = values.map((v, i) => `${xForT(times[i])},${yFor(v)}`).join(' ');
  const areaPath = n > 0 ? `M ${xForT(times[0])} ${PAD.top + plotH} ` + values.map((v, i) => `L ${xForT(times[i])} ${yFor(v)}`).join(' ') + ` L ${xForT(times[n - 1])} ${PAD.top + plotH} Z` : '';
  const fmt = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(decimals));
  const latest = values.length ? values[values.length - 1] : null;
  const tickCount = n <= 1 ? 1 : 5;
  const xTicks = Array.from({ length: tickCount }, (_, k) => {
    const frac = tickCount === 1 ? 0.5 : k / (tickCount - 1);
    return { x: PAD.left + frac * plotW, t: tMin + frac * (tMax - tMin), anchor: (k === 0 ? 'start' : k === tickCount - 1 ? 'end' : 'middle') as 'start' | 'middle' | 'end' };
  });

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.tfRow}>
        {TIMEFRAMES.map((t) => (
          <Pressable key={t.key} onPress={() => setTimeframe(t.key)} style={[styles.tfChip, timeframe === t.key && styles.tfChipActive]}>
            <Text style={[styles.tfText, timeframe === t.key && styles.tfTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {n === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No entries in this range.</Text>
          <Text style={styles.emptySub}>Add measurements in the Log tab or widen the timeframe.</Text>
        </View>
      ) : (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="mfill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.amber} stopOpacity="0.20" />
              <Stop offset="1" stopColor={colors.amber} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {ticks.map((t) => {
            const y = yFor(t);
            if (y < PAD.top - 0.5 || y > PAD.top + plotH + 0.5) return null;
            return (
              <React.Fragment key={`g-${t}`}>
                <Line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y} stroke={colors.hairline} strokeWidth={1} opacity={0.5} />
                <SvgText x={PAD.left - 6} y={y + 3} fill={colors.text3} fontSize="9" textAnchor="end" fontFamily={fonts.medium}>{fmt(t)}</SvgText>
              </React.Fragment>
            );
          })}
          {xTicks.map((xt, i) => (
            <SvgText key={`xt-${i}`} x={xt.x} y={HEIGHT - 10} fill={colors.text3} fontSize="9" textAnchor={xt.anchor} fontFamily={fonts.medium}>{labelDate(xt.t)}</SvgText>
          ))}
          {n > 1 && <Path d={areaPath} fill="url(#mfill)" />}
          {n > 1 && <Polyline points={points} fill="none" stroke={colors.amber} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {values.map((v, i) => (
            <Circle key={`p-${i}`} cx={xForT(times[i])} cy={yFor(v)} r={selected === i ? 5 : 3} fill={colors.amber} stroke={selected === i ? colors.onAmber : 'none'} strokeWidth={selected === i ? 1.5 : 0} />
          ))}
          {selected != null && selected < n && (
            <Tooltip x={xForT(times[selected])} y={yFor(values[selected])} width={width} label={`${fmt(values[selected])} ${unit}`} date={labelDate(times[selected])} />
          )}
          {values.map((v, i) => (
            <Circle key={`h-${i}`} cx={xForT(times[i])} cy={yFor(v)} r={16} fill="transparent" onPress={() => setSelected(selected === i ? null : i)} />
          ))}
        </Svg>
      )}
      {latest != null && (
        <Text style={styles.latest}>
          {selected != null ? 'Selected' : 'Latest'}: <Text style={styles.latestVal}>{fmt(selected != null ? values[selected] : latest)} {unit}</Text> · tap a point
        </Text>
      )}
    </View>
  );
}

function Tooltip({ x, y, width, label, date }: { x: number; y: number; width: number; label: string; date: string }) {
  const w = 96; const h = 40;
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
});
