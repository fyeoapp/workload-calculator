import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getDataVersion } from '../data/api';
import { fmtDay, fmtRange, fmtTime, isValidDate, summarizeWeeks, todayISO } from '../logic/weeks';
import { useProfile } from '../storage/profile';
import type { Level, ResolvedAssessment } from '../types';
import { MonthGrid } from './MonthGrid';
import { ItemStatusPill, matchesFilter, StatusFilter, type StatusFilterValue } from './StatusPill';
import { t } from './theme';

const LEVEL: Record<Level, { bar: string; bg: string; label: string }> = {
  normal: { bar: t.line, bg: t.card, label: '' },
  busy: { bar: t.busy, bg: t.busyBg, label: 'Busy' },
  heavy: { bar: t.heavy, bg: t.heavyBg, label: 'Heavy' },
};

export function CalendarScreen({ onEditCourses, today }: { onEditCourses?: () => void; today?: string }) {
  const { profile } = useProfile();
  const now = today ?? todayISO();
  const weeks = useMemo(() => summarizeWeeks(profile), [profile]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<ResolvedAssessment | null>(null);
  const [filter, setFilter] = useState<StatusFilterValue>('all');
  const [view, setView] = useState<'weeks' | 'calendar'>('calendar');
  const current = weeks.find((w) => now >= w.week.start && now <= w.week.end)?.week.id;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.head}>
          <Text style={s.h1}>Your semester</Text>
          {onEditCourses && <Pressable onPress={onEditCourses}><Text style={s.link}>Change courses</Text></Pressable>}
        </View>
        <Text style={s.note}>Dates come from the faculty schedule (data of {getDataVersion()}). Always confirm on D2L.</Text>
        <View style={s.toggle}>
          {(['calendar', 'weeks'] as const).map((v) => (
            <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }}
              style={[s.tab, view === v && s.tabOn]}>
              <Text style={[s.tabText, view === v && { color: '#fff' }]}>{v === 'weeks' ? 'Weeks' : 'Calendar'}</Text>
            </Pressable>
          ))}
        </View>
        <StatusFilter value={filter} onChange={setFilter} />
        {view === 'calendar' ? <MonthGrid today={now} filter={filter} onSelect={setEditing} /> : (<>
        <View style={s.legend}>
          {(['normal', 'busy', 'heavy'] as Level[]).map((l) => (
            <View key={l} style={s.legendItem}><View style={[s.swatch, { backgroundColor: LEVEL[l].bar }]} />
              <Text style={s.small}>{l === 'normal' ? 'Manageable' : LEVEL[l].label}</Text></View>
          ))}
        </View>

        {weeks.map(({ week, items: allItems, level, reason }) => {
          const items = allItems.filter((i) => matchesFilter(filter, i.status));
          if (filter !== 'all' && !items.length) return null;
          const isOpen = open[week.id] ?? week.id === current;
          return (
            <View key={week.id} style={[s.card, { backgroundColor: LEVEL[level].bg, borderLeftColor: LEVEL[level].bar }]}>
              <Pressable onPress={() => setOpen({ ...open, [week.id]: !isOpen })} accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }} style={s.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.weekTitle}>{week.label}{week.id === current ? '  (this week)' : ''}</Text>
                  <Text style={s.small}>{fmtRange(week.start, week.end)}</Text>
                  {allItems.length > 0 && (() => {
                    const done = allItems.filter((i) => i.status === 'completed').length;
                    return <Text style={s.counts}>{allItems.length - done} due  ·  <Text style={{ color: '#1E7A3E' }}>{done} completed</Text></Text>;
                  })()}
                  {week.kind === 'week' && <Text style={[s.reason, level !== 'normal' && { color: LEVEL[level].bar, fontWeight: '600' }]}>
                    {LEVEL[level].label ? `${LEVEL[level].label}: ` : ''}{reason}</Text>}
                  {filter !== 'all' && <Text style={s.small}>{items.length} of {allItems.length} shown</Text>}
                  {week.kind === 'reading' && <Text style={s.reason}>No classes</Text>}
                </View>
                <Text style={s.small}>{isOpen ? 'Hide' : 'Show'}</Text>
              </Pressable>
              {isOpen && items.map((i) => (
                <Pressable key={i.id} onPress={() => setEditing(i)} style={s.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemTitle, i.status === 'completed' && { textDecorationLine: 'line-through', opacity: 0.6 }]}>{i.courseCode} · {i.title}</Text>
                    <Text style={s.small}>
                      {i.effectiveDate ? `${fmtDay(i.effectiveDate)}${i.time ? ', ' + fmtTime(i.time) : ''}` : week.kind === 'exam' ? 'During exam period' : ''}
                      {i.edited ? '  · edited by you' : ''}{i.notes ? `  · ${i.notes}` : ''}
                    </Text>
                    <ItemStatusPill item={i} />
                  </View>
                  <Text style={s.weight}>{i.effectiveWeight == null ? '?%' : `${i.effectiveWeight}%`}</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
        </>)}
      </ScrollView>
      {editing && <EditModal item={editing} onClose={() => setEditing(null)} />}
    </View>
  );
}

function EditModal({ item, onClose }: { item: ResolvedAssessment; onClose: () => void }) {
  const { dispatch } = useProfile();
  const [date, setDate] = useState(item.effectiveDate ?? '');
  const [weight, setWeight] = useState(item.effectiveWeight == null ? '' : String(item.effectiveWeight));
  const bad = (date !== '' && !isValidDate(date)) || (weight !== '' && !(Number(weight) >= 0 && Number(weight) <= 100));
  const save = () => {
    dispatch({ type: 'setOverride', id: item.id, override: { date: date || null, weight: weight === '' ? null : Number(weight) } });
    onClose();
  };
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <Text style={s.h2}>{item.courseCode} · {item.title}</Text>
          <Text style={s.warn}>You are responsible for the accuracy of this data. Confirm dates and weights with your professor or on D2L before relying on them.</Text>
          <Text style={s.label}>Due date (YYYY-MM-DD)</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="2026-02-27" autoCapitalize="none" style={s.input} />
          <Text style={s.label}>Weight (% of course grade)</Text>
          <TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 10" style={s.input} />
          {bad && <Text style={{ color: t.heavy, marginTop: 6 }}>Enter a valid date and a weight between 0 and 100.</Text>}
          <View style={s.btnRow}>
            {item.edited && <Pressable onPress={() => { dispatch({ type: 'resetOverride', id: item.id }); onClose(); }}><Text style={s.link}>Reset to official</Text></Pressable>}
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose}><Text style={s.link}>Cancel</Text></Pressable>
            <Pressable disabled={bad} onPress={save} style={[s.save, bad && { opacity: 0.4 }]}><Text style={s.saveText}>Save</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.paper },
  body: { padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h1: { fontSize: 26, fontWeight: '700', color: t.ink },
  h2: { fontSize: 17, fontWeight: '700', color: t.ink },
  link: { color: t.accent, fontWeight: '600', fontSize: 14, padding: 8 },
  note: { color: t.sub, fontSize: 13, marginTop: 4, lineHeight: 18 },
  counts: { fontSize: 13, fontWeight: '700', color: t.ink, marginTop: 4 },
  toggle: { flexDirection: 'row', backgroundColor: t.line, borderRadius: 10, padding: 3, marginTop: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  tabOn: { backgroundColor: t.accent },
  tabText: { fontWeight: '600', color: t.ink, fontSize: 14 },
  legend: { flexDirection: 'row', gap: 16, marginVertical: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 3 },
  small: { fontSize: 12.5, color: t.sub },
  card: { borderRadius: t.r, borderLeftWidth: 6, borderWidth: 1, borderColor: t.line, marginBottom: 10, overflow: 'hidden' },
  cardHead: { padding: 14, flexDirection: 'row', alignItems: 'flex-start' },
  weekTitle: { fontSize: 16, fontWeight: '700', color: t.ink },
  reason: { fontSize: 13.5, color: t.ink, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.line },
  itemTitle: { fontSize: 14.5, fontWeight: '600', color: t.ink },
  weight: { fontSize: 15, fontWeight: '700', color: t.ink, marginLeft: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(23,33,43,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#fff', borderRadius: 14, padding: 20, maxWidth: 480, width: '100%', alignSelf: 'center' },
  warn: { backgroundColor: t.busyBg, color: t.ink, padding: 10, borderRadius: 8, marginVertical: 12, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, color: t.sub, marginTop: 8 },
  input: { borderWidth: 1, borderColor: t.line, borderRadius: 8, padding: 10, fontSize: 16, marginTop: 4, color: t.ink },
  btnRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 8 },
  save: { backgroundColor: t.accent, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
