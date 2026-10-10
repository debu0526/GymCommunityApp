/** Autocomplete modal to pick an exercise from the 154-item catalog (or create one). */
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fonts } from '@/theme/theme';
import { searchCatalog, createCustomExercise, MUSCLE_GROUPS, type CatalogExercise } from '@/db/workouts';
import { ExerciseInfo } from '@/components/ExerciseInfo';
import { PillButton } from '@/components/PillButton';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, exerciseId: string | null) => void;
  preferred?: { groups?: string[]; categories?: string[] }; // relevant to the chosen workout type(s)
};

export function ExercisePicker({ visible, onClose, onSelect, preferred }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [results, setResults] = useState<CatalogExercise[]>([]);
  const [detailEx, setDetailEx] = useState<CatalogExercise | null>(null);
  const hasPreferred = !!(preferred?.groups?.length || preferred?.categories?.length);
  const prefKey = JSON.stringify([preferred?.groups ?? [], preferred?.categories ?? []]);

  useEffect(() => {
    if (!visible) return;
    if (query.trim()) {
      searchCatalog(query, { limit: 60 }).then(setResults); // search finds anything
    } else if (group) {
      searchCatalog('', { groups: [group], limit: 300 }).then(setResults);
    } else if (hasPreferred) {
      searchCatalog('', { groups: preferred?.groups, categories: preferred?.categories, limit: 400 }).then(setResults);
    } else {
      searchCatalog('', { limit: 300 }).then(setResults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, query, group, prefKey]);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setGroup(null);
      setDetailEx(null);
    }
  }, [visible]);

  const exactMatch = results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());
  const showCreate = query.trim().length > 1 && !exactMatch;

  const pick = (name: string, id: string | null) => {
    onSelect(name, id);
    onClose();
  };

  const createAndPick = async () => {
    const ex = await createCustomExercise(query.trim(), group);
    pick(ex.name, ex.id);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {detailEx ? (
            <>
              <View style={styles.header}>
                <Pressable onPress={() => setDetailEx(null)} hitSlop={12} style={styles.backRow}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                  <Text style={styles.backText}>Back</Text>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Ionicons name="close" size={24} color={colors.text2} />
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <ExerciseInfo idOrName={detailEx.id} />
              </View>
              <PillButton label="Add to workout" block variant="primary" onPress={() => pick(detailEx.name, detailEx.id)} style={styles.addBtn} />
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>ADD EXERCISE</Text>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Ionicons name="close" size={24} color={colors.text2} />
                </Pressable>
              </View>

              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.text3} />
                <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Search exercises…" placeholderTextColor={colors.text3} autoFocus autoCorrect={false} />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsContent}>
                <GroupChip label={hasPreferred ? 'Suggested' : 'All'} active={group === null} onPress={() => setGroup(null)} />
                {MUSCLE_GROUPS.map((g) => (
                  <GroupChip key={g} label={g} active={group === g} onPress={() => setGroup(g)} />
                ))}
              </ScrollView>

              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {showCreate && (
                  <Pressable style={styles.createRow} onPress={createAndPick}>
                    <Ionicons name="add-circle" size={20} color={colors.amber} />
                    <Text style={styles.createText}>Create “{query.trim()}”</Text>
                  </Pressable>
                )}
                {results.map((r) => (
                  <Pressable key={r.id} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => pick(r.name, r.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {r.name}
                        {r.topPick ? <Text style={styles.star}>  ★</Text> : null}
                      </Text>
                      <Text style={styles.meta}>
                        {[r.group, r.type, r.isCustom ? 'Custom' : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Pressable onPress={() => setDetailEx(r)} hitSlop={8} style={styles.infoBtn}>
                      <Ionicons name="information-circle-outline" size={22} color={colors.text3} />
                    </Pressable>
                    <Ionicons name="add" size={20} color={colors.amber} />
                  </Pressable>
                ))}
                {results.length === 0 && !showCreate && <Text style={styles.emptyText}>No matches.</Text>}
                <View style={{ height: spacing.xxl }} />
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function GroupChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.appBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.hairline, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, height: '82%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.text, letterSpacing: 0.5 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  search: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text, paddingVertical: 12 },
  chips: { marginBottom: spacing.sm, flexGrow: 0 },
  chipsContent: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, paddingHorizontal: spacing.md, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text2 },
  chipTextActive: { color: colors.onAmber },
  list: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowPressed: { backgroundColor: colors.surface },
  name: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  star: { color: colors.amber, fontSize: 12 },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.text3, marginTop: 2 },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  createText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.amber },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text3, textAlign: 'center', paddingVertical: spacing.xl },
  infoBtn: { paddingHorizontal: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  addBtn: { marginTop: spacing.md, marginBottom: spacing.sm },
});
