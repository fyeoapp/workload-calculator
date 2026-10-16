import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getCourses, getPrograms } from '../data/api';
import { useProfile } from '../storage/profile';
import { t } from './theme';

export function SetupScreen({ onDone }: { onDone?: () => void }) {
  const { profile, dispatch } = useProfile();
  const courses = profile.programId ? getCourses(profile.programId) : [];
  const count = profile.courseIds.length;
  return (
    <View style={s.root}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
      <Text style={s.h1}>Workload calculator</Text>
      <Text style={s.sub}>Pick your program and courses. Your choices stay on this device.</Text>

      <Text style={s.h2}>Program</Text>
      {getPrograms().map((p) => (
        <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: profile.programId === p.id }}
          onPress={() => dispatch({ type: 'setProgram', programId: p.id })}
          style={[s.row, profile.programId === p.id && s.on]}>
          <Text style={s.rowTitle}>{p.name}</Text>
          <Text style={s.rowSub}>{p.courses.length} courses</Text>
        </Pressable>
      ))}

      {!!courses.length && <Text style={s.h2}>Your courses</Text>}
      {!!courses.length && <Text style={s.rowSub}>Select every course you are taking, then tap "Show my calendar".</Text>}
      {!!courses.length && <View style={{ height: 10 }} />}
      {courses.map((c) => {
        const on = profile.courseIds.includes(c.id);
        return (
          <View key={c.id}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              onPress={() => dispatch({ type: 'toggleCourse', courseId: c.id })} style={[s.row, on && s.on]}>
              <View style={[s.box, on && s.boxOn]}>{on && <Text style={s.tick}>✓</Text>}</View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{c.code}</Text>
                {!!c.name && <Text style={s.rowSub}>{c.name}</Text>}
              </View>
            </Pressable>
            {on && c.options && (
              <View style={s.opts}>
                <Text style={s.rowSub}>Which grading option is your section using?</Text>
                <View style={s.optRow}>
                  {c.options.map((o) => {
                    const sel = (profile.gradingOptions[c.id] ?? c.options![0].id) === o.id;
                    return (
                      <Pressable key={o.id} onPress={() => dispatch({ type: 'setOption', courseId: c.id, optionId: o.id })}
                        style={[s.chip, sel && s.chipOn]}>
                        <Text style={[s.chipText, sel && { color: '#fff' }]}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        );
      })}

    </ScrollView>
    <View style={s.footer}>
      <Pressable disabled={!count} onPress={onDone} accessibilityRole="button" style={[s.cta, !count && { opacity: 0.4 }]}>
        <Text style={s.ctaText}>{count ? `Show my calendar (${count} course${count === 1 ? '' : 's'})` : 'Select at least one course'}</Text>
      </Pressable>
    </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.paper },
  body: { padding: 20, maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  h1: { fontSize: 28, fontWeight: '700', color: t.ink },
  h2: { fontSize: 17, fontWeight: '600', color: t.ink, marginTop: 24, marginBottom: 8 },
  sub: { color: t.sub, marginTop: 6, fontSize: 15, lineHeight: 22 },
  row: { backgroundColor: t.card, borderRadius: t.r, borderWidth: 1.5, borderColor: t.line, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  on: { borderColor: t.accent, backgroundColor: t.accentSoft },
  rowTitle: { fontSize: 16, fontWeight: '600', color: t.ink },
  rowSub: { fontSize: 13, color: t.sub },
  opts: { paddingHorizontal: 6, paddingBottom: 10 },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: t.accent },
  chipOn: { backgroundColor: t.accent },
  chipText: { color: t.accent, fontWeight: '600', fontSize: 13 },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: t.sub, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: t.accent, borderColor: t.accent },
  tick: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  footer: { padding: 12, backgroundColor: t.card, borderTopWidth: 1, borderTopColor: t.line },
  cta: { backgroundColor: t.accent, borderRadius: t.r, padding: 16, alignItems: 'center', maxWidth: 640, width: '100%', alignSelf: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
