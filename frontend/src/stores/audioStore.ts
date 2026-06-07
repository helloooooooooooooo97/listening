import { create } from 'zustand';
import type { AudioClip, ListeningLesson, LoopMode } from '../types/lesson';
import { useSettingsStore } from './settingsStore';
import { getAudio, switchSource, waitForReady, findSentenceIndex, preloadLessonAudio } from '../lib/audioEngine';
import { trackPlay, flushTrack, setLessonInfoProvider } from '../lib/playTracking';

export { getAudio, preloadLessonAudio };

/* ── Settings defaults ── */
function getSettingDefault(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem('app-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed[key] === 'number') return parsed[key];
    }
  } catch {}
  return fallback;
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

// Provide lesson info for play tracking
setLessonInfoProvider(() => {
  const m = useAudioStore.getState().mode;
  if (m.kind === 'lesson') return { id: m.lesson.id, title: m.lesson.title };
  return null;
});

export const useAudioStore = create<AudioState>((set, get) => {
  const audio = getAudio();

  audio.addEventListener('timeupdate', () => {
    const state = get();
    const { mode, loopMode, loopTarget, loopCount } = state;
    const t = audio.currentTime;

    // Loop enforcement
    if (mode.kind === 'clip') {
      const clip = mode.clip;
      if (t >= clip.endTime) {
        if (loopCount + 1 < loopTarget) {
          audio.currentTime = clip.startTime;
          set({ loopCount: loopCount + 1 });
        } else {
          audio.pause();
          audio.currentTime = clip.endTime;
          set({ isPlaying: false });
        }
        return;
      }
    } else if (mode.kind === 'lesson' && loopMode === 'sentence') {
      const idx = findSentenceIndex(mode.lesson, t);
      if (idx >= 0 && idx < mode.lesson.transcript.length) {
        const sent = mode.lesson.transcript[idx];
        if (t >= sent.end) audio.currentTime = sent.start;
      }
    }

    let sentenceIdx = -1;
    if (mode.kind === 'lesson') sentenceIdx = findSentenceIndex(mode.lesson, t);
    else if (mode.kind === 'clip' && mode.lesson) sentenceIdx = findSentenceIndex(mode.lesson, t);
    set({ currentTime: t, currentSentenceIndex: sentenceIdx });

    // Save position every 5 seconds
    if (mode.kind === 'lesson' && Math.floor(t) % 5 === 0 && t > 0.5) {
      useSettingsStore.getState().savePosition(mode.lesson.id, t);
    }
  });

  audio.addEventListener('loadedmetadata', () => set({ duration: audio.duration, isLoading: false }));
  audio.addEventListener('canplay', () => set({ isLoading: false }));
  audio.addEventListener('play', () => { set({ isPlaying: true }); trackPlay(); });
  audio.addEventListener('pause', () => { set({ isPlaying: false }); flushTrack(); });
  audio.addEventListener('ended', () => { set({ isPlaying: false }); flushTrack(); });

  let waitTimer: ReturnType<typeof setTimeout> | null = null;
  audio.addEventListener('waiting', () => {
    waitTimer = setTimeout(() => set({ isLoading: true }), 200);
  });
  audio.addEventListener('canplay', () => {
    if (waitTimer) { clearTimeout(waitTimer); waitTimer = null; }
    set({ isLoading: false });
  });

  return {
    mode: { kind: 'empty' },
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    isLoading: false,
    playbackRate: getSettingDefault('defaultSpeed', 1),
    loopMode: 'all',
    loopTarget: getSettingDefault('defaultLoopCount', 3),
    loopCount: 0,
    currentSentenceIndex: -1,

    playLesson: (lesson) => {
      const switched = switchSource(lesson.id, flushTrack);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'lesson', lesson }, loopCount: 0, playbackRate: getSettingDefault('defaultSpeed', 1) });
      waitForReady(getAudio(), () => {
        // Restore saved position if available
        const saved = useSettingsStore.getState().getPosition(lesson.id);
        if (saved && saved.position > 5) {
          getAudio().currentTime = saved.position;
        }
        getAudio().play();
      });
    },

    viewLesson: (lesson) => {
      const switched = switchSource(lesson.id, flushTrack);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'lesson', lesson }, loopCount: 0 });
    },

    playClip: (clip, contextLesson?) => {
      const switched = switchSource(clip.lessonId, flushTrack);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'clip', clip, lesson: contextLesson ?? null }, loopCount: 0, loopMode: 'clip', playbackRate: getSettingDefault('defaultSpeed', 1) });
      waitForReady(getAudio(), () => {
        getAudio().currentTime = clip.startTime;
        getAudio().play();
      });
    },

    viewClip: (clip, contextLesson?) => {
      const switched = switchSource(clip.lessonId, flushTrack);
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'clip', clip, lesson: contextLesson ?? null }, loopCount: 0, loopMode: 'clip' });
      waitForReady(getAudio(), () => { getAudio().currentTime = clip.startTime; });
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
      const state = get();
      // If in clip loop mode and seeking outside clip range, break out of loop
      if (state.mode.kind === 'clip') {
        const { clip } = state.mode;
        if (time < clip.startTime || time > clip.endTime) {
          // Switch to lesson mode if we have context lesson
          if (state.mode.lesson) {
            set({ mode: { kind: 'lesson', lesson: state.mode.lesson }, loopMode: 'all', loopCount: 0 });
          } else {
            set({ loopMode: 'all', loopCount: 0 });
          }
        }
      }
      getAudio().currentTime = Math.max(0, Math.min(time, getAudio().duration || 0));
    },

    seekRelative: (delta) => {
      const a = getAudio();
      a.currentTime = Math.max(0, Math.min(a.currentTime + delta, a.duration || 0));
    },

    jumpToPrevSentence: () => {
      const { mode } = get();
      if (mode.kind !== 'lesson') return;
      const curIdx = findSentenceIndex(mode.lesson, getAudio().currentTime);
      const targetIdx = Math.max(0, curIdx - 1);
      getAudio().currentTime = mode.lesson.transcript[targetIdx].start;
      if (!getAudio().paused) getAudio().play();
    },

    jumpToNextSentence: () => {
      const { mode } = get();
      if (mode.kind !== 'lesson') return;
      const curIdx = findSentenceIndex(mode.lesson, getAudio().currentTime);
      const targetIdx = Math.min(mode.lesson.transcript.length - 1, curIdx + 1);
      getAudio().currentTime = mode.lesson.transcript[targetIdx].start;
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
      flushTrack();
      set({ mode: { kind: 'empty' }, loopCount: 0, isLoading: false, loopMode: 'all' });
    },
  };
});
