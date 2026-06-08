import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import type { LessonSummary } from './types/lesson';
import { useClipsStore } from './stores/clipsStore';
import { useAudioStore, preloadLessonAudio } from './stores/audioStore';
import { useCollectionsStore } from './stores/collectionsStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { getLessons, getLessonStats } from './lib/api';
import Sidebar, { type NavSection } from './components/Sidebar';
import MobileTabBar from './components/MobileTabBar';
import ContentPanel from './components/ContentPanel';
import PlayerBar from './components/PlayerBar';
import ToastContainer from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { useFavoritesStore } from './stores/favoritesStore';
import QueuePanel from './components/QueuePanel';

function AppContent() {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const clips = useClipsStore(s => s.clips);
  const favItems = useFavoritesStore(s => s.items);
  const collections = useCollectionsStore(s => s.collections);
  const loadFavorites = useFavoritesStore(s => s.loadFavorites);
  const removeClip = useClipsStore(s => s.removeClip);
  const navigate = useNavigate();
  const location = useLocation();

  useKeyboardShortcuts();

  const pathToSection = (path: string): NavSection => {
    const seg = path.split('/')[1] || 'home';
    if (seg === 'collections') return 'collections';
    const valid: NavSection[] = ['home','courses','clips','words','collections','stats','favorites','settings'];
    return valid.includes(seg as NavSection) ? (seg as NavSection) : 'home';
  };
  const activeSection = pathToSection(location.pathname);

  useEffect(() => {
    getLessons()
      .then(data => { setLessons(data); preloadLessonAudio(data.map(l => l.id)); })
      .catch(() => {});
    getLessonStats()
      .then(s => setWordCount(s.uniqueWords))
      .catch(() => {});
    useClipsStore.getState().loadClips();
    loadFavorites();
    useCollectionsStore.getState().loadCollections();
  }, []);

  const handleDeleteClip = (id: string) => {
    const m = useAudioStore.getState().mode;
    if (m.kind === 'clip' && m.clip.id === id) useAudioStore.getState().clearMode();
    removeClip(id);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'q' && !e.ctrlKey && !e.metaKey && !e.target) {
        setQueueOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--bg-primary)]">
      <div className="hidden md:flex">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={(s) => navigate(`/${s === 'home' ? '' : s}`)}
          lessonCount={lessons.length}
          clipsCount={clips.length}
          wordCount={wordCount}
          favCount={favItems.length}
          collectionCount={collections.length}
        />
      </div>
      <MobileTabBar
        activeSection={activeSection}
        onSectionChange={(s) => navigate(`/${s === 'home' ? '' : s}`)}
      />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 pb-16 md:pb-16" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
        <ContentPanel
          activeSection={activeSection}
          lessons={lessons}
          clips={clips}
          wordCount={wordCount}
          onDeleteClip={handleDeleteClip}
        />
      </main>
      <PlayerBar onQueueToggle={() => setQueueOpen(v => !v)} />
      <QueuePanel open={queueOpen} onClose={() => setQueueOpen(false)} />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
