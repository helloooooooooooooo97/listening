import { useCallback, useEffect, useState } from 'react';
import type { LessonSummary } from './types/lesson';
import { useClipsStore } from './stores/clipsStore';
import { useAudioStore, preloadLessonAudio } from './stores/audioStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Sidebar from './components/Sidebar';
import type { NavSection } from './components/Sidebar';
import ContentPanel from './components/ContentPanel';
import PlayerBar from './components/PlayerBar';
import ToastContainer from './components/Toast';

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const clips = useClipsStore(s => s.clips);
  const removeClip = useClipsStore(s => s.removeClip);

  useKeyboardShortcuts();

  useEffect(() => {
    fetch('/api/lessons/')
      .then(r => r.json())
      .then((data: LessonSummary[]) => { setLessons(data); preloadLessonAudio(data.map(l => l.id)); })
      .catch(() => {});
  }, []);

  const handleDeleteClip = useCallback((id: string) => {
    const m = useAudioStore.getState().mode;
    if (m.kind === 'clip' && m.clip.id === id) useAudioStore.getState().clearMode();
    removeClip(id);
  }, [removeClip]);

  return (
    <div className="h-screen flex overflow-hidden bg-black">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        clipsCount={clips.length}
      />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 pb-16">
        <ContentPanel
          activeSection={activeSection}
          lessons={lessons}
          clips={clips}
          onDeleteClip={handleDeleteClip}
        />
      </main>
      <PlayerBar />
      <ToastContainer />
    </div>
  );
}
