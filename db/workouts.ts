/**
 * Workout-logging data layer (Phase 2). Additive: uses the v3 tables only, and
 * never modifies attendance/weight/profile logic (it only INSERT-OR-IGNOREs an
 * attendance row when a workout is saved, per the confirmed auto-attendance rule).
 */
import { getDb } from '@/db/database';
import { newId } from '@/lib/id';
import { todayISO } from '@/lib/attendance';

/* ------------------------------- types ------------------------------- */

export type CatalogExercise = {
  id: string;
  name: string;
  group: string;
  category: string;
  equipment: string;
  type: string;
  topPick: boolean;
  isCustom: boolean;
};

export type ExerciseKnowledge = {
  id: string;
  name: string;
  group: string;
  category: string;
  equipment: string;
  level: string;
  mechanic: string;
  force: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  emg: string | null;
  science: string | null;
};

export type WorkoutSet = {
  id: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  completed: boolean;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string | null;
  name: string;
  position: number;
  supersetGroup: string | null;
  sets: WorkoutSet[];
};

export type TemplateSummary = { id: string; type: string | null; customTypeName: string | null; exerciseCount: number };

/** "How do you want to improve next time" — exercise names tagged under each goal. */
export type ImprovePlan = { moreReps: string[]; moreWeight: string[]; betterForm: string[] };
export const EMPTY_IMPROVE: ImprovePlan = { moreReps: [], moreWeight: [], betterForm: [] };
export function improveIsEmpty(p: ImprovePlan | null | undefined): boolean {
  return !p || (p.moreReps.length === 0 && p.moreWeight.length === 0 && p.betterForm.length === 0);
}
function parseImprove(raw: unknown): ImprovePlan | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const o = JSON.parse(raw);
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    const p: ImprovePlan = { moreReps: arr(o?.moreReps), moreWeight: arr(o?.moreWeight), betterForm: arr(o?.betterForm) };
    return improveIsEmpty(p) ? null : p;
  } catch { return null; }
}

export type Workout = {
  id: string;
  date: string;
  type: string | null;
  customTypeName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  notes: string | null;
  improve: ImprovePlan | null;
};

export type WorkoutDetail = { workout: Workout; exercises: WorkoutExercise[] };

export type ActiveSession = {
  workoutId: string;
  startedAt: string;
  isPaused: boolean;
  pausedAccumSec: number;
  lastPausedAt: string | null;
};

export type RecentWorkout = {
  id: string;
  date: string;
  type: string | null;
  customTypeName: string | null;
  durationSec: number | null;
  exerciseCount: number;
  setCount: number;
  volume: number;
};

export type PR = { exerciseName: string; weight: number; reps: number | null; date: string } | null;
export type HeaviestLift = { name: string; weight: number; reps: number | null; date: string };
export type MonthStats = { workouts: number; volume: number };

/* ---------------------------- presets/consts ---------------------------- */

/**
 * Selectable workout types (multi-select). Muscle-group types filter the exercise
 * picker by `groups`; category types filter by `category`. `competition` types are
 * hidden unless the user enables them in Settings.
 */
export type WorkoutTypeDef = { key: string; label: string; groups?: string[]; category?: string; competition?: boolean };
export const WORKOUT_TYPES: WorkoutTypeDef[] = [
  { key: 'push', label: 'Push Day', groups: ['Chest', 'Shoulders', 'Arms'] },
  { key: 'pull', label: 'Pull Day', groups: ['Back', 'Arms'] },
  { key: 'legs', label: 'Leg Day', groups: ['Legs'] },
  { key: 'upper', label: 'Upper Body', groups: ['Chest', 'Back', 'Shoulders', 'Arms'] },
  { key: 'lower', label: 'Lower Body', groups: ['Legs', 'Core'] },
  { key: 'full', label: 'Full Body', groups: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] },
  { key: 'chest', label: 'Chest', groups: ['Chest'] },
  { key: 'back', label: 'Back', groups: ['Back'] },
  { key: 'shoulders', label: 'Shoulders', groups: ['Shoulders'] },
  { key: 'arms', label: 'Arms', groups: ['Arms'] },
  { key: 'core', label: 'Abs & Core', groups: ['Core'] },
  { key: 'cardio', label: 'Cardio', category: 'cardio' },
  { key: 'plyometrics', label: 'Plyometrics', category: 'plyometrics' },
  { key: 'stretching', label: 'Stretching', category: 'stretching' },
  { key: 'powerlifting', label: 'Powerlifting', category: 'powerlifting', competition: true },
  { key: 'olympic', label: 'Olympic Lifting', category: 'olympic weightlifting', competition: true },
  { key: 'strongman', label: 'Strongman', category: 'strongman', competition: true },
];

export const MUSCLE_GROUPS = ['Chest', 'Shoulders', 'Arms', 'Back', 'Core', 'Legs'];

