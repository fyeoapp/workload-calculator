import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import type { Override, Profile, Status } from '../types';

const KEY = 'workload.profile.v1';
const empty: Profile = { schemaVersion: 1, programId: null, courseIds: [], gradingOptions: {}, overrides: {}, statuses: {} };

type Action =
  | { type: 'load'; profile: Profile }
  | { type: 'setProgram'; programId: string }
  | { type: 'toggleCourse'; courseId: string }
  | { type: 'setOption'; courseId: string; optionId: string }
  | { type: 'setOverride'; id: string; override: Override }
  | { type: 'resetOverride'; id: string }
  | { type: 'setStatus'; id: string; status: Status }
  | { type: 'reset' };

function reducer(s: Profile, a: Action): Profile {
  switch (a.type) {
    case 'load': return a.profile;
    case 'setProgram': return a.programId === s.programId ? s : { ...empty, programId: a.programId };
    case 'toggleCourse': {
      const has = s.courseIds.includes(a.courseId);
      return { ...s, courseIds: has ? s.courseIds.filter((c) => c !== a.courseId) : [...s.courseIds, a.courseId] };
    }
    case 'setOption': return { ...s, gradingOptions: { ...s.gradingOptions, [a.courseId]: a.optionId } };
    case 'setOverride': return { ...s, overrides: { ...s.overrides, [a.id]: { ...s.overrides[a.id], ...a.override } } };
    case 'resetOverride': { const { [a.id]: _, ...rest } = s.overrides; return { ...s, overrides: rest }; }
    case 'setStatus': return { ...s, statuses: { ...s.statuses, [a.id]: a.status } };
    case 'reset': return empty;
  }
}

const Ctx = createContext<{ profile: Profile; loaded: boolean; dispatch: React.Dispatch<Action> } | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, dispatch] = useReducer(reducer, empty);
  const [loaded, setLoaded] = React.useState(false);
  const skipSave = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v) { const p = JSON.parse(v); if (p?.schemaVersion === 1) dispatch({ type: 'load', profile: { ...empty, ...p } }); } })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) { skipSave.current = false; return; }
    AsyncStorage.setItem(KEY, JSON.stringify(profile)).catch(() => {});
  }, [profile, loaded]);

  return <Ctx.Provider value={{ profile, loaded, dispatch }}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useProfile must be used inside <ProfileProvider>');
  return c;
}
