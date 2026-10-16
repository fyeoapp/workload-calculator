# Workload Calculator

A first-year engineering calendar. Students pick a program and their courses; the app shows a week-by-week view of deadlines and flags busy weeks. Everything the student enters is stored on the device. There is no login and no backend.

This is a **prototype**. It runs as a web app today, and the UI is written so it can be added to the main React Native app (RN 0.83, React Navigation, AsyncStorage) as an npm git dependency.

## Quick start

```bash
npm install
npm run dev          # web demo at http://localhost:5173
npm run build:web    # static site in demo/dist
npm run typecheck
npm run data         # rebuild src/data/schedule.json from the Excel sheet
```

The demo has a "pretend today is" box because the Winter 2026 dates are in the past. It defaults to 2026-02-09.

## How it works

```
data/source/schedule.xlsx ──npm run data──▶ src/data/schedule.json ──▶ src/data/api.ts ──▶ logic ──▶ UI
                                    └────▶ data/validation-report.txt
```

| Path | Purpose |
|---|---|
| `scripts/build-data.mjs` | Converts the Excel grid to JSON and writes a validation report |
| `src/data/api.ts` | `getPrograms / getCourses / getAssessments`. **The only file that knows where data comes from.** The UI never imports the JSON directly |
| `src/logic/weeks.ts` | Applies student edits, groups items into weeks, scores each week |
| `src/logic/config.ts` | Busy-week thresholds and weighting |
| `src/storage/profile.tsx` | `ProfileProvider` / `useProfile` (useReducer + Context, persisted to AsyncStorage) |
| `src/ui/SetupScreen.tsx`, `CalendarScreen.tsx` | The two screens (React Native primitives only) |
| `demo/` | Vite web shell. Not part of the package |

Rules that keep it portable: only `react`, `react-native`, AsyncStorage and `date-fns` are used. There are no `div`s, no CSS files, no `window`/`document` access and no Expo packages. Keep it that way inside `src/`.

## Product behaviour

- Students choose one program (**Winter term** or **Engineering transition semester**). Courses cannot be mixed across programs. Changing the program clears the course selection.
- Courses with several grading schemes (currently CHY 102, Options 1 to 4) show an option picker. The weights come from the chosen option.
- Deadlines with an exact date show on that day. Items that only have a week show "Due this week". Final exams show "During exam period".
- Students can edit any due date or weight. The edit dialog shows a warning that they are responsible for the accuracy of the data. Edits are stored as **overrides**, separate from the official data, and can be reset. Edited items are labelled "edited by you".
- Weeks are flagged **Busy** or **Heavy** and show a one-line reason, for example "5 deadlines, including MTH 240 midterm test (35%)".

### Busy-week score

`score = sum(weights) + 1.5 × number of items + 0.5 × heaviest weight`

Blank weights count as 3. Items with weight 0 (practice exams, "not for marks") are ignored, and so are items the student has marked **Completed**, so a week or day gets lighter as work is finished. The same formula is used per day in the calendar view, with its own thresholds (`DAY_BUSY_AT`, `DAY_HEAVY_AT`). In the calendar, light days are green, busy days amber and heavy days red. A score of 25 or more is **busy** and 50 or more is **heavy**. Tune these in `src/logic/config.ts`.

## Updating the data each term