/** Display label for a workout's type (a comma-separated list of keys) + optional custom name. */
export function workoutTypeLabel(type: string | null, customName: string | null): string {
  const parts: string[] = [];
  if (type) {
    for (const k of type.split(',').filter(Boolean)) {
      const t = WORKOUT_TYPES.find((x) => x.key === k);
      if (t) parts.push(t.label);
    }
  }
  if (customName) parts.push(customName);
  return parts.length ? parts.join(' + ') : 'Workout';
}

/** Exercise-picker filter (muscle groups + categories) for a workout's selected types. */
export function typeFiltersFor(type: string | null): { groups: string[]; categories: string[] } {
  const groups = new Set<string>();
  const categories = new Set<string>();
  if (type) {
    for (const k of type.split(',').filter(Boolean)) {
      const t = WORKOUT_TYPES.find((x) => x.key === k);
      t?.groups?.forEach((g) => groups.add(g));
      if (t?.category) categories.add(t.category);
    }
  }
  return { groups: [...groups], categories: [...categories] };
}

/* ----------------------------- catalog ----------------------------- */

export async function searchCatalog(
  query: string,
  opts?: { groups?: string[]; categories?: string[]; limit?: number }
): Promise<CatalogExercise[]> {
  const db = await getDb();
  const limit = opts?.limit ?? 40;
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (query.trim()) {
    clauses.push('lower(name) LIKE ?');
    params.push(`%${query.trim().toLowerCase()}%`);
  }
  const groups = (opts?.groups ?? []).filter(Boolean);
  const cats = (opts?.categories ?? []).filter(Boolean);
  if (groups.length) {
    clauses.push(`muscle_group IN (${groups.map(() => '?').join(',')})`);
    params.push(...groups);
  }
  if (cats.length) {
    clauses.push(`category IN (${cats.map(() => '?').join(',')})`);
    params.push(...cats);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(limit);
  const rows = await db.getAllAsync<any>(
    `SELECT id, name, muscle_group, category, equipment, type, top_pick, is_custom
     FROM exercises ${where}
     ORDER BY is_popular DESC, top_pick DESC, name ASC LIMIT ?;`,
    ...params
  );
  return rows.map(mapCatalog);
}

/** Full knowledge for one exercise (by catalog id, else by name) — for the "how to" page. */
export async function getExerciseKnowledge(idOrName: string): Promise<ExerciseKnowledge | null> {
  const db = await getDb();
  let r = await db.getFirstAsync<any>('SELECT * FROM exercises WHERE id = ?;', idOrName);
  if (!r) r = await db.getFirstAsync<any>('SELECT * FROM exercises WHERE lower(name) = lower(?) LIMIT 1;', idOrName);
  if (!r) return null;
  const parse = (s: string | null): string[] => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
  return {
    id: r.id,
    name: r.name,
    group: r.muscle_group ?? '',
    category: r.category ?? '',
    equipment: r.equipment ?? '',
    level: r.level ?? '',
    mechanic: r.mechanic ?? '',
    force: r.force ?? '',
    primaryMuscles: parse(r.primary_muscles),
    secondaryMuscles: parse(r.secondary_muscles),
    instructions: parse(r.instructions),
    emg: r.emg ?? null,
    science: r.science ?? null,
  };
}

export async function createCustomExercise(name: string, group?: string | null): Promise<CatalogExercise> {
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    'INSERT INTO exercises (id, name, muscle_group, equipment, type, top_pick, is_custom, created_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?);',
    id,
    name.trim(),
    group ?? null,
    '',
    '',
    new Date().toISOString()
  );
  return { id, name: name.trim(), group: group ?? '', category: '', equipment: '', type: '', topPick: false, isCustom: true };
}

function mapCatalog(r: any): CatalogExercise {
  return {
    id: r.id,
    name: r.name,
    group: r.muscle_group ?? '',
    category: r.category ?? '',
    equipment: r.equipment ?? '',
    type: r.type ?? '',
    topPick: !!r.top_pick,
    isCustom: !!r.is_custom,
  };
}

/* ------------------------- active session ------------------------- */

export async function getActiveSession(): Promise<ActiveSession | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>('SELECT * FROM active_session WHERE id = 1;');
  if (!r) return null;
  return {
    workoutId: r.workout_id,
    startedAt: r.started_at,
    isPaused: !!r.is_paused,
    pausedAccumSec: r.paused_accum_sec ?? 0,
    lastPausedAt: r.last_paused_at ?? null,
  };
}

/** Create a fresh draft workout + active session. Caller ensures none is active. */
export async function startWorkout(): Promise<{ workoutId: string; startedAt: string }> {
  const db = await getDb();
  const id = newId();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO workouts (id, date, type, custom_type_name, started_at, ended_at, duration_sec, notes, created_at, updated_at) VALUES (?, ?, NULL, NULL, ?, NULL, NULL, NULL, ?, ?);',
    id,
    todayISO(),
    now,
    now,
    now
  );
  await db.runAsync(
    'INSERT OR REPLACE INTO active_session (id, workout_id, started_at, is_paused, paused_accum_sec, last_paused_at) VALUES (1, ?, ?, 0, 0, NULL);',
    id,
    now
  );
  return { workoutId: id, startedAt: now };
}

