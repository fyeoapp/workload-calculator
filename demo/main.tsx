import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Text, TextInput, View } from 'react-native';
import { CalendarScreen, ProfileProvider, SetupScreen, useProfile } from 'workload-calculator';

// Winter 2026 data is in the past, so the demo lets you pretend it is another day.
function Shell() {
  const { profile, loaded } = useProfile();
  const [screen, setScreen] = useState<'setup' | 'calendar' | null>(null);
  const [today, setToday] = useState('2026-02-09');
  // Decide the starting screen ONCE, after saved data has loaded. Never switch automatically afterwards.
  useEffect(() => {
    if (loaded && screen === null) setScreen(profile.courseIds.length ? 'calendar' : 'setup');
  }, [loaded]);
  if (!screen) return null;
  const show = screen;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, backgroundColor: '#17212B' }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>Demo: pretend today is</Text>
        <TextInput value={today} onChangeText={setToday} style={{ backgroundColor: '#fff', padding: 4, borderRadius: 4, width: 110, fontSize: 12 }} />
      </View>
      {show === 'setup' ? <SetupScreen onDone={() => setScreen('calendar')} />
        : <CalendarScreen today={today} onEditCourses={() => setScreen('setup')} />}
    </View>
  );
}

createRoot(document.getElementById('root')!).render(<ProfileProvider><Shell /></ProfileProvider>);
