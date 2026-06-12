import { create } from 'zustand';
import type { AudioClip } from '../types/lesson';
import { getClips, createClip as apiCreateClip, deleteClip as apiDeleteClip, updateClip as apiUpdateClip } from '../lib/api';

interface ClipApiRow {
  id: number;
  audio_id: string;
  audio_title: string;
  start_time: number;
  end_time: number;
  text: string;
  note: string;
  color: string;
  created_at: number;
  ai_analysis?: string | null;
}

function toAudioClip(c: ClipApiRow): AudioClip {
  return {
    id: String(c.id),
    lessonId: c.audio_id,
    lessonTitle: c.audio_title,
    startWordId: '',
    endWordId: '',
    startTime: c.start_time,
    endTime: c.end_time,
    text: c.text,
    note: c.note || '',
    color: c.color || '#facc15',
    createdAt: c.created_at || '',
    ai_analysis: c.ai_analysis ?? null,
  };
}

function normalizeClip(c: AudioClip | ClipApiRow): AudioClip {
  if ('lessonId' in c) return c;
  return toAudioClip(c);
}

async function fetchClips(): Promise<AudioClip[]> {
  try {
    const data = await getClips();
    return data.map(c => normalizeClip(c as AudioClip | ClipApiRow));
  } catch { return []; }
}

async function createClipRemote(clip: Omit<AudioClip, 'id' | 'createdAt'>): Promise<AudioClip | null> {
  try {
    const data = await apiCreateClip({
      audio_id: clip.lessonId,
      audio_title: clip.lessonTitle,
      start_time: clip.startTime,
      end_time: clip.endTime,
      text: clip.text,
      note: clip.note,
      color: clip.color,
    });
    return toAudioClip(data as unknown as ClipApiRow);
  } catch { return null; }
}

async function deleteClipRemote(id: string): Promise<boolean> {
  try {
    await apiDeleteClip(id);
    return true;
  } catch { return false; }
}

interface ClipsState {
  clips: AudioClip[];
  loaded: boolean;
  loadClips: () => Promise<void>;
  addClip: (clip: Omit<AudioClip, 'id' | 'createdAt'>) => Promise<AudioClip | null>;
  removeClip: (id: string) => Promise<void>;
  updateClip: (id: string, patch: Partial<Pick<AudioClip, 'note' | 'text' | 'color'>>) => Promise<void>;
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
    const newClip = await createClipRemote(clip);
    if (newClip) {
      set(s => ({ clips: [newClip, ...s.clips] }));
    }
    return newClip;
  },

  removeClip: async (id) => {
    await deleteClipRemote(id);
    set(s => ({ clips: s.clips.filter(c => c.id !== id) }));
  },

  updateClip: async (id, patch) => {
    // Optimistic update
    set(s => ({
      clips: s.clips.map(c => (c.id === id ? { ...c, ...patch } : c)),
    }));
    try {
      await apiUpdateClip(id, patch);
    } catch {
      // Local change preserved silently
    }
  },

  getClipsByLesson: (lessonId) => {
    return get().clips.filter(c => c.lessonId === lessonId);
  },
}));