export async function pauseSession(): Promise<void> {
  const db = await getDb();
  const s = await getActiveSession();
  if (!s || s.isPaused) return;
  await db.runAsync('UPDATE active_session SET is_paused = 1, last_paused_at = ? WHERE id = 1;', new Date().toISOString());
}

export async function resumeSession(): Promise<void> {
  const db = await getDb();
  const s = await getActiveSession();
  if (!s || !s.isPaused) return;
  const extra = s.lastPausedAt ? Math.max(0, Math.floor((Date.now() - new Date(s.lastPausedAt).getTime()) / 1000)) : 0;
  await db.runAsync(
    'UPDATE active_session SET is_paused = 0, last_paused_at = NULL, paused_accum_sec = paused_accum_sec + ? WHERE id = 1;',
    extra
  );
}

/** Finish & save the workout: stamp duration, clear session, auto-mark the gym day. */
export async function finishWorkout(workoutId: string, durationSec: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE workouts SET ended_at = ?, duration_sec = ?, updated_at = ? WHERE id = ?;', now, durationSec, now, workoutId);
  const w = await db.getFirstAsync<{ date: string }>('SELECT date FROM workouts WHERE id = ?;', workoutId);
  if (w) {
    // auto-attendance (additive): mark the day as a gym day, clearing any rest day
    await db.runAsync('DELETE FROM rest_days WHERE date = ?;', w.date);
    await db.runAsync('INSERT OR IGNORE INTO attendance (date, created_at) VALUES (?, ?);', w.date, now);
  }
  await db.runAsync('DELETE FROM active_session WHERE id = 1;');
}

/** Discard an in-progress workout entirely. */
export async function discardWorkout(workoutId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?);',
      workoutId
    );
    await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?;', workoutId);
    await db.runAsync('DELETE FROM workouts WHERE id = ?;', workoutId);
    await db.runAsync('DELETE FROM active_session WHERE id = 1;');
  });
}

/** Exercises in this workout whose max weight beats every other logged workout (new PRs). */
export async function getNewPRsForWorkout(workoutId: string): Promise<{ name: string; weight: number }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT we.exercise_name AS name, MAX(s.weight_kg) AS weight
     FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     WHERE we.workout_id = ? AND s.weight_kg IS NOT NULL
     GROUP BY lower(we.exercise_name)
     HAVING weight > COALESCE((
        SELECT MAX(s2.weight_kg)
        FROM sets s2
        JOIN workout_exercises we2 ON s2.workout_exercise_id = we2.id
        JOIN workouts w2 ON we2.workout_id = w2.id
        WHERE w2.ended_at IS NOT NULL AND w2.id != ?
          AND lower(we2.exercise_name) = lower(we.exercise_name)
          AND s2.weight_kg IS NOT NULL
     ), 0);`,
    workoutId,
    workoutId
  );
  return rows.map((r) => ({ name: r.name, weight: r.weight }));
}

/** Permanently delete one or more finished workouts (and their exercises/sets). */
export async function deleteWorkouts(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const ph = ids.map(() => '?').join(',');
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM sets WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id IN (${ph}));`, ...ids);
    await db.runAsync(`DELETE FROM workout_exercises WHERE workout_id IN (${ph});`, ...ids);
    await db.runAsync(`DELETE FROM workouts WHERE id IN (${ph});`, ...ids);
  });
}

/* ------------------------------------------------------------------ */
/* Supersets (H1e)                                                     */
/* ------------------------------------------------------------------ */

export async function setExerciseSuperset(workoutExerciseId: string, group: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE workout_exercises SET superset_group = ? WHERE id = ?;', group, workoutExerciseId);
}

/* ------------------------------------------------------------------ */
/* Templates / premade workouts (H1d)                                  */
/* ------------------------------------------------------------------ */

/** Create an empty planned workout (template) — no timer, no active session. */
export async function createTemplate(): Promise<string> {
  const db = await getDb();
  const id = newId();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO workouts (id, date, type, custom_type_name, started_at, ended_at, duration_sec, notes, created_at, updated_at, is_template) VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, 1);',
    id,
    todayISO(),
    now,
    now
  );
  return id;
}

/** Free-tier cap on saved planned workouts / templates. */
export const TEMPLATE_LIMIT = 3;

export async function countTemplates(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM workouts WHERE is_template = 1;');
  return r?.c ?? 0;
}

/**
 * Save an in-progress (or any) workout as a reusable template, capturing ONLY the
 * exercise list (names + catalog id + superset grouping) — no sets/reps. Does not touch
 * the source workout. Returns the new template id.
 */
