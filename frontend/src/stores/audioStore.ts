import { create } from 'zustand';
import type { AudioClip, ListeningLesson, LoopMode } from '../types/lesson';
import { useSettingsStore } from './settingsStore';

/* ── Singleton audio element ── */
let _audio: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'auto';
  }
  return _audio;
}

/* ── Preload pool ── */
const _preloadPool = new Map<string, HTMLAudioElement>();
export function preloadLessonAudio(lessonIds: string[]) {
  for (const id of lessonIds) {
    if (_preloadPool.has(id)) continue;
    const el = new Audio();
    el.preload = 'auto';
    el.src = `/api/lessons/${id}/audio`;
    el.load();
    el.volume = 0;
    _preloadPool.set(id, el);
  }
}

/* ── Helpers ── */
let _currentSrc = '';
function switchSource(lessonId: string): boolean {
  const url = `/api/lessons/${lessonId}/audio`;
  if (_currentSrc === url) return false;
  _currentSrc = url;
  getAudio().src = url;
  getAudio().load();
  return true;
}

function waitForReady(a: HTMLAudioElement, fn: () => void) {
  if (a.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) fn();
  else {
    const onReady = () => { a.removeEventListener('canplay', onReady); fn(); };
    a.addEventListener('canplay', onReady);
  }
}

function findSentenceIndex(lesson: ListeningLesson | null, time: number): number {
  if (!lesson) return -1;
  for (let i = lesson.transcript.length - 1; i >= 0; i--) {
    if (time >= lesson.transcript[i].start - 0.05) return i;
  }
  return 0;
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
  loopMode: LoopMode;
  loopTarget: number;
  loopCount: number;
  currentSentenceIndex: number;

  playLesson: (lesson: ListeningLesson) => void;
  viewLesson: (lesson: ListeningLesson) => void;
  playClip: (clip: AudioClip, contextLesson?: ListeningLesson | null) => void;
  viewClip: (clip: AudioClip, contextLesson?: ListeningLesson | null) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  jumpToPrevSentence: () => void;
  jumpToNextSentence: () => void;
  setRate: (rate: number) => void;
  cycleLoopMode: () => void;
  setLoopTarget: (n: number) => void;
  setContextLesson: (lesson: ListeningLesson) => void;
  clearMode: () => void;
}

const LOOP_ORDER: LoopMode[] = ['all', 'sentence', 'clip'];

export const useAudioStore = create<AudioState>((set, get) => {
  const audio = getAudio();

  audio.addEventListener('timeupdate', () => {
    const state = get();
    const { mode, loopMode, loopTarget, loopCount } = state;
    const t = audio.currentTime;

    // ── Loop enforcement ──
    if (mode.kind === 'clip') {
      const clip = mode.clip;
      if (t >= clip.endTime) {
        if (loopCount + 1 < loopTarget) {
          // Loop: seek back to clip start
          audio.currentTime = clip.startTime;
          set({ loopCount: loopCount + 1 });
        } else {
          // Done: pause at end
          audio.pause();
          audio.currentTime = clip.endTime;
          set({ isPlaying: false });
        }
        return;
      }
    } else if (mode.kind === 'lesson' && loopMode === 'sentence') {
      const sentences = mode.lesson.transcript;
      const idx = findSentenceIndex(mode.lesson, t);
      if (idx >= 0 && idx < sentences.length) {
        const sent = sentences[idx];
        if (t >= sent.end) {
          audio.currentTime = sent.start;
        }
      }
    }

    // Track sentence index
    let sentenceIdx = -1;
    if (mode.kind === 'lesson') {
      sentenceIdx = findSentenceIndex(mode.lesson, t);
    } else if (mode.kind === 'clip' && mode.lesson) {
      sentenceIdx = findSentenceIndex(mode.lesson, t);
    }
    set({ currentTime: t, currentSentenceIndex: sentenceIdx });

    // Save playback position every 5 seconds (throttled)
    if (mode.kind === 'lesson' && Math.floor(t) % 5 === 0 && t > 0.5) {
      useSettingsStore.getState().savePosition(mode.lesson.id, t);
    }
  });

  audio.addEventListener('loadedmetadata', () => set({ duration: audio.duration, isLoading: false }));
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
    loopMode: 'all',
    loopTarget: 3,
    loopCount: 0,
    currentSentenceIndex: -1,

    playLesson: (lesson) => {
      const switched = switchSource(lesson.id);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'lesson', lesson }, loopCount: 0 });
      waitForReady(getAudio(), () => getAudio().play());
    },

    viewLesson: (lesson) => {
      const switched = switchSource(lesson.id);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'lesson', lesson }, loopCount: 0 });
    },

    playClip: (clip, contextLesson?) => {
      const switched = switchSource(clip.lessonId);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'clip', clip, lesson: contextLesson ?? null }, loopCount: 0, loopMode: 'clip' });
      waitForReady(getAudio(), () => {
        getAudio().currentTime = clip.startTime;
        getAudio().play();
      });
    },

    viewClip: (clip, contextLesson?) => {
      const switched = switchSource(clip.lessonId);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'clip', clip, lesson: contextLesson ?? null }, loopCount: 0, loopMode: 'clip' });
      waitForReady(getAudio(), () => {
        getAudio().currentTime = clip.startTime;
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

    seek: (time) => {
      getAudio().currentTime = Math.max(0, Math.min(time, getAudio().duration || 0));
    },

    seekRelative: (delta) => {
      const a = getAudio();
      a.currentTime = Math.max(0, Math.min(a.currentTime + delta, a.duration || 0));
    },

    jumpToPrevSentence: () => {
      const { mode } = get();
      if (mode.kind !== 'lesson') return;
      const sentences = mode.lesson.transcript;
      const curIdx = findSentenceIndex(mode.lesson, getAudio().currentTime);
      const targetIdx = Math.max(0, curIdx - 1);
      const targetTime = sentences[targetIdx].start;
      getAudio().currentTime = targetTime;
      // If currently playing, keep playing
      if (!getAudio().paused) getAudio().play();
    },

    jumpToNextSentence: () => {
      const { mode } = get();
      if (mode.kind !== 'lesson') return;
      const sentences = mode.lesson.transcript;
      const curIdx = findSentenceIndex(mode.lesson, getAudio().currentTime);
      const targetIdx = Math.min(sentences.length - 1, curIdx + 1);
      const targetTime = sentences[targetIdx].start;
      getAudio().currentTime = targetTime;
      if (!getAudio().paused) getAudio().play();
    },

    setRate: (rate) => {
      getAudio().playbackRate = rate;
      set({ playbackRate: rate });
    },

    cycleLoopMode: () => {
      const current = get().loopMode;
      const nextIdx = (LOOP_ORDER.indexOf(current) + 1) % LOOP_ORDER.length;
      set({ loopMode: LOOP_ORDER[nextIdx], loopCount: 0 });
    },

    setLoopTarget: (n) => set({ loopTarget: n, loopCount: 0 }),

    setContextLesson: (lesson) => {
      const { mode } = get();
      if (mode.kind === 'clip') set({ mode: { ...mode, lesson } });
    },

    clearMode: () => {
      getAudio().pause();
      set({ mode: { kind: 'empty' }, loopCount: 0, isLoading: false, loopMode: 'all' });
    },
  };
});
