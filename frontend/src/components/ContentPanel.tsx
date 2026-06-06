import { useState, useEffect } from 'react';
import type { AudioClip, LessonSummary } from '../types/lesson';
import { useDictationStore } from '../stores/dictationStore';
import HomeView from '../views/HomeView';
import CoursesView from '../views/CoursesView';
import ClipsView from '../views/ClipsView';
import WordsView from '../views/WordsView';
import RecentView from '../views/RecentView';
import DictationView from '../views/DictationView';
import SettingsView from '../views/SettingsView';
import StatsView from '../views/StatsView';
import DictationHistoryView from '../views/DictationHistoryView';
import FavoritesView from '../views/FavoritesView';
import type { NavSection } from './Sidebar';

interface Props {
  activeSection: NavSection;
  lessons: LessonSummary[];
  clips: AudioClip[];
  wordCount: number;
  onDeleteClip: (id: string) => void;
}

export default function ContentPanel({ activeSection, lessons, clips, wordCount, onDeleteClip }: Props) {
  const [search, setSearch] = useState('');

  // Reset search on section change
  useEffect(() => { setSearch(''); }, [activeSection]);

  // Dictation mode overrides the normal view
  const dictationActive = useDictationStore(s => s.active);
  if (dictationActive) return <DictationView />;

  switch (activeSection) {
    case 'home':
      return <HomeView search={search} onSearchChange={setSearch} lessons={lessons} clips={clips} uniqueWords={wordCount} />;
    case 'courses':
      return <CoursesView lessons={lessons} />;
    case 'clips':
      return <ClipsView clips={clips} onDeleteClip={onDeleteClip} />;
    case 'words':
      return <WordsView />;
    case 'stats':
      return <StatsView />;
    case 'favorites':
      return <FavoritesView />;
    case 'dictation':
      return <DictationHistoryView />;
    case 'recent':
      return <RecentView lessons={lessons} />;
    case 'settings':
      return <SettingsView />;
  }
}
