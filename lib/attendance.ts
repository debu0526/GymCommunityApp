/**
 * Pure date helpers for the attendance calendar and streaks.
 * No React, no DB — just functions, so they're easy to reason about and test.
 */

/** Format a Date as a local 'YYYY-MM-DD' string (the key we store attendance under). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** ISO date (YYYY-MM-DD) for `n` days before today. */
export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

/** ISO date (YYYY-MM-DD) for `m` months before today. */
export function monthsAgoISO(m: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return toISODate(d);
}

/** First day of the month for a given date. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** 'YYYY-MM' prefix used to filter a month's attendance. */
export function monthPrefix(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Format 'YYYY-MM-DD' as e.g. '5 Aug 2026'. */
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_SHORT[m - 1]} ${y}`;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Monday-first weekday headers. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Build a calendar grid for a month as a flat array of 42 cells (6 weeks).
 * `null` = empty pad cell; a number = that day of the month. Monday-first.
 */
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // convert Sun=0 to Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Current streak = consecutive workout days ending today (or yesterday, so the
 * streak isn't shown as broken before you've been to the gym today).
 *
 * Rest days bridge the streak: up to TWO consecutive rest days between workouts
 * are allowed. A third consecutive rest day, or any un-marked empty day, breaks it.
 * Only workout days add to the count; rest days keep it alive but don't increment.
 */
const MAX_CONSECUTIVE_REST = 2;

export function computeStreak(workouts: Set<string>, rest: Set<string> = new Set()): number {
  let streak = 0;
  let consecutiveRest = 0;
  const d = new Date();

  // Grace for today: if today isn't logged yet, don't count it as a break —
  // step back and evaluate from yesterday. A rest day today counts as a rest link.
  const today = toISODate(d);
  if (workouts.has(today)) {
    streak++;
  } else if (rest.has(today)) {
    consecutiveRest = 1;
  }
  d.setDate(d.getDate() - 1);

  while (true) {
    const key = toISODate(d);
    if (workouts.has(key)) {
      streak++;
      consecutiveRest = 0;
    } else if (rest.has(key)) {
      consecutiveRest++;
      if (consecutiveRest > MAX_CONSECUTIVE_REST) break;
    } else {
      break; // empty, un-marked day breaks the streak
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
