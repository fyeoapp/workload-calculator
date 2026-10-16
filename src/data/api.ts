// The ONLY place that knows where course data comes from. Swap this file to load from a hosted JSON/Firestore later.
import raw from './schedule.json';
import type { Assessment, Course, Program } from '../types';
import { COURSE_NAMES } from './courseNames';

const data = raw as unknown as { dataVersion: string; programs: Program[] };

export const getDataVersion = (): string => data.dataVersion;
export const getPrograms = (): Program[] => data.programs;
export const getProgram = (id: string): Program | undefined => data.programs.find((p) => p.id === id);
export const getCourses = (programId: string): Course[] =>
  (getProgram(programId)?.courses ?? []).map((c) => ({ ...c, name: COURSE_NAMES[c.code] || undefined }));
export const getAssessments = (programId: string, courseIds: string[]): Assessment[] =>
  (getProgram(programId)?.assessments ?? []).filter((a) => courseIds.includes(a.courseId));
