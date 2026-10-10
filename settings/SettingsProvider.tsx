/**
 * App settings context. Currently: animationsEnabled — a toggle to disable
 * animations on low-capability phones (keeps the app light). Persisted in SQLite.
 * Any component that animates should gate on useSettings().animationsEnabled.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSetting, setSetting } from '@/db/database';

const ANIM_KEY = 'animations_enabled';
const REST_KEY = 'rest_seconds';
const COMP_KEY = 'competition_types';
const UNIT_KEY = 'measure_unit';
const GOAL_KEY = 'training_goal';
const SHARE_FINISH_KEY = 'share_on_finish';
const SHARE_FIELDS_KEY = 'share_card_fields';
const DEFAULT_REST = 90;

export type MeasureUnit = 'cm' | 'in';
export type TrainingGoal = 'strength' | 'hypertrophy';
/** Which fields appear on the shareable workout card. */
export type ShareCardFields = { title: boolean; bestLift: boolean; streak: boolean; date: boolean; quote: boolean };
export const DEFAULT_SHARE_FIELDS: ShareCardFields = { title: true, bestLift: true, streak: true, date: true, quote: true };

type Ctx = {
  animationsEnabled: boolean;
  setAnimationsEnabled: (v: boolean) => void;
  restSeconds: number;
  setRestSeconds: (v: number) => void;
  competitionTypesEnabled: boolean;
  setCompetitionTypesEnabled: (v: boolean) => void;
  measureUnit: MeasureUnit;
  setMeasureUnit: (v: MeasureUnit) => void;
  trainingGoal: TrainingGoal;
  setTrainingGoal: (v: TrainingGoal) => void;
  shareOnFinish: boolean;
  setShareOnFinish: (v: boolean) => void;
  shareCardFields: ShareCardFields;
  setShareCardField: (key: keyof ShareCardFields, value: boolean) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [animationsEnabled, setAnimations] = useState(true);
  const [restSeconds, setRest] = useState(DEFAULT_REST);
  const [competitionTypesEnabled, setComp] = useState(false);
  const [measureUnit, setUnit] = useState<MeasureUnit>('cm');
  const [trainingGoal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [shareOnFinish, setShareFinish] = useState(true);
  const [shareCardFields, setShareFields] = useState<ShareCardFields>(DEFAULT_SHARE_FIELDS);

  useEffect(() => {
    getSetting(ANIM_KEY).then((v) => { if (v != null) setAnimations(v === '1'); }).catch(() => {});
    getSetting(REST_KEY).then((v) => { const n = v != null ? parseInt(v, 10) : NaN; if (!isNaN(n) && n > 0) setRest(n); }).catch(() => {});
    getSetting(COMP_KEY).then((v) => { if (v != null) setComp(v === '1'); }).catch(() => {});
    getSetting(UNIT_KEY).then((v) => { if (v === 'in' || v === 'cm') setUnit(v); }).catch(() => {});
    getSetting(GOAL_KEY).then((v) => { if (v === 'strength' || v === 'hypertrophy') setGoal(v); }).catch(() => {});
    getSetting(SHARE_FINISH_KEY).then((v) => { if (v != null) setShareFinish(v === '1'); }).catch(() => {});
    getSetting(SHARE_FIELDS_KEY).then((v) => {
      if (!v) return;
      try { const o = JSON.parse(v); setShareFields({ ...DEFAULT_SHARE_FIELDS, ...o }); } catch {}
    }).catch(() => {});
  }, []);

  const setTrainingGoal = useCallback((v: TrainingGoal) => {
    setGoal(v);
    setSetting(GOAL_KEY, v).catch(() => {});
  }, []);

  const setShareOnFinish = useCallback((v: boolean) => {
    setShareFinish(v);
    setSetting(SHARE_FINISH_KEY, v ? '1' : '0').catch(() => {});
  }, []);

  const setShareCardField = useCallback((key: keyof ShareCardFields, value: boolean) => {
    setShareFields((prev) => {
      const next = { ...prev, [key]: value };
      setSetting(SHARE_FIELDS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setMeasureUnit = useCallback((v: MeasureUnit) => {
    setUnit(v);
    setSetting(UNIT_KEY, v).catch(() => {});
  }, []);

  const setAnimationsEnabled = useCallback((v: boolean) => {
    setAnimations(v);
    setSetting(ANIM_KEY, v ? '1' : '0').catch(() => {});
  }, []);

  const setRestSeconds = useCallback((v: number) => {
    setRest(v);
    setSetting(REST_KEY, String(v)).catch(() => {});
  }, []);

  const setCompetitionTypesEnabled = useCallback((v: boolean) => {
    setComp(v);
    setSetting(COMP_KEY, v ? '1' : '0').catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={{ animationsEnabled, setAnimationsEnabled, restSeconds, setRestSeconds, competitionTypesEnabled, setCompetitionTypesEnabled, measureUnit, setMeasureUnit, trainingGoal, setTrainingGoal, shareOnFinish, setShareOnFinish, shareCardFields, setShareCardField }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  // Safe default if used outside provider (e.g. isolated tests).
  return ctx ?? { animationsEnabled: true, setAnimationsEnabled: () => {}, restSeconds: DEFAULT_REST, setRestSeconds: () => {}, competitionTypesEnabled: false, setCompetitionTypesEnabled: () => {}, measureUnit: 'cm', setMeasureUnit: () => {}, trainingGoal: 'hypertrophy', setTrainingGoal: () => {}, shareOnFinish: true, setShareOnFinish: () => {}, shareCardFields: DEFAULT_SHARE_FIELDS, setShareCardField: () => {} };
}