export async function saveWorkoutAsTemplate(sourceWorkoutId: string): Promise<string> {
  const db = await getDb();
  const src = await db.getFirstAsync<any>('SELECT * FROM workouts WHERE id = ?;', sourceWorkoutId);
  const now = new Date().toISOString();
  const id = newId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO workouts (id, date, type, custom_type_name, started_at, ended_at, duration_sec, notes, created_at, updated_at, is_template) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, 1);',
      id, todayISO(), src?.type ?? null, src?.custom_type_name ?? null, now, now
    );
    const wes = await db.getAllAsync<any>('SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY position ASC;', sourceWorkoutId);
    const groupMap = new Map<string, string>();
    for (const we of wes) {
      let grp: string | null = null;
      if (we.superset_group) {
        if (!groupMap.has(we.superset_group)) groupMap.set(we.superset_group, newId());
        grp = groupMap.get(we.superset_group)!;
      }
      // Exercises only — deliberately copy NO sets.
      await db.runAsync(
        'INSERT INTO workout_exercises (id, workout_id, exercise_id, exercise_name, position, created_at, superset_group) VALUES (?, ?, ?, ?, ?, ?, ?);',
        newId(), id, we.exercise_id ?? null, we.exercise_name, we.position, now, grp
      );
    }
  });
  return id;
}

