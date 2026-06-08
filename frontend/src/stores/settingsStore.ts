import { create } from 'zustand';
import type { LyricDisplayMode } from '../types/lesson';

const KEY = 'playback-memory';
const SETTINGS_KEY = 'app-settings';

interface AppSettings {
  wordPlayOffset: number;   // seconds before/after word timestamp
  defaultSpeed: number;     // default playback rate (0.5 - 2.0)
  defaultLoopCount: number; // default clip/word/sentence loop count (1 - 10)
  dailyGoalMinutes: number; // daily learning goal in minutes (0 = off)
  lyricDisplayMode: LyricDisplayMode;
}

const DEFAULTS: AppSettings = {
  wordPlayOffset: 2,
  defaultSpeed: 1,
  defaultLoopCount: 3,
  dailyGoalMinutes: 0,
  lyricDisplayMode: 'bilingual',
};

function loadSettings(): AppSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch { return { ...DEFAULTS }; }
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
  setDefaultSpeed: (speed: number) => void;
  setDefaultLoopCount: (count: number) => void;
  setDailyGoalMinutes: (minutes: number) => void;
  setLyricDisplayMode: (mode: LyricDisplayMode) => void;
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

  setDefaultSpeed: (speed) => {
    set((s) => {
      const updated = { ...s.settings, defaultSpeed: speed };
      saveSettings(updated);
      return { settings: updated };
    });
  },

  setDefaultLoopCount: (count) => {
    set((s) => {
      const updated = { ...s.settings, defaultLoopCount: count };
      saveSettings(updated);
      return { settings: updated };
    });
  },

  setDailyGoalMinutes: (minutes) => {
    set((s) => {
      const updated = { ...s.settings, dailyGoalMinutes: minutes };
      saveSettings(updated);
      return { settings: updated };
    });
    if (minutes > 0 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },

  setLyricDisplayMode: (mode) => {
    set((s) => {
      const updated = { ...s.settings, lyricDisplayMode: mode };
      saveSettings(updated);
      return { settings: updated };
    });
  },
}));
