import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LyricDisplayMode } from '../types/lesson';

const KEY = 'playback-memory';

interface AppSettings {
  wordPlayOffset: number;   // seconds before/after word timestamp
  defaultSpeed: number;     // default playback rate (0.5 - 2.0)
  defaultLoopCount: number; // default clip/word/sentence loop count (1 - 10)
  dailyGoalMinutes: number; // daily learning goal in minutes (0 = off)
  lyricDisplayMode: LyricDisplayMode;
  translationEnabled: boolean;
}

const DEFAULTS: AppSettings = {
  wordPlayOffset: 2,
  defaultSpeed: 1,
  defaultLoopCount: 3,
  dailyGoalMinutes: 0,
  lyricDisplayMode: 'bilingual',
  translationEnabled: true,
};

interface Memory {
  lessonId: string;
  position: number;
  timestamp: number;
}

function loadMemories(): Record<string, Memory> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

function saveMemories(data: Record<string, Memory>) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

interface SettingsState {
  settings: AppSettings;
  memories: Record<string, Memory>;
  savePosition: (lessonId: string, position: number) => void;
  getPosition: (lessonId: string) => Memory | null;
  clearPosition: (lessonId: string) => void;
  setWordPlayOffset: (offset: number) => void;
  setDefaultSpeed: (speed: number) => void;
  setDefaultLoopCount: (count: number) => void;
  setDailyGoalMinutes: (minutes: number) => void;
  setLyricDisplayMode: (mode: LyricDisplayMode) => void;
  setTranslationEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULTS,
      memories: loadMemories(),

      savePosition: (lessonId, position) => {
        const mem: Memory = { lessonId, position, timestamp: Date.now() };
        set((s) => {
          const updated = { ...s.memories, [lessonId]: mem };
          saveMemories(updated);
          return { memories: updated };
        });
      },

      getPosition: (lessonId) => get().memories[lessonId] || null,

      clearPosition: (lessonId) => {
        set((s) => {
          const updated = { ...s.memories };
          delete updated[lessonId];
          saveMemories(updated);
          return { memories: updated };
        });
      },

      setWordPlayOffset: (offset) => {
        set((s) => ({ settings: { ...s.settings, wordPlayOffset: offset } }));
      },

      setDefaultSpeed: (speed) => {
        set((s) => ({ settings: { ...s.settings, defaultSpeed: speed } }));
      },

      setDefaultLoopCount: (count) => {
        set((s) => ({ settings: { ...s.settings, defaultLoopCount: count } }));
      },

      setDailyGoalMinutes: (minutes) => {
        set((s) => ({ settings: { ...s.settings, dailyGoalMinutes: minutes } }));
        if (minutes > 0 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      },

      setLyricDisplayMode: (mode) => {
        set((s) => ({ settings: { ...s.settings, lyricDisplayMode: mode } }));
      },

      setTranslationEnabled: (enabled) => {
        set((s) => ({ settings: { ...s.settings, translationEnabled: enabled } }));
      },
    }),
    {
      name: 'app-settings',
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted, current) => ({
        ...current,
        settings: { ...DEFAULTS, ...(persisted as { settings?: Partial<AppSettings> })?.settings },
      }),
    }
  )
);
