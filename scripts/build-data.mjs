// Converts data/source/schedule.xlsx (the weekly grid) into src/data/schedule.json.
// Usage: npm run data [-- path/to/other.xlsx]
import XLSX from 'xlsx';
import fs from 'node:fs';

const input = process.argv[2] || 'data/source/schedule.xlsx';
const out = 'src/data/schedule.json';
// Sheet name -> program. Edit when sheets are renamed or added.
const PROGRAMS = [
  { match: /courses/i, id: 'winter', name: 'Winter term' },
  { match: /transition/i, id: 'transition', name: 'Engineering transition semester' },
];
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const warnings = [];
const warn = (m) => warnings.push(m);

const iso = (d) => d.toISOString().slice(0, 10);
const mk = (y, m, d) => new Date(Date.UTC(y, m, d));
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// ---- weeks -----------------------------------------------------------
function parseRange(text, year) {
  const m = String(text).match(/([A-Za-z]+)\.?\s+(\d+)\s*-\s*(?:([A-Za-z]+)\.?\s+)?(\d+)/);
  if (!m) return null;
  const m1 = MONTHS[m[1].slice(0, 3).toLowerCase()];
  const m2 = m[3] ? MONTHS[m[3].slice(0, 3).toLowerCase()] : m1;
  return { start: mk(year, m1, +m[2]), end: mk(year, m2, +m[4]) };
}

// ---- items -----------------------------------------------------------
const KEEP = /quiz|lab|assignment|midterm|exam|project|report|homework|test|presentation|catia|manual studio|cad/i;
const SKIP = /^(course )?introduction|\breview\b|\bprep\b|^in-lab|^pre-lab|^tutorial \d+\s*(\(.*\))?$|brainstorm|finalize|registration|^instructions|^group work/i;

function splitItems(cell) {
  const t = String(cell).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (!t.startsWith('-') && t.length > 100) return []; // general notes, not deadlines
  return t.split(/(?:^|\s)-\s+/).map((s) => s.trim()).filter(Boolean)
    .filter((s) => s.length < 220 && KEEP.test(s) && !SKIP.test(s));
}

function parseWhen(text, year) {
  let date = null, time = null;
  const d = text.match(/\b(Jan|Feb|Mar|Apr|May)[a-z]*\.?\s+(\d{1,2})\b/i);
  if (d) date = iso(mk(year, MONTHS[d[1].toLowerCase()], +d[2]));
  const t = text.match(/(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap])\.?m\b/i);
  if (t) {
    let h = +t[1] % 12; if (t[3].toLowerCase() === 'p') h += 12;
    time = `${String(h).padStart(2, '0')}:${t[2] || '00'}`;
  }
  return { date, time };
}

function classify(s) {
  if (/exam/i.test(s) && !/midterm/i.test(s)) return 'exam';
  if (/midterm|\btest\b/i.test(s)) return 'midterm';
  if (/quiz/i.test(s)) return 'quiz';
  if (/lab|experiment|manual studio/i.test(s)) return 'lab';
  if (/assignment|homework/i.test(s)) return 'assignment';
  return 'project';
}

function title(s) {
  const t = s.replace(/\[.*?\]/g, '').replace(/\s+(due|on|during)\b.*$/i, '').replace(/\s+/g, ' ').trim();
  return t.length > 60 ? t.slice(0, 57) + '...' : t;
}

// ---- evaluation breakdown (weights) ----------------------------------
const stem = (w) => w.replace(/^quizzes$/, 'quiz').replace(/(es|s)$/, '').replace(/^examination$/, 'exam').replace(/^laboratory$/, 'lab').replace(/^experiment$/, 'lab');
const tokens = (s) => s.replace(/\([^)]*\d[^)]*\)/g, ' ').toLowerCase().match(/[a-z]+|\d+/g)?.map(stem) ?? [];
const STOP = new Set(['in', 'person', 'of', 'the', 'and', 'on', 'a', 'due', 'during', 'regular', 'from', 'pm', 'am', 'for', 'to', 'mark']);

function parseComponents(text) {
  const clean = text.replace(/\([^)]*\d[^)]*\)/g, ' ').replace(/Evaluation Breakdown:?/i, '').split(/Note:|Please check|Others\b/)[0];
  const comps = [];
  for (const m of clean.matchAll(/([A-Za-z][^%]*?)\s*[-:]\s*(\d+(?:\.\d+)?)\s*%?(?=\s|$)/g)) {
    comps.push({ name: m[1].trim(), total: +m[2], tokens: tokens(m[1]).filter((t) => !STOP.has(t)) });
  }
  return comps;
}

function parseBreakdown(text) {
  const parts = text.split(/Option\s+(\d)/i);
  if (parts.length < 3) return { default: parseComponents(text) };
  const res = {};
  for (let i = 1; i < parts.length; i += 2) res[`opt${parts[i]}`] = parseComponents(parts[i + 1]);
  return res;
}

