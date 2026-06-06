import { create } from 'zustand';
import type { AudioClip } from '../types/lesson';

function apiClipsToAudioClips(items: any[]): AudioClip[] {
  return items.map(c => ({
    id: String(c.id),
    lessonId: c.audio_id,
    lessonTitle: c.audio_title,
    startWordId: '',
    endWordId: '',
    startTime: c.start_time,
    endTime: c.end_time,
    text: c.text,
    note: c.note || '',
    createdAt: c.created_at || '',
  }));
}

async function fetchClips(): Promise<AudioClip[]> {
  try {
    const r = await fetch('/api/clips/');
    const data = await r.json();
    return apiClipsToAudioClips(data);
  } catch { return []; }
}

async function createClip(clip: Omit<AudioClip, 'id' | 'createdAt'>): Promise<AudioClip | null> {
  try {
    const r = await fetch('/api/clips/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_id: clip.lessonId,
        audio_title: clip.lessonTitle,
        start_time: clip.startTime,
        end_time: clip.endTime,
        text: clip.text,
        note: clip.note,
      }),
    });
    const data = await r.json();
    return apiClipsToAudioClips([data])[0];
  } catch { return null; }
}

async function deleteClipApi(id: string): Promise<boolean> {
  try {
    await fetch(`/api/clips/${id}`, { method: 'DELETE' });
    return true;
  } catch { return false; }
}

interface ClipsState {
  clips: AudioClip[];
  loaded: boolean;
  loadClips: () => Promise<void>;
  addClip: (clip: Omit<AudioClip, 'id' | 'createdAt'>) => Promise<AudioClip | null>;
  removeClip: (id: string) => Promise<void>;
  updateClip: (id: string, patch: Partial<Pick<AudioClip, 'note' | 'text'>>) => void;
  getClipsByLesson: (lessonId: string) => AudioClip[];
}

export const useClipsStore = create<ClipsState>((set, get) => ({
  clips: [],
  loaded: false,

  loadClips: async () => {
    const clips = await fetchClips();
    set({ clips, loaded: true });
  },

  addClip: async (clip) => {
    const newClip = await createClip(clip);
    if (newClip) {
      set(s => ({ clips: [newClip, ...s.clips] }));
    }
    return newClip;
  },

  removeClip: async (id) => {
    await deleteClipApi(id);
    set(s => ({ clips: s.clips.filter(c => c.id !== id) }));
  },

  updateClip: (id, patch) => {
    set(s => ({
      clips: s.clips.map(c => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },

  getClipsByLesson: (lessonId) => {
    return get().clips.filter(c => c.lessonId === lessonId);
  },
}));