export async function getTemplates(): Promise<TemplateSummary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT w.id, w.type, w.custom_type_name,
        (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS ec
     FROM workouts w
     WHERE w.is_template = 1
     ORDER BY w.updated_at DESC;`
  );
  return rows.map((r) => ({ id: r.id, type: r.type ?? null, customTypeName: r.custom_type_name ?? null, exerciseCount: r.ec ?? 0 }));
}

/** Begin a live workout from a template: copies type + exercises + sets, opens an active session. */
export async function startFromTemplate(templateId: string): Promise<{ workoutId: string; startedAt: string }> {
  const db = await getDb();
  const tpl = await db.getFirstAsync<any>('SELECT * FROM workouts WHERE id = ?;', templateId);
  const now = new Date().toISOString();
  const id = newId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO workouts (id, date, type, custom_type_name, started_at, ended_at, duration_sec, notes, created_at, updated_at, is_template) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 0);',
      id,
      todayISO(),
      tpl?.type ?? null,
      tpl?.custom_type_name ?? null,
      now,
      tpl?.notes ?? null,
      now,
      now
    );
    const wes = await db.getAllAsync<any>('SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY position ASC;', templateId);
    const groupMap = new Map<string, string>();
    for (const we of wes) {
      const newWeId = newId();
      let grp: string | null = null;
      if (we.superset_group) {
        if (!groupMap.has(we.superset_group)) groupMap.set(we.superset_group, newId());
        grp = groupMap.get(we.superset_group)!;
      }
      await db.runAsync(
        'INSERT INTO workout_exercises (id, workout_id, exercise_id, exercise_name, position, created_at, superset_group) VALUES (?, ?, ?, ?, ?, ?, ?);',
        newWeId, id, we.exercise_id ?? null, we.exercise_name, we.position, now, grp
      );
      const sets = await db.getAllAsync<any>('SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY set_number ASC;', we.id);
      for (const s of sets) {
        await db.runAsync(
          'INSERT INTO sets (id, workout_exercise_id, set_number, reps, weight_kg, completed, created_at) VALUES (?, ?, ?, ?, ?, 0, ?);',
          newId(), newWeId, s.set_number, s.reps, s.weight_kg, now
        );
      }
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO active_session (id, workout_id, started_at, is_paused, paused_accum_sec, last_paused_at) VALUES (1, ?, ?, 0, 0, NULL);',
      id, now
    );
  });
  return { workoutId: id, startedAt: now };
}

/* ------------------------- building a workout ------------------------- */

/** Set the workout's selected types (list of keys) and optional custom name. */
export async function setWorkoutTypes(workoutId: string, keys: string[], customName?: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE workouts SET type = ?, custom_type_name = ?, updated_at = ? WHERE id = ?;',
    keys.join(','),
    customName ?? null,
    new Date().toISOString(),
    workoutId
  );
}

export async function setWorkoutNotes(workoutId: string, notes: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE workouts SET notes = ?, updated_at = ? WHERE id = ?;', notes, new Date().toISOString(), workoutId);
}

/** Save the structured "improve next time" plan (or clear it when empty). */
export async function setWorkoutImprove(workoutId: string, plan: ImprovePlan): Promise<void> {
  const db = await getDb();
  const json = improveIsEmpty(plan) ? null : JSON.stringify(plan);
  await db.runAsync('UPDATE workouts SET improve = ?, updated_at = ? WHERE id = ?;', json, new Date().toISOString(), workoutId);
}

export async function addExercise(workoutId: string, name: string, exerciseId?: string | null): Promise<string> {
  const db = await getDb();
  const id = newId();
  const pos = await db.getFirstAsync<{ p: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM workout_exercises WHERE workout_id = ?;',
    workoutId
  );
  await db.runAsync(
    'INSERT INTO workout_exercises (id, workout_id, exercise_id, exercise_name, position, created_at) VALUES (?, ?, ?, ?, ?, ?);',
    id,
    workoutId,
    exerciseId ?? null,
    name,
    pos?.p ?? 0,
    new Date().toISOString()
  );
  return id;
}

export async function removeExercise(workoutExerciseId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sets WHERE workout_exercise_id = ?;', workoutExerciseId);
  await db.runAsync('DELETE FROM workout_exercises WHERE id = ?;', workoutExerciseId);
}

export async function addSet(workoutExerciseId: string, reps: number | null, weight: number | null): Promise<string> {
  const db = await getDb();
  const id = newId();
  const n = await db.getFirstAsync<{ n: number }>(
    'SELECT COALESCE(MAX(set_number), 0) + 1 AS n FROM sets WHERE workout_exercise_id = ?;',
    workoutExerciseId
  );
  await db.runAsync(
    'INSERT INTO sets (id, workout_exercise_id, set_number, reps, weight_kg, completed, created_at) VALUES (?, ?, ?, ?, ?, 0, ?);',
    id,
    workoutExerciseId,
    n?.n ?? 1,
    reps,
    weight,
    new Date().toISOString()
  );
  return id;
}

export async function updateSet(setId: string, reps: number | null, weight: number | null): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE sets SET reps = ?, weight_kg = ? WHERE id = ?;', reps, weight, setId);
}

export async function setSetCompleted(setId: string, completed: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE sets SET completed = ? WHERE id = ?;', completed ? 1 : 0, setId);
}

export async function deleteSet(setId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sets WHERE id = ?;', setId);
}

/* --------------------------- reading detail --------------------------- */

export async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail | null> {
  const db = await getDb();
  const w = await db.getFirstAsync<any>('SELECT * FROM workouts WHERE id = ?;', workoutId);
  if (!w) return null;
  const wes = await db.getAllAsync<any>(
    'SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY position ASC;',
    workoutId
  );
  const exercises: WorkoutExercise[] = [];
  for (const we of wes) {
    const sets = await db.getAllAsync<any>(
      'SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY set_number ASC;',
      we.id
    );
    exercises.push({
      id: we.id,
      exerciseId: we.exercise_id ?? null,
      name: we.exercise_name,
      position: we.position,
      supersetGroup: we.superset_group ?? null,
      sets: sets.map((s) => ({ id: s.id, setNumber: s.set_number, reps: s.reps, weight: s.weight_kg, completed: !!s.completed })),
    });
  }
  return {
    workout: {
      id: w.id,
      date: w.date,
      type: w.type ?? null,
      customTypeName: w.custom_type_name ?? null,
      startedAt: w.started_at ?? null,
      endedAt: w.ended_at ?? null,
      durationSec: w.duration_sec ?? null,
      notes: w.notes ?? null,
      improve: parseImprove(w.improve),
    },
    exercises,
  };
}

/* ----------------------------- queries ----------------------------- */

export async function getRecentWorkouts(limit = 3): Promise<RecentWorkout[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT w.id, w.date, w.type, w.custom_type_name, w.duration_sec,
        (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exercise_count,
        (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON s.workout_exercise_id = we.id WHERE we.workout_id = w.id) AS set_count,
        (SELECT COALESCE(SUM(s.reps * s.weight_kg), 0) FROM sets s JOIN workout_exercises we ON s.workout_exercise_id = we.id WHERE we.workout_id = w.id) AS volume
     FROM workouts w
     WHERE w.ended_at IS NOT NULL
     ORDER BY w.ended_at DESC
     LIMIT ?;`,
    limit
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    type: r.type ?? null,
    customTypeName: r.custom_type_name ?? null,
    durationSec: r.duration_sec ?? null,
    exerciseCount: r.exercise_count ?? 0,
    setCount: r.set_count ?? 0,
    volume: r.volume ?? 0,
  }));
}

/** Finished workouts, newest first, optionally only those on/after `sinceISO` (YYYY-MM-DD). */
export async function getWorkoutHistory(sinceISO?: string, limit = 500): Promise<RecentWorkout[]> {
  const db = await getDb();
  const where = sinceISO
    ? 'WHERE w.ended_at IS NOT NULL AND w.date >= ?'
    : 'WHERE w.ended_at IS NOT NULL';
  const params: (string | number)[] = sinceISO ? [sinceISO, limit] : [limit];
  const rows = await db.getAllAsync<any>(
    `SELECT w.id, w.date, w.type, w.custom_type_name, w.duration_sec,
        (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exercise_count,
        (SELECT COUNT(*) FROM sets s JOIN workout_exercises we ON s.workout_exercise_id = we.id WHERE we.workout_id = w.id) AS set_count,
        (SELECT COALESCE(SUM(s.reps * s.weight_kg), 0) FROM sets s JOIN workout_exercises we ON s.workout_exercise_id = we.id WHERE we.workout_id = w.id) AS volume
     FROM workouts w
     ${where}
     ORDER BY w.ended_at DESC
     LIMIT ?;`,
    ...params
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    type: r.type ?? null,
    customTypeName: r.custom_type_name ?? null,
    durationSec: r.duration_sec ?? null,
    exerciseCount: r.exercise_count ?? 0,
    setCount: r.set_count ?? 0,
    volume: r.volume ?? 0,
  }));
}

