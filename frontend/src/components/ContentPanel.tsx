import { lazy, Suspense, useState, useEffect } from 'react';
import type { AudioClip, LessonSummary } from '../types/lesson';
import { useDictationStore } from '../stores/dictationStore';
import HomeView from '../views/HomeView';
import DictationView from '../views/DictationView';
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

  const dictationActive = useDictationStore(s => s.active);
  if (dictationActive) return <DictationView />;

  const section = activeSection;
  return (
    <Suspense fallback={<Fallback />}>
      {section === 'home' && <HomeView search={search} onSearchChange={setSearch} lessons={lessons} clips={clips} uniqueWords={wordCount} />}
      {section === 'courses' && <CoursesView lessons={lessons} />}
      {section === 'clips' && <ClipsView clips={clips} onDeleteClip={onDeleteClip} />}
      {section === 'words' && <WordsView />}
      {section === 'stats' && <StatsView />}
      {section === 'import' && <ImportView />}
      {section === 'playlist' && <PlaylistView />}
      {section === 'favorites' && <FavoritesView />}
      {section === 'dictation' && <DictationHistoryView />}
      {section === 'recent' && <RecentView lessons={lessons} />}
      {section === 'settings' && <SettingsView />}
    </Suspense>
  );
}
