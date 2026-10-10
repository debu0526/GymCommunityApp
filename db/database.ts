/**
 * Local SQLite database — opens once, runs migrations, exposes typed helpers.
 * Everything is on-device and works fully offline (no cloud yet).
 *
 * Migration pattern: a `schema_version` row tracks how far we've upgraded.
 * Add future changes as new `if (version < N)` blocks — never edit old ones.
 */
import * as SQLite from 'expo-sqlite';
import type { Gender } from '@/lib/health';
import { newId } from '@/lib/id';
import catalogSeed from '@/assets/exercises.json';

const CATALOG_SEED = catalogSeed as {
  id: string;
  name: string;
  group: string;
  category: string;
  equipment: string;
  type: string;
  level: string;
  force: string;
  mechanic: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  emg: string | null;
  science: string | null;
  topPick: boolean;
  isPopular: boolean;
}[];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('gymapp.db');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);'
  );

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1;'
  );
  let version = row?.version ?? 0;

  // --- Migration 1: attendance ---
  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS attendance (
        date TEXT PRIMARY KEY NOT NULL,   -- 'YYYY-MM-DD'
        created_at TEXT NOT NULL
      );
    `);
    version = 1;
  }

  // --- Migration 2: profile, weight log, rest days ---
  if (version < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT,
        gender TEXT,            -- 'male' | 'female' | null
        age INTEGER,
        height_cm REAL,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS weight_log (
        date TEXT PRIMARY KEY NOT NULL,   -- 'YYYY-MM-DD'
        weight_kg REAL NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rest_days (
        date TEXT PRIMARY KEY NOT NULL,   -- 'YYYY-MM-DD'
        created_at TEXT NOT NULL
      );
    `);
    version = 2;
  }

  // --- Migration 3: workout logging (ADDITIVE — does not touch v1/v2 tables) ---
  if (version < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        muscle_group TEXT,
        equipment TEXT,
        type TEXT,
        top_pick INTEGER NOT NULL DEFAULT 0,
        is_custom INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workout_types (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        type TEXT,
        custom_type_name TEXT,
        started_at TEXT,
        ended_at TEXT,
        duration_sec INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workout_exercises (
        id TEXT PRIMARY KEY NOT NULL,
        workout_id TEXT NOT NULL,
        exercise_id TEXT,
        exercise_name TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sets (
        id TEXT PRIMARY KEY NOT NULL,
        workout_exercise_id TEXT NOT NULL,
        set_number INTEGER NOT NULL,
        reps INTEGER,
        weight_kg REAL,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS active_session (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        workout_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        is_paused INTEGER NOT NULL DEFAULT 0,
        paused_accum_sec INTEGER NOT NULL DEFAULT 0,
        last_paused_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id);
      CREATE INDEX IF NOT EXISTS idx_sets_we ON sets(workout_exercise_id);
      CREATE INDEX IF NOT EXISTS idx_workouts_ended ON workouts(ended_at);
    `);

    // Seed the exercise catalog from the bundled dataset (only if empty).
    const c = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercises;');
    if (!c || c.n === 0) {
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        for (const e of CATALOG_SEED) {
          await db.runAsync(
            'INSERT INTO exercises (id, name, muscle_group, equipment, type, top_pick, is_custom, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?);',
            newId(),
            e.name,
            e.group,
            e.equipment,
            e.type,
            e.topPick ? 1 : 0,
            now
          );
        }
      });
    }
    version = 3;
  }

  // --- Migration 4: settings (key/value) ---
  if (version < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
    `);
    version = 4;
  }

  // --- Migration 5: workout templates (premade plans) + supersets (ADDITIVE columns) ---
  if (version < 5) {
    await db.execAsync(`
      ALTER TABLE workouts ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE workout_exercises ADD COLUMN superset_group TEXT;
    `);
    version = 5;
  }

  // --- Migration 6: enriched exercise catalog (free-exercise-db, 873) + knowledge fields ---
  if (version < 6) {
    await db.execAsync(`
      ALTER TABLE exercises ADD COLUMN category TEXT;
      ALTER TABLE exercises ADD COLUMN level TEXT;
      ALTER TABLE exercises ADD COLUMN force TEXT;
      ALTER TABLE exercises ADD COLUMN mechanic TEXT;
      ALTER TABLE exercises ADD COLUMN primary_muscles TEXT;
      ALTER TABLE exercises ADD COLUMN secondary_muscles TEXT;
      ALTER TABLE exercises ADD COLUMN instructions TEXT;
      ALTER TABLE exercises ADD COLUMN emg TEXT;
      ALTER TABLE exercises ADD COLUMN science TEXT;
      ALTER TABLE exercises ADD COLUMN is_popular INTEGER NOT NULL DEFAULT 0;
    `);
    // Replace the non-custom catalog with the enriched dataset; keep user's custom exercises.
    await db.runAsync('DELETE FROM exercises WHERE is_custom = 0;');
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      for (const e of CATALOG_SEED) {
        await db.runAsync(
          `INSERT OR REPLACE INTO exercises
             (id, name, muscle_group, category, equipment, type, top_pick, is_popular, is_custom, created_at,
              level, force, mechanic, primary_muscles, secondary_muscles, instructions, emg, science)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          e.id, e.name, e.group, e.category, e.equipment, e.type, e.topPick ? 1 : 0, e.isPopular ? 1 : 0, now,
          e.level, e.force, e.mechanic,
          JSON.stringify(e.primaryMuscles), JSON.stringify(e.secondaryMuscles), JSON.stringify(e.instructions),
          e.emg, e.science
        );
      }
    });
    version = 6;
  }

  // --- Migration 7: body measurements (replaces plain weight logging) + exercise baselines ---
  if (version < 7) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS measurements (
        date TEXT PRIMARY KEY NOT NULL,
        weight_kg REAL,
        waist_cm REAL,
        chest_cm REAL,
        arm_l_cm REAL,
        arm_r_cm REAL,
        calves_cm REAL,
        thighs_cm REAL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS exercise_baseline (
        key TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        weight_kg REAL,
        reps INTEGER,
        created_at TEXT NOT NULL
      );
    `);
    // Carry existing weight check-ins into the new measurements table.
    await db.runAsync(
      'INSERT OR IGNORE INTO measurements (date, weight_kg, created_at) SELECT date, weight_kg, created_at FROM weight_log;'
    );
    version = 7;
  }

  // --- Migration 8: structured "how to improve next time" note (JSON) on workouts ---
  if (version < 8) {
    await db.execAsync('ALTER TABLE workouts ADD COLUMN improve TEXT;');
    version = 8;
  }

  // Persist the final version reached.
  if (row) {
    await db.runAsync('UPDATE schema_version SET version = ?;', version);
  } else {
    await db.runAsync('INSERT INTO schema_version (version) VALUES (?);', version);
  }
}

/* ------------------------------------------------------------------ */
/* Attendance (gym days) — mutually exclusive with rest days           */
/* ------------------------------------------------------------------ */

export async function getAllAttendance(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM attendance ORDER BY date ASC;'
  );
  return rows.map((r) => r.date);
}

/** Toggle a gym day. Marking one clears any rest day on that date. Returns new state. */
export async function toggleAttendance(dateISO: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ date: string }>(
    'SELECT date FROM attendance WHERE date = ?;',
    dateISO
  );
  if (existing) {
    await db.runAsync('DELETE FROM attendance WHERE date = ?;', dateISO);
    return false;
  }
  await db.runAsync('DELETE FROM rest_days WHERE date = ?;', dateISO); // mutually exclusive
  await db.runAsync(
    'INSERT INTO attendance (date, created_at) VALUES (?, ?);',
    dateISO,
    new Date().toISOString()
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Rest days — mutually exclusive with gym days                        */
/* ------------------------------------------------------------------ */

export async function getAllRestDays(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT date FROM rest_days ORDER BY date ASC;'
  );
  return rows.map((r) => r.date);
}

/** Toggle a rest day. Marking one clears any gym day on that date. Returns new state. */
export async function toggleRestDay(dateISO: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ date: string }>(
    'SELECT date FROM rest_days WHERE date = ?;',
    dateISO
  );
  if (existing) {
    await db.runAsync('DELETE FROM rest_days WHERE date = ?;', dateISO);
    return false;
  }
  await db.runAsync('DELETE FROM attendance WHERE date = ?;', dateISO); // mutually exclusive
  await db.runAsync(
    'INSERT INTO rest_days (date, created_at) VALUES (?, ?);',
    dateISO,
    new Date().toISOString()
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Body measurements (weight + circumferences). Weight feeds the BMI chart. */
/* ------------------------------------------------------------------ */

export type WeightEntry = { date: string; weight: number };
export type Measurement = {
  date: string;
  weight: number | null;
  waist: number | null;
  chest: number | null;
  armL: number | null;
  armR: number | null;
  calves: number | null;
  thighs: number | null;
};
export type MeasurementFields = Omit<Measurement, 'date'>;
export const MEASURE_KEYS: (keyof MeasurementFields)[] = ['weight', 'waist', 'chest', 'armL', 'armR', 'calves', 'thighs'];

function mapMeasurement(r: any): Measurement {
  return {
    date: r.date,
    weight: r.weight_kg ?? null,
    waist: r.waist_cm ?? null,
    chest: r.chest_cm ?? null,
    armL: r.arm_l_cm ?? null,
    armR: r.arm_r_cm ?? null,
    calves: r.calves_cm ?? null,
    thighs: r.thighs_cm ?? null,
  };
}

/** Weight series (kg) for the weight/BMI chart — derived from measurements. */
export async function getAllWeights(): Promise<WeightEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; weight_kg: number }>(
    'SELECT date, weight_kg FROM measurements WHERE weight_kg IS NOT NULL ORDER BY date ASC;'
  );
  return rows.map((r) => ({ date: r.date, weight: r.weight_kg }));
}

