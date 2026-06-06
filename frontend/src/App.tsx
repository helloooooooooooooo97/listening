import { useCallback, useEffect, useState } from 'react';
import type { LessonSummary } from './types/lesson';
import { useClipsStore } from './stores/clipsStore';
import { useAudioStore, preloadLessonAudio } from './stores/audioStore';
import Sidebar from './components/Sidebar';
import PlayerPanel from './components/PlayerPanel';
import PlayerBar from './components/PlayerBar';

type Tab = 'lessons' | 'clips';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('lessons');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const clips = useClipsStore((s) => s.clips);
  const removeClip = useClipsStore((s) => s.removeClip);

  // Selection IDs (for sidebar highlight) — separate from playback state
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Global audio actions
  const mode = useAudioStore((s) => s.mode);
  const playLesson = useAudioStore((s) => s.playLesson);
  const viewLesson = useAudioStore((s) => s.viewLesson);
  const playClip = useAudioStore((s) => s.playClip);
  const viewClip = useAudioStore((s) => s.viewClip);

  // Load lesson list + preload all audio files
  useEffect(() => {
    fetch('/api/lessons/')
      .then((r) => r.json())
      .then((data: LessonSummary[]) => {
        setLessons(data);
        preloadLessonAudio(data.map((l) => l.id));
      })
      .catch(() => {});
  }, []);

  // Sync selected IDs with audio store mode
  useEffect(() => {
    if (mode.kind === 'lesson') {
      setSelectedLessonId(mode.lesson.id);
      setSelectedClipId(null);
    } else if (mode.kind === 'clip') {
      setSelectedClipId(mode.clip.id);
      setSelectedLessonId(null);
    }
  }, [mode]);

  // Lesson actions
  const handleSelectLesson = useCallback(
    (id: string) => {
      fetch(`/api/lessons/${id}`)
        .then((r) => r.json())
        .then((lesson) => {
          viewLesson(lesson);
          setSelectedLessonId(id);
          setSelectedClipId(null);
        })
        .catch(() => {});
    },
    [viewLesson]
  );

  const handlePlayLesson = useCallback(
    (id: string) => {
      fetch(`/api/lessons/${id}`)
        .then((r) => r.json())
        .then((lesson) => {
          playLesson(lesson);
          setSelectedLessonId(id);
          setSelectedClipId(null);
        })
        .catch(() => {});
    },
    [playLesson]
  );

  // Clip actions
  const handleSelectClip = useCallback(
    (id: string) => {
      const clip = clips.find((c) => c.id === id);
      if (!clip) return;
      viewClip(clip);
      setSelectedClipId(id);
      setSelectedLessonId(null);
      // Load context in background
      fetch(`/api/lessons/${clip.lessonId}`)
        .then((r) => r.json())
        .then((lesson) => useAudioStore.getState().setContextLesson(lesson))
        .catch(() => {});
    },
    [clips, viewClip]
  );

  const handlePlayClip = useCallback(
    (id: string) => {
      const clip = clips.find((c) => c.id === id);
      if (!clip) return;
      playClip(clip);
      setSelectedClipId(id);
      setSelectedLessonId(null);
      // Load context in background
      fetch(`/api/lessons/${clip.lessonId}`)
        .then((r) => r.json())
        .then((lesson) => useAudioStore.getState().setContextLesson(lesson))
        .catch(() => {});
    },
    [clips, playClip]
  );

  const handleDeleteClip = useCallback(
    (id: string) => {
      // If currently viewing/playing this clip, clear it
      if (mode.kind === 'clip' && mode.clip.id === id) {
        useAudioStore.getState().clearMode();
      }
      removeClip(id);
      if (selectedClipId === id) {
        setSelectedClipId(null);
      }
    },
    [removeClip, selectedClipId, mode]
  );

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lessons={lessons}
        selectedLessonId={selectedLessonId}
        onSelectLesson={handleSelectLesson}
        onPlayLesson={handlePlayLesson}
        clips={clips}
        selectedClipId={selectedClipId}
        onSelectClip={handleSelectClip}
        onPlayClip={handlePlayClip}
        onDeleteClip={handleDeleteClip}
      />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 pb-16">
        <PlayerPanel />
      </main>
      <PlayerBar />
    </div>
  );
}
