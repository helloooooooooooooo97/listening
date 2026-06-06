import { useCallback, useEffect, useState } from 'react';
import type { AudioClip } from '../types/lesson';

const STORAGE_KEY = 'audio-clips';

function loadClips(): AudioClip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AudioClip[]) : [];
  } catch {
    return [];
  }
}

function saveClips(clips: AudioClip[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clips));
}

export function useClips() {
  const [clips, setClips] = useState<AudioClip[]>(loadClips);

  // Persist on change
  useEffect(() => {
    saveClips(clips);
  }, [clips]);

  const addClip = useCallback(
    (clip: Omit<AudioClip, 'id' | 'createdAt'>) => {
      const newClip: AudioClip = {
        ...clip,
        id: `clip-${clip.lessonId}-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setClips((prev) => [newClip, ...prev]);
      return newClip;
    },
    []
  );

  const removeClip = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateClip = useCallback(
    (id: string, patch: Partial<Pick<AudioClip, 'note' | 'text'>>) => {
      setClips((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
    },
    []
  );

  const getClipsByLesson = useCallback(
    (lessonId: string) => clips.filter((c) => c.lessonId === lessonId),
    [clips]
  );

  return {
    clips,
    addClip,
    removeClip,
    updateClip,
    getClipsByLesson,
  };
}
