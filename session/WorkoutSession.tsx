/**
 * Active-workout session context. Holds the single in-progress workout, exposes a
 * live elapsed timer, and start/pause/resume/finish/discard. State is persisted in
 * SQLite (active_session), so an in-progress workout survives closing the app.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getActiveSession,
  startWorkout,
  startFromTemplate,
  pauseSession,
  resumeSession,
  finishWorkout,
  discardWorkout,
  type ActiveSession,
} from '@/db/workouts';

function computeElapsed(s: ActiveSession | null, nowMs: number): number {
  if (!s) return 0;
  const started = new Date(s.startedAt).getTime();
  let e = Math.floor((nowMs - started) / 1000) - s.pausedAccumSec;
  if (s.isPaused && s.lastPausedAt) {
    e -= Math.floor((nowMs - new Date(s.lastPausedAt).getTime()) / 1000);
  }
  return Math.max(0, e);
}

type Ctx = {
  session: ActiveSession | null;
  isActive: boolean;
  isPaused: boolean;
  elapsed: number;
  start: () => Promise<string | null>;
  startFrom: (templateId: string) => Promise<string>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<string | null>;
  discard: () => Promise<void>;
  refresh: () => Promise<void>;
};

const WorkoutSessionContext = createContext<Ctx | null>(null);

export function WorkoutSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  // `now` is READ by the elapsed calc below, so ticking it forces a real recompute
  // every second (a counter we never read would be optimized away by React Compiler).
  const [now, setNow] = useState(() => Date.now());

  // Restore any in-progress session on launch.
  useEffect(() => {
    getActiveSession().then(setSession).catch(() => {});
  }, []);

  // Tick every second while running (not while paused); refresh immediately on change.
  useEffect(() => {
    setNow(Date.now());
    if (!session || session.isPaused) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [session]);

  const start = useCallback(async () => {
    if (session) return session.workoutId;
    const r = await startWorkout();
    setSession({ workoutId: r.workoutId, startedAt: r.startedAt, isPaused: false, pausedAccumSec: 0, lastPausedAt: null });
    return r.workoutId;
  }, [session]);

  const startFrom = useCallback(async (templateId: string) => {
    const r = await startFromTemplate(templateId);
    setSession({ workoutId: r.workoutId, startedAt: r.startedAt, isPaused: false, pausedAccumSec: 0, lastPausedAt: null });
    return r.workoutId;
  }, []);

  const pause = useCallback(async () => {
    if (!session || session.isPaused) return;
    await pauseSession();
    setSession((s) => (s ? { ...s, isPaused: true, lastPausedAt: new Date().toISOString() } : s));
  }, [session]);

  const resume = useCallback(async () => {
    if (!session || !session.isPaused) return;
    await resumeSession();
    setSession(await getActiveSession());
  }, [session]);

  const finish = useCallback(async () => {
    if (!session) return null;
    const id = session.workoutId;
    await finishWorkout(id, computeElapsed(session, Date.now()));
    setSession(null);
    return id;
  }, [session]);

  const discard = useCallback(async () => {
    if (!session) return;
    await discardWorkout(session.workoutId);
    setSession(null);
  }, [session]);

  const refresh = useCallback(async () => {
    setSession(await getActiveSession());
  }, []);

  const value: Ctx = {
    session,
    isActive: !!session,
    isPaused: !!session?.isPaused,
    elapsed: computeElapsed(session, now),
    start,
    startFrom,
    pause,
    resume,
    finish,
    discard,
    refresh,
  };

  return <WorkoutSessionContext.Provider value={value}>{children}</WorkoutSessionContext.Provider>;
}

export function useWorkoutSession(): Ctx {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) throw new Error('useWorkoutSession must be used within WorkoutSessionProvider');
  return ctx;
}