1. Replace `data/source/schedule.xlsx` with the new sheet (same layout: a title row containing the year, a header row starting with `Week`, `Dates`, then one column per course, one row per week, an `Exam Period` row, and an `Other` row holding each course's "Evaluation Breakdown").
2. If sheet names changed, edit the `PROGRAMS` list at the top of `scripts/build-data.mjs`.
3. Run `npm run data`.
4. Open `data/validation-report.txt` and fix what it lists, either in the sheet (then rerun) or by editing `src/data/schedule.json` directly for one-off corrections.
5. Run `npm run dev`, check a few courses against D2L, then commit and release.

### What the converter does

- Reads the year from the title row and builds each week's Monday-to-Sunday range. Reading week and the exam period are handled separately.
- Splits each cell into items at `- ` bullets. It **keeps** quizzes, labs, assignments, homework, midterms, tests, exams, projects, reports and presentations. It **drops** lectures, reviews, prep sessions, tutorials on their own, introductions and long general notes.
- Pulls an explicit date and time out of the text when there is one. If the date falls in a different week from the row it was listed in, **the explicit date wins** and a warning is written.
- **Weights** are inferred, not read directly. The "Evaluation Breakdown" text is split into components ("Quizzes - 10%"). Each item is matched to a component by keywords, and the component's total is divided evenly among its items. Items that match nothing get a blank weight, shown as `?%`. Practice exams and "not for marks" items get weight 0.
- Items repeated across weeks (a lab that spans two weeks) are kept once.

Expect to review the validation report each term. At the time of writing, the known blanks are CHY 211 (Laboratory Techniques Report), AER 222 and BME 100 (presentations) and MEC 222 (Manual Studio and CAD items).

### Data model (`src/types.ts`)

Each assessment has `id` (stable: course, week and title), `courseId`, `type`, `weekId`, `date`/`time` (or null), `precision` (`exact` or `week`) and `weights` keyed by grading option (or `default`). Courses and programs carry room for future fields, so adding upper years or other engineering departments means adding programs, not changing the model.

## Calendar view, statuses and filter

- The **Calendar** tab shows a month grid with only the items that have an exact due date. Items with just a week appear in the **Weeks** tab.
- Every assessment has a status: Not started (default), In progress or Completed. Tap the status pill on an item to cycle through them. Statuses are saved in the student profile (`statuses`, keyed by assessment id).
- The chips under the tabs (All, Not started, In progress, Completed) filter both views. `src/ui/StatusPill.tsx` holds the pill and the filter.

## Student data

Stored under the AsyncStorage key `workload.profile.v1`:

```json
{ "schemaVersion": 1, "programId": "winter", "courseIds": ["MTH240"],
  "gradingOptions": {}, "overrides": { "<assessmentId>": { "date": "2026-02-27", "weight": 30 } } }
```

On web, AsyncStorage uses `localStorage`, so the data lives in one browser on one device and is lost if the student clears site data. To change this shape, bump `schemaVersion` and add a migration in `profile.tsx` (currently any other version is ignored). The shape is designed to map onto a future Firestore document such as `users/{uid}/workloadProfile`.

**Known limitation:** overrides are keyed by assessment ID. If a new term's sheet renames or moves an item, the old override no longer matches. Clear stored data on a term rollover or add a data-version check.

## Adding it to the main app

Install as an npm git dependency:

```bash
npm install github:YOUR-ORG/workload-calculator#v0.1.0
```

The package ships TypeScript source (`"react-native": "src/index.ts"`), so Metro compiles it with the app's Babel config. Its peer dependencies (`react`, `react-native`, AsyncStorage) must already be in the main app. Then:

```tsx
import { ProfileProvider, SetupScreen, CalendarScreen } from 'workload-calculator';

// Wrap once, high enough to cover both screens:
<ProfileProvider>…</ProfileProvider>

// Register as React Navigation screens:
<Stack.Screen name="WorkloadSetup">
  {({ navigation }) => <SetupScreen onDone={() => navigation.navigate('WorkloadCalendar')} />}
</Stack.Screen>
<Stack.Screen name="WorkloadCalendar">
  {({ navigation }) => <CalendarScreen onEditCourses={() => navigation.navigate('WorkloadSetup')} />}
</Stack.Screen>
```

Use `useProfile()` to decide the initial route (`profile.courseIds.length ? 'WorkloadCalendar' : 'WorkloadSetup'`, after `loaded` is true). Release by tagging the repo and bumping the tag in the main app's `package.json`. Updating the schedule data means a new tag.

**Native checklist (not yet tested on devices):** the prototype has been type-checked and built for web only. Before shipping on iOS/Android, run it on both and check the edit modal's keyboard behaviour, safe-area insets (wrap the screens in the app's safe-area container) and scroll performance. `FlatList` can replace `ScrollView` if the week list feels slow.

## Not in the prototype

Login or sync, Firestore, notifications, month-grid view, a date picker (dates are typed as `YYYY-MM-DD`), comfort levels, challenges and university resources. The data layer, versioned profile and per-program model are the hooks for these.

## Tests

There are no automated tests yet. The most valuable first ones are for `build-data.mjs` (date, time and weight parsing against a small fixture sheet) and `summarizeWeeks` (thresholds).
