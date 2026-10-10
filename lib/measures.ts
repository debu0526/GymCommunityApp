/** Shared metadata for body measurements (labels, ranges, units). */
import type { MeasurementFields } from '@/db/database';

export type MeasureKind = 'weight' | 'len';
export type MeasureDef = { key: keyof MeasurementFields; label: string; kind: MeasureKind; min: number; max: number };

export const CM_PER_IN = 2.54;

/** Weight is kept separate (kg); the rest are lengths (cm/in). Canonical ranges in cm/kg. */
export const WEIGHT_DEF: MeasureDef = { key: 'weight', label: 'Weight', kind: 'weight', min: 30, max: 250 };
export const LENGTH_DEFS: MeasureDef[] = [
  { key: 'waist', label: 'Waist', kind: 'len', min: 40, max: 200 },
  { key: 'chest', label: 'Chest', kind: 'len', min: 50, max: 200 },
  { key: 'armL', label: 'Left arm', kind: 'len', min: 15, max: 70 },
  { key: 'armR', label: 'Right arm', kind: 'len', min: 15, max: 70 },
  { key: 'calves', label: 'Calves', kind: 'len', min: 20, max: 70 },
  { key: 'thighs', label: 'Thighs', kind: 'len', min: 30, max: 110 },
];
export const ALL_DEFS: MeasureDef[] = [WEIGHT_DEF, ...LENGTH_DEFS];

/** Round to one decimal for clean display. */
export const round1 = (n: number) => Math.round(n * 10) / 10;
