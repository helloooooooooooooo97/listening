import { create } from 'zustand';
import type { AudioClip, ListeningLesson } from '../types/lesson';

/* ── Singleton audio element ── */
let _audio: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'auto';
  }
  return _audio;
}

/* ── Preload pool: hidden <audio> elements to warm browser cache ── */
const _preloadPool = new Map<string, HTMLAudioElement>();

export function preloadLessonAudio(lessonIds: string[]) {
  for (const id of lessonIds) {
    if (_preloadPool.has(id)) continue;
    const url = `/api/lessons/${id}/audio`;
    const el = new Audio();
    el.preload = 'auto';
    el.src = url;
    el.load();
    el.volume = 0;
    _preloadPool.set(id, el);
  }
}

/* ── State ── */
export type PlayerMode =
  | { kind: 'empty' }
  | { kind: 'lesson'; lesson: ListeningLesson }
  | { kind: 'clip'; clip: AudioClip; lesson: ListeningLesson | null };

interface AudioState {
  mode: PlayerMode;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
  playbackRate: number;
  loopTarget: number;
  loopCount: number;

  playLesson: (lesson: ListeningLesson) => void;
  viewLesson: (lesson: ListeningLesson) => void;
  playClip: (clip: AudioClip, contextLesson?: ListeningLesson | null) => void;
  viewClip: (clip: AudioClip, contextLesson?: ListeningLesson | null) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  setRate: (rate: number) => void;
  setLoopTarget: (n: number) => void;
  setContextLesson: (lesson: ListeningLesson) => void;
  clearMode: () => void;
}

/* ── Helper ── */
let _currentSrc = '';

function switchSource(lessonId: string): boolean {
  const url = `/api/lessons/${lessonId}/audio`;
  if (_currentSrc === url) return false; // same — no switch needed
  _currentSrc = url;
  getAudio().src = url;
  getAudio().load();
  return true; // switched — need to wait for canplay
}

function waitForReady(a: HTMLAudioElement, fn: () => void) {
  if (a.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    fn();
  } else {
    const onReady = () => {
      a.removeEventListener('canplay', onReady);
      fn();
    };
    a.addEventListener('canplay', onReady);
  }
}

/* ── Store ── */
export const useAudioStore = create<AudioState>((set, get) => {
  const audio = getAudio();

  audio.addEventListener('timeupdate', () => set({ currentTime: audio.currentTime }));
  audio.addEventListener('loadedmetadata', () => {
    set({ duration: audio.duration, isLoading: false });
  });
  audio.addEventListener('canplay', () => set({ isLoading: false }));
  audio.addEventListener('play', () => set({ isPlaying: true }));
  audio.addEventListener('pause', () => set({ isPlaying: false }));
  audio.addEventListener('ended', () => set({ isPlaying: false }));
  audio.addEventListener('waiting', () => set({ isLoading: true }));
  audio.addEventListener('seeking', () => set({ isLoading: true }));
  audio.addEventListener('seeked', () => set({ isLoading: false }));

  return {
    mode: { kind: 'empty' },
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
    playbackRate: 1,
    loopTarget: 3,
    loopCount: 0,

    playLesson: (lesson: ListeningLesson) => {
      const switched = switchSource(lesson.id);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'lesson', lesson }, loopCount: 0 });
      const a = getAudio();
      waitForReady(a, () => a.play());
    },

    viewLesson: (lesson: ListeningLesson) => {
      const switched = switchSource(lesson.id);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'lesson', lesson }, loopCount: 0 });
    },

    playClip: (clip: AudioClip, contextLesson?: ListeningLesson | null) => {
      const switched = switchSource(clip.lessonId);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'clip', clip, lesson: contextLesson ?? null }, loopCount: 0 });
      const a = getAudio();
      waitForReady(a, () => {
        a.currentTime = clip.startTime;
        a.play();
      });
    },

    viewClip: (clip: AudioClip, contextLesson?: ListeningLesson | null) => {
      const switched = switchSource(clip.lessonId);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'clip', clip, lesson: contextLesson ?? null }, loopCount: 0 });
      const a = getAudio();
      waitForReady(a, () => {
        a.currentTime = clip.startTime;
      });
    },

    togglePlay: () => {
      const a = getAudio();
      if (a.paused) {
        const { mode } = get();
        if (mode.kind === 'clip' && a.currentTime >= mode.clip.endTime - 0.05) {
          a.currentTime = mode.clip.startTime;
          set({ loopCount: 0 });
        }
        a.play();
      } else {
        a.pause();
      }
    },

    seek: (time: number) => {
      const a = getAudio();
      a.currentTime = Math.max(0, Math.min(time, a.duration || 0));
    },

    seekRelative: (delta: number) => {
      const a = getAudio();
      a.currentTime = Math.max(0, Math.min(a.currentTime + delta, a.duration || 0));
    },

    setRate: (rate: number) => {
      getAudio().playbackRate = rate;
      set({ playbackRate: rate });
    },

    setLoopTarget: (n: number) => {
      set({ loopTarget: n, loopCount: 0 });
    },

    setContextLesson: (lesson: ListeningLesson) => {
      const { mode } = get();
      if (mode.kind === 'clip') {
        set({ mode: { ...mode, lesson } });
      }
    },

    clearMode: () => {
      getAudio().pause();
      set({ mode: { kind: 'empty' }, loopCount: 0, isLoading: false });
    },
  };
});
