import { addMonths, format, getDay, getDaysInMonth, parseISO, startOfMonth } from 'date-fns';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getProgram } from '../data/api';
import { fmtDay, fmtTime, summarizeDays } from '../logic/weeks';
import { useProfile } from '../storage/profile';
import type { Level, ResolvedAssessment } from '../types';
import { ItemStatusPill, matchesFilter, type StatusFilterValue } from './StatusPill';
import { t } from './theme';

const COLORS: Record<Level, { bg: string; bar: string; label: string }> = {
  normal: { bg: '#E3F4E8', bar: '#3E9B5F', label: 'Light' },
  busy: { bg: t.busyBg, bar: t.busy, label: 'Busy' },
  heavy: { bg: t.heavyBg, bar: t.heavy, label: 'Heavy' },
};
const DONE = { bg: t.card, bar: t.line }; // nothing left to do that day
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const key = (d: Date) => format(d, 'yyyy-MM-dd');

/** Month calendar. Shows only items with an exact due date. */
export function MonthGrid({ today, filter = 'all', onSelect }: { today: string; filter?: StatusFilterValue; onSelect: (i: ResolvedAssessment) => void }) {
  const { profile } = useProfile();
  const { days, open } = useMemo(() => {
    const all = summarizeDays(profile);
    const open: Record<string, boolean> = {};
    for (const [d, day] of Object.entries(all)) open[d] = day.items.some((i) => i.status !== 'completed');
    if (filter === 'all') return { days: all, open };
    const out: typeof all = {};
    for (const [d, day] of Object.entries(all)) {
      const items = day.items.filter((i) => matchesFilter(filter, i.status));
      if (items.length) out[d] = { ...day, items }; // color stays based on the day's full workload
    }
    return { days: out, open };
  }, [profile, filter]);
  const program = profile.programId ? getProgram(profile.programId) : undefined;
  const first = program?.weeks[0]?.start ?? today;
  const last = program?.weeks[program.weeks.length - 1]?.end ?? today;
  const clamp = (d: string) => (d < first ? first : d > last ? last : d);
  const [month, setMonth] = useState(startOfMonth(parseISO(clamp(today))));
  const [selected, setSelected] = useState<string | null>(null);

  const canPrev = key(month) > key(startOfMonth(parseISO(first)));
  const canNext = key(addMonths(month, 1)) <= last;
  const lead = (getDay(month) + 6) % 7; // Monday-first
  const count = getDaysInMonth(month);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => key(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  while (cells.length % 7) cells.push(null);
  const sel = selected ? days[selected] : undefined;

  return (
    <View style={{ marginTop: 12 }}>
      <View style={s.nav}>
        <Pressable disabled={!canPrev} onPress={() => setMonth(addMonths(month, -1))} style={[s.arrow, !canPrev && { opacity: 0.3 }]} accessibilityLabel="Previous month"><Text style={s.arrowText}>‹</Text></Pressable>
        <Text style={s.month}>{format(month, 'MMMM yyyy')}</Text>
        <Pressable disabled={!canNext} onPress={() => setMonth(addMonths(month, 1))} style={[s.arrow, !canNext && { opacity: 0.3 }]} accessibilityLabel="Next month"><Text style={s.arrowText}>›</Text></Pressable>
      </View>
      <View style={s.legend}>
        {(['normal', 'busy', 'heavy'] as Level[]).map((l) => (
          <View key={l} style={s.legendItem}><View style={[s.swatch, { backgroundColor: COLORS[l].bar }]} /><Text style={s.small}>{COLORS[l].label} day</Text></View>
        ))}
        <View style={s.legendItem}><View style={[s.swatch, { backgroundColor: t.card, borderWidth: 1, borderColor: t.sub }]} /><Text style={s.small}>All completed</Text></View>
      </View>
      <View style={s.row}>{DOW.map((d) => <Text key={d} style={s.dow}>{d}</Text>)}</View>
      <View style={s.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={s.cell} />;
          const day = days[d];
          const due = day ? day.items.filter((i) => i.status !== 'completed').length : 0;
          const done = day ? day.items.length - due : 0;
          const lvl = day ? (open[d] ? COLORS[day.level] : DONE) : null;
          return (
            <Pressable key={d} disabled={!day} onPress={() => setSelected(d === selected ? null : d)}
              accessibilityLabel={`${fmtDay(d)}${day ? `, ${due} due, ${done} completed` : ''}`}
              style={[s.cell, s.day, lvl && { backgroundColor: lvl.bg, borderColor: lvl.bar }, d === today && s.today, d === selected && s.sel]}>
              <Text style={s.num}>{Number(d.slice(8))}</Text>
              {due > 0 && <Text style={s.cnt}>{due} due</Text>}
              {done > 0 && <Text style={[s.cnt, s.cntDone]}>{done} completed</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={s.hint}>{Object.keys(days).length ? 'Tap a colored day to see what is due. Items without an exact date appear in the Weeks view.' : filter === 'all' ? 'No dated deadlines for your courses yet.' : 'No dated deadlines match this status.'}</Text>
      {sel && (
        <View style={s.detail}>
          <Text style={s.detailTitle}>{fmtDay(sel.date)} · {open[sel.date] ? `${COLORS[sel.level].label} day` : 'All completed'}</Text>
          {sel.items.map((i) => (
            <Pressable key={i.id} onPress={() => onSelect(i)} style={s.item}>
              <View style={{ flex: 1 }}>
                <Text style={[s.itemTitle, i.status === 'completed' && { textDecorationLine: 'line-through', opacity: 0.6 }]}>{i.courseCode} · {i.title}</Text>
                <Text style={s.small}>{i.time ? fmtTime(i.time) : 'Time not listed'}{i.edited ? '  · edited by you' : ''}</Text>
                <ItemStatusPill item={i} />
              </View>
              <Text style={s.weight}>{i.effectiveWeight == null ? '?%' : `${i.effectiveWeight}%`}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { paddingHorizontal: 16, paddingVertical: 4 },
  arrowText: { fontSize: 28, color: t.accent, fontWeight: '600' },
  month: { fontSize: 18, fontWeight: '700', color: t.ink },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 3 },
  small: { fontSize: 12.5, color: t.sub },
  row: { flexDirection: 'row' },
  dow: { width: '14.2857%', textAlign: 'center', fontSize: 12, color: t.sub, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', minHeight: 64, padding: 2 },
  day: { borderWidth: 1, borderColor: t.line, borderRadius: 8, backgroundColor: t.card, padding: 4, margin: 0 },
  today: { borderWidth: 2, borderColor: t.accent },
  sel: { borderWidth: 2.5, borderColor: t.ink },
  num: { fontSize: 14, fontWeight: '600', color: t.ink },
  cnt: { fontSize: 10, color: t.ink, marginTop: 2, fontWeight: '600' },
  cntDone: { color: '#1E7A3E' },
  hint: { fontSize: 12.5, color: t.sub, marginTop: 10, lineHeight: 18 },
  detail: { backgroundColor: t.card, borderRadius: t.r, borderWidth: 1, borderColor: t.line, marginTop: 12, overflow: 'hidden' },
  detailTitle: { fontSize: 15, fontWeight: '700', color: t.ink, padding: 14 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.line },
  itemTitle: { fontSize: 14.5, fontWeight: '600', color: t.ink },
  weight: { fontSize: 15, fontWeight: '700', color: t.ink, marginLeft: 12 },
});