export async function getAllMeasurements(): Promise<Measurement[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM measurements ORDER BY date ASC;');
  return rows.map(mapMeasurement);
}

export async function getMeasurement(dateISO: string): Promise<Measurement | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>('SELECT * FROM measurements WHERE date = ?;', dateISO);
  return r ? mapMeasurement(r) : null;
}

/** Upsert a date's measurements. Provided fields overwrite; omitted fields are kept. */
export async function setMeasurement(dateISO: string, fields: Partial<MeasurementFields>): Promise<void> {
  const db = await getDb();
  const existing = (await getMeasurement(dateISO)) ?? { date: dateISO, weight: null, waist: null, chest: null, armL: null, armR: null, calves: null, thighs: null };
  const m = { ...existing, ...fields };
  await db.runAsync(
    `INSERT OR REPLACE INTO measurements (date, weight_kg, waist_cm, chest_cm, arm_l_cm, arm_r_cm, calves_cm, thighs_cm, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    dateISO, m.weight, m.waist, m.chest, m.armL, m.armR, m.calves, m.thighs, new Date().toISOString()
  );
}

export async function deleteMeasurement(dateISO: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM measurements WHERE date = ?;', dateISO);
}

/* ------------------------------------------------------------------ */
/* Per-exercise baseline (starting max, set on first log)              */
/* ------------------------------------------------------------------ */

export async function getBaseline(key: string): Promise<{ weight: number | null; reps: number | null; date: string } | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ weight_kg: number | null; reps: number | null; created_at: string }>(
    'SELECT weight_kg, reps, created_at FROM exercise_baseline WHERE key = ?;',
    key.toLowerCase()
  );
  return r ? { weight: r.weight_kg ?? null, reps: r.reps ?? null, date: (r.created_at || '').slice(0, 10) } : null;
}

export async function setBaseline(key: string, name: string, weightKg: number | null, reps: number | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO exercise_baseline (key, name, weight_kg, reps, created_at) VALUES (?, ?, ?, ?, ?);',
    key.toLowerCase(), name, weightKg, reps, new Date().toISOString()
  );
}

/* ------------------------------------------------------------------ */
/* Profile (single row, id = 1)                                        */
/* ------------------------------------------------------------------ */

export type Profile = {
  name: string | null;
  gender: Gender | null;
  age: number | null;
  heightCm: number | null;
};

export async function getProfile(): Promise<Profile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    name: string | null;
    gender: string | null;
    age: number | null;
    height_cm: number | null;
  }>('SELECT name, gender, age, height_cm FROM profile WHERE id = 1;');
  if (!row) return null;
  return {
    name: row.name,
    gender: (row.gender as Gender | null) ?? null,
    age: row.age,
    heightCm: row.height_cm,
  };
}

/* ------------------------------------------------------------------ */
/* Settings (key/value)                                                */
/* ------------------------------------------------------------------ */

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM settings WHERE key = ?;', key);
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);', key, value);
}

export async function saveProfile(p: Profile): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO profile (id, name, gender, age, height_cm, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       gender = excluded.gender,
       age = excluded.age,
       height_cm = excluded.height_cm,
       updated_at = excluded.updated_at;`,
    p.name,
    p.gender,
    p.age,
    p.heightCm,
    new Date().toISOString()
  );
}
