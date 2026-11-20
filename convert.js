const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelFilePath = path.join(__dirname, 'Workload_Calendar.xlsx');
const outputFilePath = path.join(__dirname, 'data.js');

// 1. Read the workbook and first sheet
const workbook = XLSX.readFile(excelFilePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const rawRows = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });

// Term labels in the sheet are mapped onto a single "winter" key. The former
// Engineering Transition courses (CHY 102, MTH 140, MTH 141, PCS 211) are now
// shown as "Semester 1" in the same Winter list, so they are folded in here.
function normalizeTerm(value) {
  const t = String(value || '').trim().toLowerCase();
  if (t.startsWith('winter') || t.includes('transition')) return 'winter';
  return t;
}

// 2. Group flat rows into the nested structure
const courseData = {};

rawRows.forEach((rawRow) => {
  // Normalize headers to lowercase so capitalization/spaces never break the script
  const row = {};
  for (const key in rawRow) {
    row[key.trim().toLowerCase()] = rawRow[key];
  }

  const term = normalizeTerm(row.term);
  const code = String(row.course || '').trim();

  // Skip empty rows
  if (!term || !code) return;

  // Create term array if it doesn't exist yet (e.g., courseData.winter = [])
  if (!courseData[term]) {
    courseData[term] = [];
  }

  // Find or create the course object
  let course = courseData[term].find((c) => c.code === code);
  if (!course) {
    course = {
      code: code,
      name: String(row['course name'] || row.name || '').trim(),
      workload: []
    };
    courseData[term].push(course);
  }

  // Add the workload item (mapping "Dates" -> date)
  if (row.item) {
    course.workload.push({
      week: Number(row.week) || row.week,
      date: String(row.dates || '').trim(),
      item: String(row.item).trim(),
      description: String(row.description || '').trim()
    });
  }
});

// 3. Read the "Evaluation Breakdown" sheet (columns: Term, Course, Breakdown)
//    -> { winter: { "MTH 240": "Evaluation Breakdown:\n..." }, transition: { ... } }
const evaluationData = {};
const evalSheetName =
  workbook.SheetNames.find((n) => n.trim().toLowerCase().includes('evaluation')) ||
  workbook.SheetNames[1];

if (evalSheetName) {
  const evalRows = XLSX.utils.sheet_to_json(workbook.Sheets[evalSheetName], { raw: false, defval: "" });

  evalRows.forEach((rawRow) => {
    const row = {};
    for (const key in rawRow) {
      row[key.trim().toLowerCase()] = rawRow[key];
    }

    // "term" is the current header; "program" is accepted for older copies of the sheet
    const term = normalizeTerm(row.term || row.program);
    const code = String(row.course || '').trim();
    const breakdown = String(row.breakdown || '').trim();

    if (!term || !code || !breakdown) return;

    if (!evaluationData[term]) {
      evaluationData[term] = {};
    }
    evaluationData[term][code] = breakdown;
  });
} else {
  console.warn('No evaluation sheet found; COURSE_EVALUATIONS will be empty.');
}

// 4. Write to data.js
const jsContent =
  `window.COURSE_DATA = ${JSON.stringify(courseData, null, 2)};\n` +
  `window.COURSE_EVALUATIONS = ${JSON.stringify(evaluationData, null, 2)};\n`;
fs.writeFileSync(outputFilePath, jsContent, 'utf8');

console.log(`Success! Exported terms:`, Object.keys(courseData));
console.log(`Exported evaluation breakdowns:`,
  Object.keys(evaluationData).map((t) => `${t} (${Object.keys(evaluationData[t]).length})`).join(', '));
