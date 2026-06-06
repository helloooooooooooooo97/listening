import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { LessonSummary } from './types/lesson';
import { useClipsStore } from './stores/clipsStore';
import { useAudioStore, preloadLessonAudio } from './stores/audioStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import Sidebar from './components/Sidebar';
import ContentPanel from './components/ContentPanel';
import PlayerBar from './components/PlayerBar';
import ToastContainer from './components/Toast';

function AppContent() {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const clips = useClipsStore(s => s.clips);
  const removeClip = useClipsStore(s => s.removeClip);
  const navigate = useNavigate();
  const location = useLocation();

  useKeyboardShortcuts();

  // Map path to section
  const pathToSection = (path: string) => {
    const seg = path.split('/')[1] || 'home';
    const valid = ['home','courses','clips','words','stats','dictation','recent','settings'];
    return valid.includes(seg) ? seg : 'home';
  };
  const activeSection = pathToSection(location.pathname);

  useEffect(() => {
    fetch('/api/lessons/')
      .then(r => r.json())
      .then((data: LessonSummary[]) => { setLessons(data); preloadLessonAudio(data.map(l => l.id)); })
      .catch(() => {});
    fetch('/api/lessons/stats')
      .then(r => r.json())
      .then(s => setWordCount(s.uniqueWords))
      .catch(() => {});
    useClipsStore.getState().loadClips();
  }, []);

  const handleDeleteClip = (id: string) => {
    const m = useAudioStore.getState().mode;
    if (m.kind === 'clip' && m.clip.id === id) useAudioStore.getState().clearMode();
    removeClip(id);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-black">
      <Sidebar
        activeSection={activeSection as any}
        onSectionChange={(s) => navigate(`/${s === 'home' ? '' : s}`)}
        lessonCount={lessons.length}
        clipsCount={clips.length}
        wordCount={wordCount}
      />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 pb-16">
        <ContentPanel
          activeSection={activeSection as any}
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
}
