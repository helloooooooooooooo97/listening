import { create } from 'zustand';

type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'app-theme';

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  // Default to dark
  return 'dark';
}

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const initial = getInitialTheme();
  // Apply on load
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', initial);
  }
  return {
    mode: initial,
    toggle: () => set(s => {
      const next = s.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute('data-theme', next);
      return { mode: next };
    }),
    setMode: (mode) => {
      localStorage.setItem(STORAGE_KEY, mode);
      document.documentElement.setAttribute('data-theme', mode);
      set({ mode });
    },
  };
});