/** Sets (reps + weight) from the most recent finished workout that used this exercise. */
export async function getLastSessionSets(
  exerciseId: string | null,
  exerciseName: string
): Promise<{ reps: number | null; weight: number | null }[]> {
  const db = await getDb();
  const match = exerciseId
    ? '(we.exercise_id = ? OR lower(we.exercise_name) = lower(?))'
    : 'lower(we.exercise_name) = lower(?)';
  const matchParams = exerciseId ? [exerciseId, exerciseName] : [exerciseName];
  const we = await db.getFirstAsync<{ id: string }>(
    `SELECT we.id
     FROM workout_exercises we
     JOIN workouts w ON we.workout_id = w.id
     WHERE w.ended_at IS NOT NULL AND ${match}
     ORDER BY w.ended_at DESC
     LIMIT 1;`,
    ...matchParams
  );
  if (!we) return [];
  const rows = await db.getAllAsync<{ reps: number | null; weight_kg: number | null }>(
    'SELECT reps, weight_kg FROM sets WHERE workout_exercise_id = ? ORDER BY set_number ASC;',
    we.id
  );
  return rows.map((r) => ({ reps: r.reps, weight: r.weight_kg }));
}

/** Max-weight set (weight + reps + date) from the most recent finished workout with this exercise. */
export async function getExerciseLastMax(
  exerciseId: string | null,
  exerciseName: string
): Promise<{ weight: number; reps: number | null; date: string } | null> {
  const db = await getDb();
  const match = exerciseId ? '(we.exercise_id = ? OR lower(we.exercise_name) = lower(?))' : 'lower(we.exercise_name) = lower(?)';
  const mp = exerciseId ? [exerciseId, exerciseName] : [exerciseName];
  const w = await db.getFirstAsync<{ id: string; date: string }>(
    `SELECT w.id, w.date FROM workout_exercises we JOIN workouts w ON we.workout_id = w.id
     WHERE w.ended_at IS NOT NULL AND ${match} ORDER BY w.ended_at DESC LIMIT 1;`,
    ...mp
  );
  if (!w) return null;
  const s = await db.getFirstAsync<{ weight: number; reps: number | null }>(
    `SELECT weight_kg AS weight, reps FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     WHERE we.workout_id = ? AND ${match.replace(/we\./g, 'we.')} AND s.weight_kg IS NOT NULL
     ORDER BY s.weight_kg DESC LIMIT 1;`,
    w.id, ...mp
  );
  if (!s) return null;
  return { weight: s.weight, reps: s.reps, date: w.date };
}

/**
 * All-time heaviest single set (weight + its reps) for an exercise across all finished
 * workouts — the "PR to smash". Ties on weight break toward the most reps.
 */
export async function getExerciseMaxSet(
  exerciseId: string | null,
  exerciseName: string
): Promise<{ weight: number; reps: number | null } | null> {
  const db = await getDb();
  const match = exerciseId ? '(we.exercise_id = ? OR lower(we.exercise_name) = lower(?))' : 'lower(we.exercise_name) = lower(?)';
  const mp = exerciseId ? [exerciseId, exerciseName] : [exerciseName];
  const r = await db.getFirstAsync<{ weight: number; reps: number | null }>(
    `SELECT s.weight_kg AS weight, s.reps AS reps FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     JOIN workouts w ON we.workout_id = w.id
     WHERE w.ended_at IS NOT NULL AND ${match} AND s.weight_kg IS NOT NULL
     ORDER BY s.weight_kg DESC, s.reps DESC LIMIT 1;`,
    ...mp
  );
  return r ? { weight: r.weight, reps: r.reps } : null;
}

/** Per-session best set (max weight + its reps) for an exercise, ascending by date — for the progression chart. */
export async function getExerciseProgression(
  exerciseId: string | null,
  exerciseName: string
): Promise<{ date: string; weight: number; reps: number | null }[]> {
  const db = await getDb();
  const match = exerciseId ? '(we.exercise_id = ? OR lower(we.exercise_name) = lower(?))' : 'lower(we.exercise_name) = lower(?)';
  const mp = exerciseId ? [exerciseId, exerciseName] : [exerciseName];
  const rows = await db.getAllAsync<{ date: string; weight: number; reps: number | null }>(
    `SELECT w.date AS date, MAX(s.weight_kg) AS weight, s.reps AS reps
     FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     JOIN workouts w ON we.workout_id = w.id
     WHERE w.ended_at IS NOT NULL AND ${match} AND s.weight_kg IS NOT NULL
     GROUP BY w.id
     ORDER BY w.date ASC;`,
    ...mp
  );
  return rows.map((r) => ({ date: r.date, weight: r.weight, reps: r.reps }));
}

