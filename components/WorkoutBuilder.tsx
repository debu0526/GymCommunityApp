/**
 * The Log tab's workout builder — shown only while a workout session is active.
 * Multi-select type dropdown, group-aware exercise autocomplete, collapsible exercise
 * cards (with per-exercise Save + max-weight summary), "Set N" rows, journal note,
 * Finish & Save, and a prominent Discard pill. Cardio = duration/notes (no sets).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '@/components/PillButton';
import { ExercisePicker } from '@/components/ExercisePicker';
import { useCelebration } from '@/components/Celebration';
import { useShareCard } from '@/components/ShareCardProvider';
import { useWorkoutSession } from '@/session/WorkoutSession';
import { getAllAttendance, getAllRestDays } from '@/db/database';
import {
  getWorkoutDetail,
  setWorkoutTypes,
  setWorkoutNotes,
  addExercise,
  removeExercise,
  addSet,
  updateSet,
  deleteSet,
  getNewPRsForWorkout,
  getLastSessionSets,
  getExerciseMaxSet,
  setWorkoutImprove,
  EMPTY_IMPROVE,
  type ImprovePlan,
  setExerciseSuperset,
  deleteWorkouts,
  saveWorkoutAsTemplate,
  getTemplates,
  countTemplates,
  TEMPLATE_LIMIT,
  workoutTypeLabel,
  typeFiltersFor,
  WORKOUT_TYPES,
  type WorkoutDetail,
  type WorkoutExercise,
  type WorkoutSet,
  type TemplateSummary,
} from '@/db/workouts';
import { useSettings } from '@/settings/SettingsProvider';
import { computeStreak, todayISO } from '@/lib/attendance';
import { randomQuote } from '@/lib/quotes';
import { formatClock } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { newId } from '@/lib/id';
import { colors, spacing, radius, fonts } from '@/theme/theme';

function maxWeight(ex: WorkoutExercise): number | null {
  let m: number | null = null;
  for (const s of ex.sets) if (s.weight != null && (m == null || s.weight > m)) m = s.weight;
  return m;
}

const IMPROVE_CATS: { key: keyof ImprovePlan; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'moreReps', label: 'More reps', icon: 'repeat' },
  { key: 'moreWeight', label: 'More weight', icon: 'barbell' },
  { key: 'betterForm', label: 'Better form', icon: 'body' },
];

export function WorkoutBuilder({ workoutId: propWorkoutId, mode = 'live', onExit }: { workoutId?: string; mode?: 'live' | 'plan'; onExit?: () => void } = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { celebrate } = useCelebration();
  const { promptShare } = useShareCard();
  const { restSeconds, competitionTypesEnabled, shareOnFinish } = useSettings();
  const { session, elapsed, finish, discard } = useWorkoutSession();
  const isPlan = mode === 'plan';
  const workoutId = propWorkoutId ?? session?.workoutId ?? null;

  // Rest timer (H1b) — independent countdown shown as a floating pill.
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restNow, setRestNow] = useState(() => Date.now());
  useEffect(() => {
    if (restEnd == null) return;
    const iv = setInterval(() => setRestNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [restEnd]);
  const restRemaining = restEnd != null ? Math.max(0, Math.round((restEnd - restNow) / 1000)) : 0;
  useEffect(() => {
    if (restEnd != null && restRemaining <= 0) {
      haptics.success(); // rest done
      setRestEnd(null);
    }
  }, [restEnd, restRemaining]);
  const startRest = () => { const now = Date.now(); setRestNow(now); setRestEnd(now + restSeconds * 1000); haptics.selection(); };
  const adjustRest = (delta: number) => setRestEnd((e) => (e != null ? Math.max(Date.now(), e + delta * 1000) : e));
  const skipRest = () => setRestEnd(null);

  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [customEditing, setCustomEditing] = useState(false);
  const [customName, setCustomName] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  // Last finished session's sets per workout_exercise id — used as ghost placeholders.
  const [lastSets, setLastSets] = useState<Record<string, { reps: number | null; weight: number | null }[]>>({});
  // All-time heaviest set (the "PR to smash") per workout_exercise id — a live target.
  const [prBest, setPrBest] = useState<Record<string, { weight: number; reps: number | null } | null>>({});
  // "Save as template" limit modal state.
  const [tplModal, setTplModal] = useState(false);
  const [tplList, setTplList] = useState<TemplateSummary[]>([]);
  // Structured "how to improve next time" plan + which category is expanded.
  const [improve, setImprove] = useState<ImprovePlan>(EMPTY_IMPROVE);
  const [openCat, setOpenCat] = useState<keyof ImprovePlan | null>(null);
  const improveLoaded = useRef(false);

  const reload = useCallback(() => {
    if (!workoutId) return;
    getWorkoutDetail(workoutId).then((d) => {
      setDetail(d);
      setNotes(d?.workout.notes ?? '');
      if (d?.workout.notes) setNotesOpen(true);
      // Load the improve plan once (don't clobber in-session edits on later reloads).
      if (!improveLoaded.current) { setImprove(d?.workout.improve ?? EMPTY_IMPROVE); improveLoaded.current = true; }
    });
  }, [workoutId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    Promise.all([getAllAttendance(), getAllRestDays()]).then(([a, r]) => setStreak(computeStreak(new Set(a), new Set(r))));
  }, []);

  // Backfill last-session sets for any exercise we don't have cached yet (e.g. after a
  // template start or app restart) so ghost placeholders show on newly added sets.
  useEffect(() => {
    if (!detail) return;
    const missing = detail.exercises.filter((e) => !(e.id in lastSets));
    if (missing.length === 0) return;
    let active = true;
    Promise.all(missing.map((e) => getLastSessionSets(e.exerciseId, e.name).then((s) => [e.id, s] as const))).then((pairs) => {
      if (!active) return;
      setLastSets((prev) => { const n = { ...prev }; for (const [k, v] of pairs) n[k] = v; return n; });
    });
    Promise.all(missing.map((e) => getExerciseMaxSet(e.exerciseId, e.name).then((b) => [e.id, b] as const))).then((pairs) => {
      if (!active) return;
      setPrBest((prev) => { const n = { ...prev }; for (const [k, v] of pairs) n[k] = v; return n; });
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const typeCsv = detail?.workout.type ?? '';
  const selectedKeys = typeCsv ? typeCsv.split(',').filter(Boolean) : [];
  const savedCustom = detail?.workout.customTypeName ?? null;
  const isCardio = selectedKeys.length === 1 && selectedKeys[0] === 'cardio';
  const preferred = typeFiltersFor(typeCsv);
  const hasSelection = selectedKeys.length > 0 || !!savedCustom;
  const visibleTypes = WORKOUT_TYPES.filter((t) => !t.competition || competitionTypesEnabled);

  const groupCounts: Record<string, number> = {};
  detail?.exercises.forEach((e) => { if (e.supersetGroup) groupCounts[e.supersetGroup] = (groupCounts[e.supersetGroup] || 0) + 1; });
  const inSuperset = (e: WorkoutExercise) => !!e.supersetGroup && (groupCounts[e.supersetGroup!] || 0) >= 2;

  const toggleType = async (key: string) => {
    if (!workoutId) return;
    const set = new Set(selectedKeys);
    set.has(key) ? set.delete(key) : set.add(key);
    await setWorkoutTypes(workoutId, [...set], savedCustom);
    haptics.selection();
    reload();
  };
  const saveCustom = async () => {
    if (!workoutId) return;
    await setWorkoutTypes(workoutId, selectedKeys, customName.trim() || null);
    setCustomEditing(false);
    haptics.selection();
    reload();
  };

  const onPickExercise = async (name: string, id: string | null) => {
    if (!workoutId) return;
    const existing = detail?.exercises.map((e) => e.id) ?? [];
    setCollapsed((prev) => new Set([...prev, ...existing])); // collapse previous exercises
    const weId = await addExercise(workoutId, name, id);
    // H1a: pre-fill sets from the most recent session with this exercise (else one blank set).
    const last = await getLastSessionSets(id, name);
    // Add the same number of EMPTY sets as last time (min 1). The last-session values
    // show as ghost placeholders (H1a) so the user can type over them or leave blank.
    const count = Math.max(1, last.length);
    for (let i = 0; i < count; i++) await addSet(weId, null, null);
    setLastSets((prev) => ({ ...prev, [weId]: last }));
    reload();
  };
  const saveExercise = (exId: string) => {
    setCollapsed((prev) => new Set([...prev, exId]));
    haptics.success(); // exercise completed
  };
  // Keep the in-memory workout in sync as sets are typed, so collapsing/expanding
  // never loses entered values and the collapsed max-weight stays correct.
  const onSetChange = useCallback((setId: string, reps: number | null, weight: number | null) => {
    setDetail((d) =>
      d
        ? { ...d, exercises: d.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, reps, weight } : s)) })) }
        : d
    );
  }, []);
  const expandExercise = (exId: string) => {
    setCollapsed((prev) => { const n = new Set(prev); n.delete(exId); return n; });
  };

  const exitPlan = () => (onExit ? onExit() : router.back());

  const onFinish = async () => {
    if (isPlan) { haptics.success(); exitPlan(); return; } // template edits already persisted
    const d = detail; // capture the live detail before the session ends
    const id = await finish();
    haptics.success();
    let subtitle: string | undefined;
    if (id) {
      const newPRs = await getNewPRsForWorkout(id);
      if (newPRs.length) {
        subtitle = 'New PR · ' + newPRs.slice(0, 2).map((p) => `${p.name.split('(')[0].trim()} ${p.weight} kg`).join(', ');
      }
    }
    celebrate({ title: 'Workout saved 💪', subtitle });
    router.navigate('/');
    // Post-workout share prompt — only for a live session logged today (H3a constraint).
    try {
      if (d && shareOnFinish && d.workout.date === todayISO()) {
        let setCount = 0;
        let best: { name: string; weight: number; reps: number | null } | null = null;
        for (const ex of d.exercises) {
          for (const s of ex.sets) {
            setCount++;
            if (s.weight != null && (best == null || s.weight > best.weight || (s.weight === best.weight && (s.reps ?? 0) > (best.reps ?? 0)))) {
              best = { name: ex.name, weight: s.weight, reps: s.reps };
            }
          }
        }
        if (setCount > 0) {
          const [a, r] = await Promise.all([getAllAttendance(), getAllRestDays()]);
          promptShare({
            title: workoutTypeLabel(d.workout.type, d.workout.customTypeName),
            bestLift: best,
            streak: computeStreak(new Set(a), new Set(r)),
            dateISO: d.workout.date,
            quote: randomQuote(),
          });
        }
      }
    } catch { /* sharing is best-effort */ }
  };
  // Save the current live workout's exercise list as a reusable template.
  const doSaveTemplate = async () => {
    if (!workoutId) return;
    await saveWorkoutAsTemplate(workoutId);
    haptics.success();
    celebrate({ title: 'Saved as template', subtitle: 'Find it under Planned Workouts in the Log tab' });
  };
  const onSaveTemplate = async () => {
    if (!workoutId) return;
    if (!detail || detail.exercises.length === 0) {
      Alert.alert('Nothing to save', 'Add at least one exercise before saving this workout as a template.');
      return;
    }
    if ((await countTemplates()) >= TEMPLATE_LIMIT) {
      setTplList(await getTemplates());
      setTplModal(true); // limit reached — let the user free a slot
      return;
    }
    await doSaveTemplate();
  };
  const confirmDeleteTemplate = (t: TemplateSummary) => {
    Alert.alert('Delete this plan?', `Remove "${workoutTypeLabel(t.type, t.customTypeName)}" to free a slot? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteWorkouts([t.id]);
          haptics.warning();
          const remaining = await getTemplates();
          setTplList(remaining);
          if (remaining.length < TEMPLATE_LIMIT) {
            setTplModal(false);
            await doSaveTemplate();
          }
        },
      },
    ]);
  };

  const onDiscard = () => {
    if (isPlan) {
      Alert.alert('Delete plan?', 'This deletes this planned workout. This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { haptics.warning(); if (workoutId) await deleteWorkouts([workoutId]); exitPlan(); } },
      ]);
      return;
    }
    Alert.alert('Discard workout?', 'This deletes the in-progress workout. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => { haptics.warning(); await discard(); router.navigate('/'); } },
    ]);
  };

  // Superset (H1e): link an exercise with the one above it, or unlink.
  const linkSuperset = async (idx: number) => {
    if (!detail || idx <= 0) return;
    const prev = detail.exercises[idx - 1];
    const cur = detail.exercises[idx];
    const group = prev.supersetGroup ?? newId();
    await setExerciseSuperset(prev.id, group);
    await setExerciseSuperset(cur.id, group);
    haptics.selection();
    reload();
  };
  const unlinkSuperset = async (exId: string) => {
    await setExerciseSuperset(exId, null);
    haptics.selection();
    reload();
  };
  const saveNotes = async (text: string) => {
    setNotes(text);
    if (workoutId) await setWorkoutNotes(workoutId, text);
  };

  // Distinct exercise names logged today — the taggable options under each improve goal.
  const todaysExercises = detail ? Array.from(new Set(detail.exercises.map((e) => e.name))) : [];
  const toggleImprove = (key: keyof ImprovePlan, name: string) => {
    haptics.selection();
    const has = improve[key].includes(name);
    const next: ImprovePlan = { ...improve, [key]: has ? improve[key].filter((n) => n !== name) : [...improve[key], name] };
    setImprove(next);
    if (workoutId) setWorkoutImprove(workoutId, next);
  };

  return (
    <View style={styles.wrap}>
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{isPlan ? 'PLANNING' : `LOGGING · ${formatClock(elapsed)}`}</Text>
          <Text style={styles.title}>{workoutTypeLabel(typeCsv, savedCustom).toUpperCase()}</Text>
        </View>
        {!isPlan && <View style={styles.streakPill}><Text style={styles.streakText}>🔥 {streak}</Text></View>}
      </View>

      {/* Type selector (collapsible, multi-select) */}
      <Pressable style={styles.selectorHeader} onPress={() => setTypeOpen((o) => !o)}>
        <Text style={styles.selectorLabel}>{hasSelection ? workoutTypeLabel(typeCsv, savedCustom) : 'Select workout type'}</Text>
        <Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text2} />
      </Pressable>
      {typeOpen && (
        <View style={styles.selectorPanel}>
          <View style={styles.chipWrap}>
            {visibleTypes.map((t) => {
              const active = selectedKeys.includes(t.key);
              return (
                <Pressable key={t.key} onPress={() => toggleType(t.key)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => { setCustomEditing(true); setCustomName(savedCustom ?? ''); }} style={[styles.chip, savedCustom && styles.chipActive]}>
              <Text style={[styles.chipText, savedCustom && styles.chipTextActive]}>{savedCustom ? savedCustom : '+ Custom'}</Text>
            </Pressable>
          </View>
          {customEditing && (
            <View style={styles.customRow}>
              <TextInput style={styles.customInput} value={customName} onChangeText={setCustomName} placeholder="Name this workout" placeholderTextColor={colors.text3} maxLength={30} autoFocus />
              <PillButton label="Save" variant="primary" onPress={saveCustom} style={styles.customSave} />
            </View>
          )}
          <Text style={styles.selectorHint}>Pick one or more (e.g. Push + Legs).</Text>
        </View>
      )}

      {/* Exercises / cardio */}
      {isCardio ? (
        <View style={styles.cardioCard}>
          <Ionicons name="bicycle" size={28} color={colors.amber} />
          <Text style={styles.cardioText}>Cardio is tracked by your session time{'\n'}({formatClock(elapsed)}) plus the note below.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>EXERCISES</Text>
          {detail && detail.exercises.length === 0 && <Text style={styles.emptyHint}>No exercises yet — add your first below.</Text>}
          {detail?.exercises.map((ex, idx) => {
            const isCollapsed = collapsed.has(ex.id);
            const mw = maxWeight(ex);
            const ss = inSuperset(ex);
            if (isCollapsed) {
              return (
                <Pressable key={ex.id} style={[styles.collapsedCard, ss && styles.supersetCard]} onPress={() => expandExercise(ex.id)}>
                  <View style={{ flex: 1 }}>
                    {ss && <Text style={styles.supersetTag}>SUPERSET</Text>}
                    <Text style={styles.collapsedName}>{ex.name}</Text>
                    <Text style={styles.collapsedSub}>{ex.sets.length} set{ex.sets.length === 1 ? '' : 's'} · tap to expand</Text>
                  </View>
                  <Text style={styles.collapsedMax}>{mw != null ? `${mw} kg` : '—'}</Text>
                  <Ionicons name="chevron-down" size={18} color={colors.text3} />
                </Pressable>
              );
            }
            const linkedWithPrev = ss && idx > 0 && detail!.exercises[idx - 1].supersetGroup === ex.supersetGroup;
            return (
              <View key={ex.id} style={[styles.exCard, ss && styles.supersetCard]}>
                <View style={styles.exHeader}>
                  <View style={{ flex: 1 }}>
                    {ss && <Text style={styles.supersetTag}>SUPERSET</Text>}
                    <Text style={styles.exName}>{ex.name}</Text>
                    {(() => {
                      const pr = prBest[ex.id];
                      if (pr && pr.weight != null) {
                        return (
                          <View style={styles.prLine}>
                            <Ionicons name="flame" size={13} color={colors.amber} />
                            <Text style={styles.prText}>Smash your PR: {pr.weight} kg × {pr.reps ?? '–'} reps</Text>
                          </View>
                        );
                      }
                      return <Text style={styles.prNone}>No PR yet — set one today</Text>;
                    })()}
                  </View>
                  <Pressable onPress={() => router.push(`/exercise/${encodeURIComponent(ex.exerciseId ?? ex.name)}`)} hitSlop={6} style={{ marginRight: spacing.sm }}>
                    <Ionicons name="information-circle-outline" size={22} color={colors.text3} />
                  </Pressable>
                  {idx > 0 && (
                    linkedWithPrev ? (
                      <Pressable onPress={() => unlinkSuperset(ex.id)} hitSlop={6} style={styles.ssBtn}>
                        <Text style={styles.ssBtnText}>Unlink</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => linkSuperset(idx)} hitSlop={6} style={styles.ssBtn}>
                        <Ionicons name="link" size={13} color={colors.amber} />
                        <Text style={styles.ssBtnText}>Superset</Text>
                      </Pressable>
                    )
                  )}
                  <Pressable onPress={async () => { await removeExercise(ex.id); reload(); }} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                    <Ionicons name="trash-outline" size={18} color={colors.text3} />
                  </Pressable>
                </View>
                {ex.sets.map((s, sidx) => {
                  const exLast = lastSets[ex.id];
                  let g = exLast && exLast.length ? (exLast[sidx] ?? exLast[exLast.length - 1]) : undefined;
                  // Fallback: ghost the previous set's current values (e.g. no prior session).
                  if (!g || (g.reps == null && g.weight == null)) {
                    const prev = sidx > 0 ? ex.sets[sidx - 1] : undefined;
                    if (prev && (prev.reps != null || prev.weight != null)) g = { reps: prev.reps, weight: prev.weight };
                  }
                  return (
                    <SetRow key={s.id} set={s} ghostReps={g?.reps ?? null} ghostWeight={g?.weight ?? null} onChange={onSetChange} onDelete={async () => { await deleteSet(s.id); reload(); }} />
                  );
                })}
                <View style={styles.exActions}>
                  <PillButton label="+ Add Set" variant="soft" onPress={async () => { await addSet(ex.id, null, null); reload(); }} style={styles.addSetBtn} />
                  <PillButton label="Save" variant="primary" onPress={() => saveExercise(ex.id)} style={styles.saveExBtn} />
                </View>
              </View>
            );
          })}
          <View style={styles.bottomActions}>
            {!isPlan && detail && detail.exercises.length > 0 && <PillButton label="Rest" variant="soft" onPress={startRest} style={styles.restStartBtn} />}
            <PillButton label="+ Add Exercise" variant="ghost" onPress={() => setPickerVisible(true)} style={styles.addExFlex} />
          </View>
        </>
      )}

      {/* Workout note */}
      <Text style={styles.sectionLabel}>WORKOUT NOTE</Text>

      {!isPlan && (
        <>
          <Text style={styles.noteHint}>How do you want to improve next time? Just tap — no typing needed.</Text>
          {IMPROVE_CATS.map((cat) => {
            const picked = improve[cat.key];
            const open = openCat === cat.key;
            return (
              <View key={cat.key} style={styles.improveCat}>
                <Pressable style={styles.improveHead} onPress={() => setOpenCat((o) => (o === cat.key ? null : cat.key))}>
                  <Ionicons name={cat.icon} size={18} color={picked.length ? colors.amber : colors.text2} />
                  <Text style={styles.improveTitle}>{cat.label}</Text>
                  {picked.length > 0 && <Text style={styles.improveCount}>{picked.length}</Text>}
                  <View style={{ flex: 1 }} />
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text3} />
                </Pressable>
                {open && (
                  todaysExercises.length === 0 ? (
                    <Text style={styles.improveEmpty}>Add exercises above to tag them here.</Text>
                  ) : (
                    <View style={styles.improveChips}>
                      {todaysExercises.map((name) => {
                        const on = picked.includes(name);
                        return (
                          <Pressable key={name} onPress={() => toggleImprove(cat.key, name)} style={[styles.exChip, on && styles.exChipOn]}>
                            <Text style={[styles.exChipText, on && styles.exChipTextOn]}>{name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )
                )}
              </View>
            );
          })}
        </>
      )}

      <Text style={styles.freeNoteLabel}>{isPlan ? 'Plan note (optional)' : 'Anything else? (optional)'}</Text>
      {notesOpen || notes ? (
        <View style={styles.noteBox}>
          <TextInput style={styles.noteInput} value={notes} onChangeText={saveNotes} placeholder="Write a quick note…" placeholderTextColor={colors.text3} multiline maxLength={200} />
          <Text style={styles.noteCount}>{notes.length}/200</Text>
        </View>
      ) : (
        <PillButton label="+ Add a note" variant="soft" onPress={() => setNotesOpen(true)} />
      )}

      {/* Finish / discard */}
      <View style={{ height: spacing.xl }} />
      <PillButton label={isPlan ? 'Save Plan' : 'Finish & Save'} variant="primary" block onPress={onFinish} />
      {!isPlan && <PillButton label="Save as Template" variant="soft" block onPress={onSaveTemplate} style={{ marginTop: spacing.sm }} />}
      <Pressable onPress={onDiscard} style={styles.discardPill}>
        <Ionicons name="trash-outline" size={18} color={colors.text2} />
        <Text style={styles.discardText}>{isPlan ? 'Delete Plan' : 'Discard Workout'}</Text>
      </Pressable>

      <ExercisePicker visible={pickerVisible} onClose={() => setPickerVisible(false)} onSelect={onPickExercise} preferred={preferred} />

      {/* Template limit reached — delete a saved plan to free a slot */}
      <Modal visible={tplModal} transparent animationType="fade" onRequestClose={() => setTplModal(false)}>
        <Pressable style={styles.tplBackdrop} onPress={() => setTplModal(false)}>
          <Pressable style={styles.tplSheet} onPress={() => {}}>
            <Text style={styles.tplTitle}>PLAN LIMIT REACHED</Text>
            <Text style={styles.tplSub}>You have {TEMPLATE_LIMIT} saved plans (the free limit). Delete one below to save this workout as a new template. (Pro will allow unlimited plans.)</Text>
            {tplList.map((t) => (
              <View key={t.id} style={styles.tplRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tplName}>{workoutTypeLabel(t.type, t.customTypeName)}</Text>
                  <Text style={styles.tplMeta}>{t.exerciseCount} exercise{t.exerciseCount === 1 ? '' : 's'}</Text>
                </View>
                <Pressable onPress={() => confirmDeleteTemplate(t)} hitSlop={8} style={styles.tplDel}>
                  <Ionicons name="trash-outline" size={20} color={colors.text2} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => setTplModal(false)} style={styles.tplCancel}><Text style={styles.tplCancelText}>Cancel</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>

    {restEnd != null && (
      <RestPill remaining={restRemaining} bottom={insets.bottom + 92} onSub={() => adjustRest(-15)} onAdd={() => adjustRest(15)} onSkip={skipRest} />
    )}
    </View>
  );
}

function RestPill({ remaining, bottom, onSub, onAdd, onSkip }: { remaining: number; bottom: number; onSub: () => void; onAdd: () => void; onSkip: () => void }) {
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  return (
    <View style={[styles.restPill, { bottom }]}>
      <Ionicons name="timer-outline" size={18} color={colors.amber} />
      <Text style={styles.restLabel}>REST</Text>
      <Text style={styles.restTime}>{mm}:{String(ss).padStart(2, '0')}</Text>
      <Pressable onPress={onSub} hitSlop={6} style={styles.restAdj}><Text style={styles.restAdjText}>−15</Text></Pressable>
      <Pressable onPress={onAdd} hitSlop={6} style={styles.restAdj}><Text style={styles.restAdjText}>+15</Text></Pressable>
      <Pressable onPress={onSkip} hitSlop={6} style={styles.restSkip}><Text style={styles.restSkipText}>Skip</Text></Pressable>
    </View>
  );
}

/* one set: "Set N" + reps × weight + remove. Persists to DB and reports live changes up. */
function SetRow({ set, onChange, onDelete, ghostReps, ghostWeight }: { set: WorkoutSet; onChange: (setId: string, reps: number | null, weight: number | null) => void; onDelete: () => void; ghostReps?: number | null; ghostWeight?: number | null }) {
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : '');
  const [weight, setWeight] = useState(set.weight != null ? String(set.weight) : '');

  const emit = (r: string, w: string) => {
    const rn = r.trim() === '' ? null : parseInt(r, 10);
    const wn = w.trim() === '' ? null : parseFloat(w.replace(',', '.'));
    const rr = rn != null && isNaN(rn) ? null : rn;
    const ww = wn != null && isNaN(wn) ? null : wn;
    updateSet(set.id, rr, ww); // persist
    onChange(set.id, rr, ww); // keep parent's in-memory copy current
  };

  const repsPlaceholder = ghostReps != null ? String(ghostReps) : 'reps';
  const weightPlaceholder = ghostWeight != null ? String(ghostWeight) : 'kg';

  return (
    <View style={styles.setRow}>
      <Text style={styles.setLabel}>Set {set.setNumber}</Text>
      <TextInput style={styles.setInput} value={reps} onChangeText={(t) => { setReps(t); emit(t, weight); }} keyboardType="number-pad" placeholder={repsPlaceholder} placeholderTextColor={colors.text3} maxLength={4} />
      <Text style={styles.times}>×</Text>
      <TextInput style={styles.setInput} value={weight} onChangeText={(t) => { setWeight(t); emit(reps, t); }} keyboardType="decimal-pad" placeholder={weightPlaceholder} placeholderTextColor={colors.text3} maxLength={6} />
      <Pressable onPress={onDelete} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.text3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.appBg },
  root: { flex: 1, backgroundColor: colors.appBg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.md },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, color: colors.amber, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.text, letterSpacing: 0.5 },
  streakPill: { backgroundColor: colors.amberDim, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, marginTop: 4 },
  streakText: { fontFamily: fonts.bold, fontSize: 14, color: colors.amber },

  selectorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.lg, paddingVertical: 14, marginTop: spacing.sm },
  selectorLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  selectorPanel: { marginTop: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.md, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text2 },
  chipTextActive: { color: colors.onAmber },
  customRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  customInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  customSave: { paddingVertical: 12, paddingHorizontal: 20 },
  selectorHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: spacing.sm },

  cardioCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  cardioText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },

  sectionLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text3, letterSpacing: 1.2, marginTop: spacing.xl, marginBottom: spacing.sm },
  emptyHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.text3, marginBottom: spacing.sm },

  exCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.md },
  exHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  exName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, flex: 1, paddingRight: spacing.sm },
  prLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  prText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.amber },
  prNone: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 3 },
  exActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  addSetBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  restStartBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  saveExBtn: { paddingVertical: 10, paddingHorizontal: 20, marginLeft: 'auto' },
  addExBtn: { marginTop: spacing.xs },
  bottomActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  addExFlex: { flex: 1 },
  supersetCard: { borderLeftWidth: 3, borderLeftColor: colors.amber },
  supersetTag: { fontFamily: fonts.semibold, fontSize: 10, color: colors.amber, letterSpacing: 1, marginBottom: 2 },
  ssBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.amberDim, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10 },
  ssBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.amber },
  restPill: { position: 'absolute', left: spacing.xl, right: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.amber, paddingVertical: 12, paddingHorizontal: spacing.lg },
  restLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.amber, letterSpacing: 1 },
  restTime: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: 0.5, minWidth: 48 },
  restAdj: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10 },
  restAdjText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text2 },
  restSkip: { marginLeft: 'auto', paddingVertical: 6, paddingHorizontal: 10 },
  restSkipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.amber },

  collapsedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.lg, paddingVertical: 14, marginBottom: spacing.md },
  collapsedName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  collapsedSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2 },
  collapsedMax: { fontFamily: fonts.display, fontSize: 22, color: colors.amber, letterSpacing: 0.5 },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  setLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text2, width: 46 },
  setInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, backgroundColor: colors.surface2, borderRadius: radius.card, paddingHorizontal: spacing.md, paddingVertical: 10, textAlign: 'center' },
  times: { fontFamily: fonts.regular, fontSize: 14, color: colors.text3 },

  noteHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.text3, marginBottom: spacing.sm },
  improveCat: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, marginBottom: spacing.sm, overflow: 'hidden' },
  improveHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  improveTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  improveCount: { fontFamily: fonts.bold, fontSize: 12, color: colors.onAmber, backgroundColor: colors.amber, borderRadius: 10, minWidth: 20, textAlign: 'center', paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  improveEmpty: { fontFamily: fonts.regular, fontSize: 13, color: colors.text3, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  improveChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  exChip: { backgroundColor: colors.surface2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.md, paddingVertical: 8 },
  exChipOn: { backgroundColor: colors.amberDim, borderColor: colors.amber },
  exChipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text2 },
  exChipTextOn: { color: colors.amber, fontFamily: fonts.semibold },
  freeNoteLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text3, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },
  noteBox: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg },
  noteInput: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, minHeight: 64, textAlignVertical: 'top' },
  noteCount: { fontFamily: fonts.regular, fontSize: 11, color: colors.text3, textAlign: 'right', marginTop: spacing.xs },

  discardPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1.5, borderColor: colors.hairline, borderRadius: radius.pill, paddingVertical: 14, marginTop: spacing.md },
  discardText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text2 },
  tplBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  tplSheet: { backgroundColor: colors.surface2, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.xl },
  tplTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: 0.5 },
  tplSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.text2, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 19 },
  tplRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, padding: spacing.lg, marginBottom: spacing.sm },
  tplName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  tplMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2 },
  tplDel: { padding: spacing.xs },
  tplCancel: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  tplCancelText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text2 },
});
