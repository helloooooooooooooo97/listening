import { lazy, Suspense, useState, useEffect } from 'react';
import type { AudioClip, LessonSummary } from '../types/lesson';
import HomeView from '../views/HomeView';
import type { NavSection } from './Sidebar';

// Lazy-loaded views — loaded on first visit only
const CoursesView = lazy(() => import('../views/CoursesView'));
const ClipsView = lazy(() => import('../views/ClipsView'));
const WordsView = lazy(() => import('../views/WordsView'));
const RecentView = lazy(() => import('../views/RecentView'));
const SettingsView = lazy(() => import('../views/SettingsView'));
const StatsView = lazy(() => import('../views/StatsView'));
const DictationHistoryView = lazy(() => import('../views/DictationHistoryView'));
const FavoritesView = lazy(() => import('../views/FavoritesView'));
const PlaylistView = lazy(() => import('../views/PlaylistView'));
const ImportView = lazy(() => import('../views/ImportView'));

function Fallback() {
  return (
    <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-5 h-5 border-2 border-white/10 border-t-[var(--accent)] rounded-full animate-spin" />
    </div>
  );
}

/** Wraps each view with a fade-in transition triggered by key change */
function ViewTransition({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <div key={id} className="h-full animate-fade-in" style={{ animationDuration: '0.25s' }}>
      {children}
    </div>
  );
}

interface Props {
  activeSection: NavSection;
  lessons: LessonSummary[];
  clips: AudioClip[];
  wordCount: number;
  onDeleteClip: (id: string) => void;
}

export default function ContentPanel({ activeSection, lessons, clips, wordCount, onDeleteClip }: Props) {
  const [search, setSearch] = useState('');

  useEffect(() => { setSearch(''); }, [activeSection]);

  const section = activeSection;
  return (
    <Suspense fallback={<Fallback />}>
      {section === 'home' && <ViewTransition id="home"><HomeView search={search} onSearchChange={setSearch} lessons={lessons} clips={clips} uniqueWords={wordCount} /></ViewTransition>}
      {section === 'courses' && <ViewTransition id="courses"><CoursesView lessons={lessons} /></ViewTransition>}
      {section === 'clips' && <ViewTransition id="clips"><ClipsView clips={clips} onDeleteClip={onDeleteClip} /></ViewTransition>}
      {section === 'words' && <ViewTransition id="words"><WordsView /></ViewTransition>}
      {section === 'stats' && <ViewTransition id="stats"><StatsView /></ViewTransition>}
      {section === 'import' && <ViewTransition id="import"><ImportView /></ViewTransition>}
      {section === 'playlist' && <ViewTransition id="playlist"><PlaylistView /></ViewTransition>}
      {section === 'favorites' && <ViewTransition id="favorites"><FavoritesView /></ViewTransition>}
      {section === 'dictation' && <ViewTransition id="dictation"><DictationHistoryView /></ViewTransition>}
      {section === 'recent' && <ViewTransition id="recent"><RecentView lessons={lessons} /></ViewTransition>}
      {section === 'settings' && <ViewTransition id="settings"><SettingsView /></ViewTransition>}
    </Suspense>
  );
}
