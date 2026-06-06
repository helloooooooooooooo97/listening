import { create } from 'zustand';
import type { AudioClip } from '../types/lesson';

const STORAGE_KEY = 'audio-clips';

function load(): AudioClip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AudioClip[]) : [];
  } catch {
    return [];
  }
}

function persist(clips: AudioClip[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clips));
}

interface ClipsState {
  clips: AudioClip[];
  addClip: (clip: Omit<AudioClip, 'id' | 'createdAt'>) => AudioClip;
  removeClip: (id: string) => void;
  updateClip: (id: string, patch: Partial<Pick<AudioClip, 'note' | 'text'>>) => void;
  getClipsByLesson: (lessonId: string) => AudioClip[];
}

export const useClipsStore = create<ClipsState>((set, get) => ({
  clips: load(),

  addClip: (clip) => {
    const newClip: AudioClip = {
      ...clip,
      id: `clip-${clip.lessonId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    set((s) => {
      const updated = [newClip, ...s.clips];
      persist(updated);
      return { clips: updated };
    });
    return newClip;
  },

  removeClip: (id) => {
    set((s) => {
      const updated = s.clips.filter((c) => c.id !== id);
      persist(updated);
      return { clips: updated };
    });
  },

  updateClip: (id, patch) => {
    set((s) => {
      const updated = s.clips.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      );
      persist(updated);
      return { clips: updated };
    });
  },

  getClipsByLesson: (lessonId) => {
    return get().clips.filter((c) => c.lessonId === lessonId);
  },
}));
