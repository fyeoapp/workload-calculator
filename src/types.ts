export type AssessmentType = 'quiz' | 'lab' | 'assignment' | 'midterm' | 'exam' | 'project';
export interface CourseOption { id: string; label: string }
export interface Course { id: string; code: string; name?: string; programId: string; options?: CourseOption[] }
export interface Week { id: string; label: string; kind: 'week' | 'reading' | 'exam'; start: string; end: string }
export interface Assessment {
  id: string; courseId: string; programId: string; title: string; type: AssessmentType;
  weekId: string; date: string | null; time: string | null; precision: 'exact' | 'week';
  /** Keyed by grading option id, or "default" when the course has a single scheme. */
  weights: Record<string, number | null>; notes?: string;
}
export interface Program { id: string; name: string; year: number; courses: Course[]; weeks: Week[]; assessments: Assessment[] }

export type Status = 'not_started' | 'in_progress' | 'completed';
export interface Override { date?: string | null; weight?: number | null }
/** Everything the student has chosen. Shaped so it can be stored as a Firestore document later. */
export interface Profile {
  schemaVersion: 1;
  programId: string | null;
  courseIds: string[];
  gradingOptions: Record<string, string>;
  overrides: Record<string, Override>;
  /** Progress per assessment id. Missing = 'not_started'. */
  statuses: Record<string, Status>;
}
export interface ResolvedAssessment extends Assessment {
  weekId: string; status: Status; effectiveDate: string | null; effectiveWeight: number | null; edited: boolean; courseCode: string;
}
export type Level = 'normal' | 'busy' | 'heavy';
export interface WeekSummary { week: Week; items: ResolvedAssessment[]; score: number; level: Level; reason: string }