// Splits each breakdown component's total evenly across the items matched to it.
function assignWeights(items, comps) {
  const groups = new Map(), picked = new Map();
  for (const it of items) {
    const toks = tokens(it.title).filter((t) => !STOP.has(t));
    let best = null, bestScore = 0, tie = false;
    for (const c of comps) {
      const sc = toks.reduce((a, t) => a + (c.tokens.includes(t) ? (/^\d+$/.test(t) ? 0.5 : /^(midterm|final)$/.test(t) ? 2 : 1) : 0), 0);
      if (sc > bestScore) { best = c; bestScore = sc; tie = false; } else if (sc === bestScore && sc > 0) tie = true;
    }
    const c = bestScore >= 1 && !tie ? best : null;
    picked.set(it, c);
    if (c) groups.set(c, (groups.get(c) || 0) + 1);
  }
  return (it) => { const c = picked.get(it); return c ? Math.round((c.total / groups.get(c)) * 100) / 100 : null; };
}

// ---- main ------------------------------------------------------------
const wb = XLSX.readFile(input);
const programs = [];

for (const sheetName of wb.SheetNames) {
  const prog = PROGRAMS.find((p) => p.match.test(sheetName));
  if (!prog) { warn(`Sheet "${sheetName}" ignored (no program mapping in build-data.mjs)`); continue; }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  const year = +(rows[0].join(' ').match(/(20\d{2})/)?.[1] ?? new Date().getFullYear());
  const hIdx = rows.findIndex((r) => String(r[0]).trim() === 'Week');
  const header = rows[hIdx];
  const courses = [];
  for (let c = 2; c < header.length; c++) {
    const code = String(header[c]).trim();
    if (code) courses.push({ col: c, id: code.replace(/\s+/g, ''), code, programId: prog.id });
  }

  const weeks = [];
  const body = rows.slice(hIdx + 1);
  for (const r of body) {
    const a = String(r[0]).trim();
    const range = parseRange(r[1], year);
    if (!range) continue;
    if (/^\d/.test(a)) weeks.push({ id: `w${parseInt(a)}`, label: `Week ${parseInt(a)}`, kind: 'week', start: iso(range.start), end: iso(addDays(range.start, 6)), row: r });
    else if (/exam/i.test(a)) weeks.push({ id: 'exam', label: 'Exam period', kind: 'exam', start: iso(range.start), end: iso(range.end), row: r });
    else if (!a && /R\s*E\s*A\s*D/i.test(r.join(' '))) weeks.push({ id: 'reading', label: 'Reading week', kind: 'reading', start: iso(range.start), end: iso(addDays(range.start, 6)), row: r });
  }
  const weekFor = (date) => weeks.find((w) => w.kind !== 'reading' && date >= w.start && date <= w.end);

  const otherRow = body.find((r) => String(r[0]).trim() === 'Other') || [];
  const assessments = [];
  for (const course of courses) {
    const bd = parseBreakdown(String(otherRow[course.col] || ''));
    if (Object.keys(bd).length === 1 && !bd.default.length) warn(`${course.code}: no evaluation breakdown found, weights left blank`);
    const items = [], seen = new Set();
    for (const w of weeks) {
      for (const raw of splitItems(w.row[course.col] || '')) {
        const when = parseWhen(raw, year);
        let wk = w;
        if (when.date) {
          const real = weekFor(when.date);
          if (real && real.id !== w.id) { warn(`${course.code} "${title(raw)}": listed in ${w.label} but dated ${when.date} (${real.label}); date used`); wk = real; }
        }
        const t = title(raw);
        if (seen.has(t.toLowerCase())) continue; // repeated across weeks (labs spanning two weeks)
        seen.add(t.toLowerCase());
        items.push({
          id: `${course.id}-${wk.id}-${slug(t)}`, courseId: course.id, programId: prog.id,
          title: t, type: classify(raw), weekId: wk.id, date: when.date, time: when.time,
          precision: when.date ? 'exact' : 'week', ...(/not for marks|practice/i.test(raw) ? { notes: 'Not for marks' } : {}),
        });
      }
    }
    const optionIds = Object.keys(bd);
    if (optionIds[0] !== 'default') course.options = optionIds.map((id) => ({ id, label: `Option ${id.slice(3)}` }));
    const resolvers = Object.fromEntries(optionIds.map((o) => [o, assignWeights(items, bd[o])]));
    for (const it of items) {
      it.weights = Object.fromEntries(optionIds.map((o) => [o, it.notes ? 0 : resolvers[o](it)]));
      if (Object.values(it.weights).some((v) => v === null)) warn(`${course.code} "${it.title}": weight not matched, left blank`);
    }
    assessments.push(...items);
  }
  programs.push({
    id: prog.id, name: prog.name, year,
    courses: courses.map(({ col, ...c }) => c),
    weeks: weeks.map(({ row, ...w }) => w),
    assessments,
  });
}
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync(out, JSON.stringify({ dataVersion: new Date().toISOString().slice(0, 10), programs }, null, 1));
fs.writeFileSync('data/validation-report.txt', warnings.join('\n') + '\n');
console.log(`Wrote ${out}: ${programs.map((p) => `${p.id} (${p.courses.length} courses, ${p.assessments.length} items)`).join(', ')}`);
console.log(`${warnings.length} warnings -> data/validation-report.txt`);