export type LoggedExercise = {
  key: string;            // lowercased name — stable grouping key
  name: string;           // display name (most recent spelling)
  exerciseId: string | null;
  sessions: number;       // number of finished workouts featuring this exercise
  sets: number;           // total sets logged across all sessions
  weightedSets: number;   // sets that recorded a weight (→ has a progression trend)
  maxWeight: number | null; // heaviest single set ever (kg), null if bodyweight-only
  lastDate: string;       // most recent date performed (YYYY-MM-DD)
};

/** Every exercise that appears in a finished workout, grouped by name, most-recent first. */
export async function getLoggedExercises(): Promise<LoggedExercise[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT lower(we.exercise_name) AS key,
        (SELECT we2.exercise_name FROM workout_exercises we2 JOIN workouts w2 ON we2.workout_id = w2.id
           WHERE lower(we2.exercise_name) = lower(we.exercise_name) AND w2.ended_at IS NOT NULL
           ORDER BY w2.ended_at DESC LIMIT 1) AS name,
        MAX(we.exercise_id) AS exercise_id,
        COUNT(DISTINCT w.id) AS sessions,
        COUNT(s.id) AS sets,
        SUM(CASE WHEN s.weight_kg IS NOT NULL THEN 1 ELSE 0 END) AS weighted_sets,
        MAX(s.weight_kg) AS max_weight,
        MAX(w.date) AS last_date
     FROM workout_exercises we
     JOIN workouts w ON we.workout_id = w.id
     LEFT JOIN sets s ON s.workout_exercise_id = we.id
     WHERE w.ended_at IS NOT NULL
     GROUP BY lower(we.exercise_name)
     ORDER BY last_date DESC, name ASC;`
  );
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    exerciseId: r.exercise_id ?? null,
    sessions: r.sessions ?? 0,
    sets: r.sets ?? 0,
    weightedSets: r.weighted_sets ?? 0,
    maxWeight: r.max_weight ?? null,
    lastDate: r.last_date,
  }));
}

export type ExerciseLogSet = { setNumber: number; reps: number | null; weight: number | null };
export type ExerciseLogSession = {
  workoutId: string;
  date: string;
  type: string | null;
  customTypeName: string | null;
  sets: ExerciseLogSet[];
};

/** Per-session log for a single exercise (every set of every finished workout), newest first. */
export async function getExerciseLog(exerciseId: string | null, exerciseName: string): Promise<ExerciseLogSession[]> {
  const db = await getDb();
  const match = exerciseId
    ? '(we.exercise_id = ? OR lower(we.exercise_name) = lower(?))'
    : 'lower(we.exercise_name) = lower(?)';
  const mp = exerciseId ? [exerciseId, exerciseName] : [exerciseName];
  const rows = await db.getAllAsync<any>(
    `SELECT w.id AS workout_id, w.date AS date, w.type AS type, w.custom_type_name AS custom_type_name,
        w.ended_at AS ended_at,
        s.set_number AS set_number, s.reps AS reps, s.weight_kg AS weight
     FROM workout_exercises we
     JOIN workouts w ON we.workout_id = w.id
     LEFT JOIN sets s ON s.workout_exercise_id = we.id
     WHERE w.ended_at IS NOT NULL AND ${match}
     ORDER BY w.ended_at DESC, we.position ASC, s.set_number ASC;`,
    ...mp
  );
  // Group consecutive rows by workout id (query is already ordered by ended_at desc).
  const out: ExerciseLogSession[] = [];
  const byId = new Map<string, ExerciseLogSession>();
  for (const r of rows) {
    let sess = byId.get(r.workout_id);
    if (!sess) {
      sess = { workoutId: r.workout_id, date: r.date, type: r.type ?? null, customTypeName: r.custom_type_name ?? null, sets: [] };
      byId.set(r.workout_id, sess);
      out.push(sess);
    }
    if (r.set_number != null) sess.sets.push({ setNumber: r.set_number, reps: r.reps ?? null, weight: r.weight ?? null });
  }
  return out;
}

/** Heaviest single set for an exercise whose name matches the keyword (e.g. 'deadlift'). */
export async function getPR(keyword: string): Promise<PR> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>(
    `SELECT we.exercise_name AS name, s.weight_kg AS weight, s.reps AS reps, w.date AS date
     FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     JOIN workouts w ON we.workout_id = w.id
     WHERE w.ended_at IS NOT NULL AND s.weight_kg IS NOT NULL AND lower(we.exercise_name) LIKE ?
     ORDER BY s.weight_kg DESC, s.reps DESC
     LIMIT 1;`,
    `%${keyword.toLowerCase()}%`
  );
  if (!r) return null;
  return { exerciseName: r.name, weight: r.weight, reps: r.reps, date: r.date };
}

/** Heaviest weight recorded for every distinct exercise ever logged. */
export async function getHeaviestLifts(): Promise<HeaviestLift[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT name, weight, reps, date FROM (
        SELECT we.exercise_name AS name, s.weight_kg AS weight, s.reps AS reps, w.date AS date,
          ROW_NUMBER() OVER (PARTITION BY lower(we.exercise_name) ORDER BY s.weight_kg DESC, s.reps DESC) AS rn
        FROM sets s
        JOIN workout_exercises we ON s.workout_exercise_id = we.id
        JOIN workouts w ON we.workout_id = w.id
        WHERE w.ended_at IS NOT NULL AND s.weight_kg IS NOT NULL
     ) WHERE rn = 1
     ORDER BY weight DESC;`
  );
  return rows.map((r) => ({ name: r.name, weight: r.weight, reps: r.reps, date: r.date }));
}

