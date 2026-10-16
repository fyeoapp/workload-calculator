import { addDays, format, parseISO } from 'date-fns';
import { getAssessments, getProgram } from '../data/api';
import type { Level, Profile, ResolvedAssessment, WeekSummary } from '../types';
import { WORKLOAD as C } from './config';

export const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseISO(s).getTime());

export function resolveAssessments(profile: Profile): ResolvedAssessment[] {
  const program = profile.programId ? getProgram(profile.programId) : undefined;
  if (!program) return [];
  const codes = Object.fromEntries(program.courses.map((c) => [c.id, c.code]));
  return getAssessments(program.id, profile.courseIds).map((a) => {
    const o = profile.overrides[a.id];
    const opt = profile.gradingOptions[a.courseId];
    const base = a.weights[opt] ?? a.weights.default ?? Object.values(a.weights)[0] ?? null;
    const date = o && 'date' in o ? o.date ?? null : a.date;
    const week = date && program.weeks.find((w) => w.kind !== 'reading' && date >= w.start && date <= w.end);
    return {
      ...a, courseCode: codes[a.courseId], effectiveDate: date,
      effectiveWeight: o && 'weight' in o ? o.weight ?? null : base,
      weekId: week ? week.id : a.weekId, edited: !!o,
      status: profile.statuses?.[a.id] ?? 'not_started',
    };
  });
}

export function summarizeWeeks(profile: Profile): WeekSummary[] {
  const program = profile.programId ? getProgram(profile.programId) : undefined;
  if (!program) return [];
  const all = resolveAssessments(profile);
  return program.weeks.map((week) => {
    const items = all.filter((i) => i.weekId === week.id).sort((a, b) =>
      (a.effectiveDate ?? week.start).localeCompare(b.effectiveDate ?? week.start) || a.courseCode.localeCompare(b.courseCode));
    const done = items.filter((i) => i.status === 'completed').length;
    const graded = items.filter((i) => i.effectiveWeight !== 0 && i.status !== 'completed'); // completed work no longer counts
    const ws = graded.map((i) => i.effectiveWeight ?? C.UNKNOWN_WEIGHT);
    const score = ws.reduce((a, b) => a + b, 0) + C.PER_ITEM * ws.length + C.HEAVIEST * Math.max(0, ...ws);
    const level: Level = week.kind !== 'week' ? 'normal' : score >= C.HEAVY_AT ? 'heavy' : score >= C.BUSY_AT ? 'busy' : 'normal';
    const top = [...graded].sort((a, b) => (b.effectiveWeight ?? 0) - (a.effectiveWeight ?? 0))[0];
    const reason = !items.length ? 'Nothing due' : done === items.length ? 'All completed' :
      `${graded.length} deadline${graded.length === 1 ? '' : 's'}${done ? ' left' : ''}` +
      (top && (top.effectiveWeight ?? 0) >= 10 ? `, including ${top.courseCode} ${top.title.toLowerCase()} (${top.effectiveWeight}%)` : '');
    return { week, items, score, level, reason };
  });
}

export interface DaySummary { date: string; items: ResolvedAssessment[]; score: number; level: Level }

const scoreOf = (items: ResolvedAssessment[]) => {
  const ws = items.filter((i) => i.effectiveWeight !== 0 && i.status !== 'completed').map((i) => i.effectiveWeight ?? C.UNKNOWN_WEIGHT);
  return ws.reduce((a, b) => a + b, 0) + C.PER_ITEM * ws.length + C.HEAVIEST * Math.max(0, ...ws);
};

/** Only assessments with a definite due date. Keyed by YYYY-MM-DD. */
export function summarizeDays(profile: Profile): Record<string, DaySummary> {
  const byDate: Record<string, ResolvedAssessment[]> = {};
  for (const i of resolveAssessments(profile)) if (i.effectiveDate) (byDate[i.effectiveDate] ??= []).push(i);
  const out: Record<string, DaySummary> = {};
  for (const [date, items] of Object.entries(byDate)) {
    items.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.courseCode.localeCompare(b.courseCode));
    const score = scoreOf(items);
    out[date] = { date, items, score, level: score >= C.DAY_HEAVY_AT ? 'heavy' : score >= C.DAY_BUSY_AT ? 'busy' : 'normal' };
  }
  return out;
}

export const fmtRange = (s: string, e: string) => `${format(parseISO(s), 'MMM d')} – ${format(parseISO(e), 'MMM d')}`;
export const fmtDay = (d: string) => format(parseISO(d), 'EEE MMM d');
export const fmtTime = (t: string) => format(parseISO(`2000-01-01T${t}`), 'h:mm a');
export const todayISO = (d = new Date()) => format(d, 'yyyy-MM-dd');
export { addDays };
