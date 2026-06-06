import { create } from 'zustand';

const KEY = 'playback-memory';
const SETTINGS_KEY = 'app-settings';

interface AppSettings {
  wordPlayOffset: number; // seconds before/after word timestamp
}

function loadSettings(): AppSettings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"wordPlayOffset":2}');
  } catch { return { wordPlayOffset: 2 }; }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

interface Memory {
  lessonId: string;
  position: number;
  timestamp: number;
}

function load(): Record<string, Memory> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function persist(data: Record<string, Memory>) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

interface SettingsState {
  memories: Record<string, Memory>;
  settings: AppSettings;
  savePosition: (lessonId: string, position: number) => void;
  getPosition: (lessonId: string) => Memory | null;
  clearPosition: (lessonId: string) => void;
  setWordPlayOffset: (offset: number) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: loadSettings(),
  memories: load(),

  savePosition: (lessonId, position) => {
    const mem: Memory = { lessonId, position, timestamp: Date.now() };
    set((s) => {
      const updated = { ...s.memories, [lessonId]: mem };
      persist(updated);
      return { memories: updated };
    });
  },

  getPosition: (lessonId) => get().memories[lessonId] || null,

  clearPosition: (lessonId) => {
    set((s) => {
      const updated = { ...s.memories };
      delete updated[lessonId];
      persist(updated);
      return { memories: updated };
    });
  },

  setWordPlayOffset: (offset) => {
    set((s) => {
      const updated = { ...s.settings, wordPlayOffset: offset };
      saveSettings(updated);
      return { settings: updated };
    });
  },
}));
