import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfile } from '../storage/profile';
import type { ResolvedAssessment, Status } from '../types';
import { t } from './theme';

export const STATUS_ORDER: Status[] = ['not_started', 'in_progress', 'completed'];
export const STATUS_META: Record<Status, { label: string; bg: string; fg: string }> = {
  not_started: { label: 'Not started', bg: '#E8ECEF', fg: '#4A5663' },
  in_progress: { label: 'In progress', bg: '#DCEBFA', fg: '#1F5C99' },
  completed: { label: 'Completed', bg: '#DDF3E4', fg: '#1E7A3E' },
};
export const nextStatus = (s: Status): Status => STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];

export type StatusFilterValue = 'all' | Status;
export const matchesFilter = (f: StatusFilterValue, s: Status) => f === 'all' || f === s;

/** Tap to move an assessment to the next status (Not started → In progress → Completed → Not started). */
export function ItemStatusPill({ item }: { item: ResolvedAssessment }) {
  const { dispatch } = useProfile();
  const m = STATUS_META[item.status];
  const next = nextStatus(item.status);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Status ${m.label}. Tap to change to ${STATUS_META[next].label}`}
      onPress={() => dispatch({ type: 'setStatus', id: item.id, status: next })}
      style={[s.pill, { backgroundColor: m.bg }]}>
      <Text style={[s.pillText, { color: m.fg }]}>{m.label}</Text>
    </Pressable>
  );
}

export function StatusFilter({ value, onChange }: { value: StatusFilterValue; onChange: (v: StatusFilterValue) => void }) {
  const opts: { id: StatusFilterValue; label: string }[] = [{ id: 'all', label: 'All' }, ...STATUS_ORDER.map((id) => ({ id, label: STATUS_META[id].label }))];
  return (
    <View style={s.filter} accessibilityRole="radiogroup">
      {opts.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="radio" accessibilityState={{ selected: value === o.id }}
          style={[s.chip, value === o.id && s.chipOn]}>
          <Text style={[s.chipText, value === o.id && { color: '#fff' }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginTop: 6, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  filter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: t.accent, backgroundColor: t.card },
  chipOn: { backgroundColor: t.accent },
  chipText: { color: t.accent, fontWeight: '600', fontSize: 13 },
});