/** Total finished workouts and total volume (Σ reps×weight) for a 'YYYY-MM' month. */
export async function getMonthStats(monthPrefix: string): Promise<MonthStats> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>(
    `SELECT
        (SELECT COUNT(*) FROM workouts w WHERE w.ended_at IS NOT NULL AND substr(w.date,1,7) = ?) AS workouts,
        (SELECT COALESCE(SUM(s.reps * s.weight_kg), 0)
           FROM sets s
           JOIN workout_exercises we ON s.workout_exercise_id = we.id
           JOIN workouts w ON we.workout_id = w.id
           WHERE w.ended_at IS NOT NULL AND substr(w.date,1,7) = ?) AS volume;`,
    monthPrefix,
    monthPrefix
  );
  return { workouts: r?.workouts ?? 0, volume: r?.volume ?? 0 };
}

/** Volume (Σ reps×weight) per muscle group, optionally scoped to a 'YYYY-MM' month. */
export async function getMuscleGroupVolume(monthPrefix?: string): Promise<{ group: string; volume: number }[]> {
  const db = await getDb();
  const where = monthPrefix
    ? "WHERE w.ended_at IS NOT NULL AND substr(w.date,1,7) = ?"
    : 'WHERE w.ended_at IS NOT NULL';
  const params: string[] = monthPrefix ? [monthPrefix] : [];
  const rows = await db.getAllAsync<any>(
    `SELECT COALESCE(ex.muscle_group, 'Other') AS grp, COALESCE(SUM(s.reps * s.weight_kg), 0) AS volume
     FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     JOIN workouts w ON we.workout_id = w.id
     LEFT JOIN exercises ex ON we.exercise_id = ex.id
     ${where}
     GROUP BY grp
     HAVING volume > 0
     ORDER BY volume DESC;`,
    ...params
  );
  return rows.map((r) => ({ group: r.grp, volume: r.volume }));
}

export type MuscleBreakdown = { group: string; sets: number; volume: number; lastDate: string | null };

/**
 * Per-muscle-group breakdown for the H2b charts: working-set count + volume within a
 * window (finished workouts on/after `sinceISO`), plus the all-time last-trained date
 * (for imbalance warnings). Returns one row per canonical MUSCLE_GROUP, in that order.
 */
export async function getMuscleGroupBreakdown(sinceISO: string): Promise<MuscleBreakdown[]> {
  const db = await getDb();
  const winRows = await db.getAllAsync<any>(
    `SELECT COALESCE(ex.muscle_group, 'Other') AS grp, COUNT(s.id) AS sets, COALESCE(SUM(s.reps * s.weight_kg), 0) AS volume
     FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     JOIN workouts w ON we.workout_id = w.id
     LEFT JOIN exercises ex ON we.exercise_id = ex.id
     WHERE w.ended_at IS NOT NULL AND w.date >= ?
     GROUP BY grp;`,
    sinceISO
  );
  const lastRows = await db.getAllAsync<any>(
    `SELECT COALESCE(ex.muscle_group, 'Other') AS grp, MAX(w.date) AS last_date
     FROM workout_exercises we
     JOIN workouts w ON we.workout_id = w.id
     LEFT JOIN exercises ex ON we.exercise_id = ex.id
     WHERE w.ended_at IS NOT NULL
     GROUP BY grp;`
  );
  const win = new Map<string, { sets: number; volume: number }>(winRows.map((r) => [r.grp, { sets: r.sets ?? 0, volume: r.volume ?? 0 }]));
  const last = new Map<string, string>(lastRows.map((r) => [r.grp, r.last_date]));
  return MUSCLE_GROUPS.map((g) => ({
    group: g,
    sets: win.get(g)?.sets ?? 0,
    volume: win.get(g)?.volume ?? 0,
    lastDate: last.get(g) ?? null,
  }));
}
