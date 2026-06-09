import { create } from 'zustand';
import type { AudioClip, ListeningLesson, LoopMode } from '../types/lesson';
import { useSettingsStore } from './settingsStore';
import { getAudio, switchSource, waitForReady, findSentenceIndex, preloadLessonAudio, setSavedRate, applyPlaybackRate, safePlay } from '../lib/audioEngine';
import { trackPlay, flushTrack, setLessonInfoProvider } from '../lib/playTracking';
import { usePlaylistStore, type QueueItem } from './playlistStore';
import { queueItemToClip } from '../lib/queueItems';

export { getAudio, preloadLessonAudio };

/* ── Guard: prevent double playNext() when clip-end fires multiple timeupdate events ── */
let _clipEndHandled = false;

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
  error: string | null;
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
  playQueueItem: (item: QueueItem) => void;
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
  const settings = useSettingsStore.getState().settings;
  const initialRate = settings.defaultSpeed || 1;
  applyPlaybackRate(audio, initialRate);
  audio.volume = settings.volume ?? 1;

  const playQueueItem = (item: QueueItem) => {
    if (item.kind === 'lesson') {
      get().playLesson(item.lesson);
    } else if (item.kind === 'clip') {
      get().playClip(item.clip, item.lesson ?? null);
    } else if (item.kind === 'sentence') {
      get().playClip(queueItemToClip(item));
    } else {
      const offset = useSettingsStore.getState().settings.wordPlayOffset || 2;
      get().playClip(queueItemToClip(item, offset));
    }
  };

  const playQueueItemLater = (item: QueueItem, delayMs: number) => {
    window.setTimeout(() => playQueueItem(item), delayMs);
  };

  audio.addEventListener('timeupdate', () => {
    const state = get();
    const { mode, loopMode, loopTarget, loopCount } = state;
    const t = audio.currentTime;

    // Loop enforcement — skip if _clipEndHandled to prevent double-trigger
    if (mode.kind === 'clip' && !_clipEndHandled) {
      const clip = mode.clip;
      if (t >= clip.endTime) {
        if (loopCount + 1 < loopTarget) {
          audio.currentTime = clip.startTime;
          set({ loopCount: loopCount + 1 });
        } else {
          _clipEndHandled = true;
          const next = usePlaylistStore.getState().playNext();
          if (next) {
            // Same-lesson clips: keep audio playing, just seek (avoids Safari autoplay block)
            if (next.kind === 'clip' && next.clip.lessonId === clip.lessonId) {
              playQueueItem(next);
            } else {
              // Different lesson / type: pause and schedule (needs full src switch)
              audio.pause();
              audio.currentTime = clip.endTime;
              set({ isPlaying: false });
              playQueueItemLater(next, 50);
            }
          } else {
            audio.pause();
            audio.currentTime = clip.endTime;
            set({ isPlaying: false });
          }
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
    // Only trigger re-render when values actually change
    const prev = get();
    if (sentenceIdx !== prev.currentSentenceIndex || Math.abs(prev.currentTime - t) > 0.05) {
      set({ currentTime: t, currentSentenceIndex: sentenceIdx });
    }

    // Save position every 5 seconds
    if (mode.kind === 'lesson' && Math.floor(t) % 5 === 0 && t > 0.5) {
      useSettingsStore.getState().savePosition(mode.lesson.id, t);
    }
  });

  const restorePlaybackRate = () => {
    applyPlaybackRate(audio, get().playbackRate);
  };

  audio.addEventListener('ratechange', () => {
    if (Math.abs(audio.playbackRate - get().playbackRate) > 0.001) {
      window.setTimeout(restorePlaybackRate, 0);
    }
  });
  audio.addEventListener('loadedmetadata', () => { restorePlaybackRate(); set({ duration: audio.duration, isLoading: false, error: null }); });
  audio.addEventListener('loadeddata', restorePlaybackRate);
  audio.addEventListener('canplay', () => { restorePlaybackRate(); set({ isLoading: false }); });
  audio.addEventListener('playing', restorePlaybackRate);
  audio.addEventListener('play', () => { restorePlaybackRate(); set({ isPlaying: true, error: null }); trackPlay(); });
  audio.addEventListener('pause', () => { set({ isPlaying: false }); flushTrack(); });
  audio.addEventListener('error', () => {
    const code = audio.error?.code ?? -1;
    const msg = code === 4 ? '音频文件不存在或无法访问' : `音频加载失败 (${code})`;
    set({ isLoading: false, isPlaying: false, error: msg });
  });
  audio.addEventListener('ended', () => {
    set({ isPlaying: false }); flushTrack();
    if (get().mode.kind === 'empty') return;

    if (_clipEndHandled) {
      _clipEndHandled = false;
      return;
    }

    const mode = usePlaylistStore.getState().repeatMode;
    // Repeat-one: replay current item
    if (mode === 'repeat-one') {
      const store = useAudioStore.getState();
      const m = store.mode;
      if (m.kind === 'lesson') window.setTimeout(() => store.playLesson(m.lesson), 100);
      else if (m.kind === 'clip') window.setTimeout(() => store.playClip(m.clip, m.lesson), 100);
      return;
    }
    // Auto-play next in queue
    const next = usePlaylistStore.getState().playNext();
    if (next) {
      playQueueItemLater(next, 100);
    }
  });

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
    error: null,
    playbackRate: initialRate,
    loopMode: 'all',
    loopTarget: useSettingsStore.getState().settings.defaultLoopCount || 3,
    loopCount: 0,
    currentSentenceIndex: -1,

    playLesson: (lesson) => {
      const switched = switchSource(lesson.id, flushTrack);
      const rate = get().playbackRate;
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'lesson', lesson }, loopCount: 0, playbackRate: rate });
      usePlaylistStore.getState().addToHistory({ kind: 'lesson', lesson });
      // Clear queue context when switching to a different lesson
      const q = usePlaylistStore.getState();
      if (q.queueContext && q.queueContext.lessonTitle !== lesson.title) {
        q.clearQueue();
      }
      waitForReady(getAudio(), () => {
        const a = getAudio();
        const saved = useSettingsStore.getState().getPosition(lesson.id);
        if (saved && saved.position > 5) {
          a.currentTime = saved.position;
        }
        applyPlaybackRate(a, rate);
        safePlay(a);
      });
    },

    viewLesson: (lesson) => {
      const switched = switchSource(lesson.id, flushTrack);
      const rate = get().playbackRate;
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'lesson', lesson }, loopCount: 0 });
      waitForReady(getAudio(), () => {
        applyPlaybackRate(getAudio(), rate);
      });
    },

    playClip: (clip, contextLesson?) => {
      const switched = switchSource(clip.lessonId, flushTrack);
      const rate = get().playbackRate;
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'clip', clip, lesson: contextLesson ?? null }, loopCount: 0, loopMode: 'clip', playbackRate: rate });
      // Reset guard flag: new clip starts fresh
      _clipEndHandled = false;
      waitForReady(getAudio(), () => {
        const a = getAudio();
        a.currentTime = clip.startTime;
        applyPlaybackRate(a, rate);
        safePlay(a);
      });
    },

    viewClip: (clip, contextLesson?) => {
      const switched = switchSource(clip.lessonId, flushTrack);
      const rate = get().playbackRate;
      if (switched) set({ isLoading: true });
      set({ mode: { kind: 'clip', clip, lesson: contextLesson ?? null }, loopCount: 0, loopMode: 'clip' });
      waitForReady(getAudio(), () => {
        const a = getAudio();
        applyPlaybackRate(a, rate);
        a.currentTime = clip.startTime;
      });
    },

    togglePlay: () => {
      const a = getAudio();
      if (a.paused) {
        const { mode, playbackRate } = get();
        if (mode.kind === 'clip' && a.currentTime >= mode.clip.endTime - 0.05) {
          a.currentTime = mode.clip.startTime;
          set({ loopCount: 0 });
        }
        applyPlaybackRate(a, playbackRate);
        safePlay(a);
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
      if (!getAudio().paused) safePlay(getAudio());
    },

    jumpToNextSentence: () => {
      const { mode } = get();
      if (mode.kind !== 'lesson') return;
      const curIdx = findSentenceIndex(mode.lesson, getAudio().currentTime);
      const targetIdx = Math.min(mode.lesson.transcript.length - 1, curIdx + 1);
      getAudio().currentTime = mode.lesson.transcript[targetIdx].start;
      if (!getAudio().paused) safePlay(getAudio());
    },

    setRate: (rate) => {
      const a = getAudio();
      set({ playbackRate: rate });
      setSavedRate(rate);
      applyPlaybackRate(a, rate);
      useSettingsStore.getState().setDefaultSpeed(rate);
    },

    playQueueItem,

    cycleLoopMode: () => {
      const current = get().loopMode;
      const nextIdx = (LOOP_ORDER.indexOf(current) + 1) % LOOP_ORDER.length;
      set({ loopMode: LOOP_ORDER[nextIdx], loopCount: 0 });
    },

    setLoopTarget: (n) => {
      set({ loopTarget: n, loopCount: 0 });
      useSettingsStore.getState().setDefaultLoopCount(n);
    },

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
