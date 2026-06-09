import { lazy, Suspense, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { AudioClip, LessonSummary } from '../types/lesson';
import HomeView from '../views/HomeView';
import type { NavSection } from './Sidebar';

const CoursesView = lazy(() => import('../views/CoursesView'));
const ClipsView = lazy(() => import('../views/ClipsView'));
const WordsView = lazy(() => import('../views/WordsView'));
const SettingsView = lazy(() => import('../views/SettingsView'));
const StatsView = lazy(() => import('../views/StatsView'));
const FavoritesView = lazy(() => import('../views/FavoritesView'));
const CollectionsView = lazy(() => import('../views/CollectionsView'));
const CollectionDetailView = lazy(() => import('../views/CollectionDetailView'));

function Fallback() {
  return (
    <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-5 h-5 border-2 border-white/10 border-t-[var(--accent)] rounded-full" />
    </div>
  );
}

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
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
}

export default function ContentPanel({ activeSection, lessons, clips, wordCount, onDeleteClip, loading, loadError, onRetry }: Props) {
  const [search, setSearch] = useState('');
  const location = useLocation();
  const isCollectionDetail = location.pathname.startsWith('/collections/') && location.pathname.split('/')[2];

  useEffect(() => { setSearch(''); }, [activeSection]);

  if (loading || loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[var(--bg-primary)] gap-4">
        {loading ? (
          <>
            <div className="w-6 h-6 border-2 border-white/10 border-t-[var(--accent)] rounded-full" />
            <p className="text-sm text-tertiary">正在连接本地服务...</p>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--accent)]">{loadError}</p>
            {onRetry && (
              <button onClick={onRetry}
                className="text-xs px-4 py-2 rounded-lg bg-[var(--accent)] on-accent cursor-pointer hover:opacity-90 transition-opacity">
                重试
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const section = activeSection;

  if (isCollectionDetail) {
    return (
      <Suspense fallback={<Fallback />}>
        <ViewTransition id="collection-detail"><CollectionDetailView /></ViewTransition>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Fallback />}>
      {section === 'home' && <ViewTransition id="home"><HomeView search={search} onSearchChange={setSearch} lessons={lessons} clips={clips} uniqueWords={wordCount} /></ViewTransition>}
      {section === 'courses' && <ViewTransition id="courses"><CoursesView lessons={lessons} /></ViewTransition>}
      {section === 'clips' && <ViewTransition id="clips"><ClipsView clips={clips} onDeleteClip={onDeleteClip} /></ViewTransition>}
      {section === 'words' && <ViewTransition id="words"><WordsView /></ViewTransition>}
      {section === 'collections' && <ViewTransition id="collections"><CollectionsView /></ViewTransition>}
      {section === 'stats' && <ViewTransition id="stats"><StatsView /></ViewTransition>}
      {section === 'favorites' && <ViewTransition id="favorites"><FavoritesView /></ViewTransition>}
      {section === 'settings' && <ViewTransition id="settings"><SettingsView /></ViewTransition>}
    </Suspense>
  );
}
