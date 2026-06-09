import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ListeningLesson, AudioClip } from '../types/lesson';

export type QueueItem =
  | { kind: 'lesson'; lesson: ListeningLesson }
  | { kind: 'clip'; clip: AudioClip; lesson?: ListeningLesson | null }
  | { kind: 'sentence'; lessonId: string; lessonTitle: string; sentenceIndex: number; start: number; end: number; text: string }
  | { kind: 'word'; lessonId: string; lessonTitle: string; word: string; start: number; end: number };

export function queueItemLabel(item: QueueItem): string {
  switch (item.kind) {
    case 'lesson': return item.lesson.title;
    case 'clip': return item.clip.text;
    case 'sentence': return `句子 ${item.sentenceIndex + 1}: ${item.text.slice(0, 30)}`;
    case 'word': return item.word;
  }
}

export function queueItemSub(item: QueueItem): string {
  switch (item.kind) {
    case 'lesson': return item.lesson.subtitle;
    case 'clip': return item.clip.lessonTitle;
    case 'sentence': return item.lessonTitle;
    case 'word': return item.lessonTitle;
  }
}

type RepeatMode = 'sequential' | 'repeat-one' | 'repeat-all' | 'shuffle';

interface PlaylistState {
  queue: QueueItem[];
  currentIndex: number;
  history: QueueItem[];
  repeatMode: RepeatMode;
  addToQueue: (item: QueueItem) => void;
  addAllToQueue: (items: QueueItem[]) => void;
  /** Replace queue with all clips from this lesson, start at given clip index */
  playClipsFrom: (clips: AudioClip[], lesson: ListeningLesson | null, startIndex: number) => void;
  /** Play this item now: clear everything after current, append item, jump to it */
  playNow: (item: QueueItem) => void;
  removeFromQueue: (index: number) => void;
  playNext: () => QueueItem | null;
  playPrev: () => QueueItem | null;
  clearQueue: () => void;
  /** Queue source context (e.g. "来自 xx 音频的 N 个片段") */
  queueContext: { lessonTitle: string; count: number } | null;
  setCurrentIndex: (index: number) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  addToHistory: (item: QueueItem) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
  queue: [],
  currentIndex: -1,
  history: [],
  repeatMode: 'repeat-all',
  queueContext: null,

  addToQueue: (item) => {
    set(s => ({ queue: [...s.queue, item] }));
  },

  addAllToQueue: (items) => {
    set(s => {
      const existing = new Set(s.queue.map(i => {
        if (i.kind === 'lesson') return `lesson:${i.lesson.id}`;
        if (i.kind === 'clip') return `clip:${i.clip.id}`;
        if (i.kind === 'sentence') return `sent:${i.lessonId}:${i.sentenceIndex}`;
        return `word:${i.lessonId}:${i.word}`;
      }));
      const fresh = items.filter(i => {
        const key = i.kind === 'lesson' ? `lesson:${i.lesson.id}`
          : i.kind === 'clip' ? `clip:${i.clip.id}`
          : i.kind === 'sentence' ? `sent:${i.lessonId}:${i.sentenceIndex}`
          : `word:${i.lessonId}:${i.word}`;
        return !existing.has(key);
      });
      return { queue: [...s.queue, ...fresh] };
    });
  },

  /** Replace queue with all clips from this lesson, start at given clip index */
  playClipsFrom: (clips: AudioClip[], lesson: ListeningLesson | null, startIndex: number) => {
    if (clips.length === 0) return;
    const items: QueueItem[] = clips.map(c => ({ kind: 'clip' as const, clip: c, lesson }));
    const lessonTitle = lesson?.title || (clips[0]?.lessonTitle || '');
    set({ queue: items, currentIndex: startIndex, queueContext: { lessonTitle, count: clips.length } });
  },

  playNow: (item) => {
    set(s => {
      // If queue is empty, add item and play from 0
      if (s.queue.length === 0) return { queue: [item], currentIndex: 0 };
      // If nothing playing (currentIndex < 0), add to start
      if (s.currentIndex < 0) return { queue: [item, ...s.queue], currentIndex: 0 };
      // Truncate after current, append item, jump to it
      const newQueue = [...s.queue.slice(0, s.currentIndex + 1), item];
      return { queue: newQueue, currentIndex: newQueue.length - 1 };
    });
  },

  removeFromQueue: (index) => {
    set(s => {
      const newQueue = s.queue.filter((_, i) => i !== index);
      let newIdx = s.currentIndex;
      if (index < s.currentIndex) newIdx--;
      else if (index === s.currentIndex) newIdx = Math.min(newIdx, newQueue.length - 1);
      return { queue: newQueue, currentIndex: newIdx };
    });
  },

  playNext: () => {
    const { queue, currentIndex, repeatMode } = get();
    if (queue.length === 0) return null;

    if (repeatMode === 'shuffle') {
      // Pick random item, move it after current
      const remaining = queue.map((_, i) => i).filter(i => i > currentIndex);
      if (remaining.length > 0) {
        const r = remaining[Math.floor(Math.random() * remaining.length)];
        set({ currentIndex: r });
        return queue[r];
      }
      // Shuffle again
      const r = Math.floor(Math.random() * queue.length);
      set({ currentIndex: r });
      return queue[r];
    }

    const nextIdx = currentIndex + 1;
    if (nextIdx < queue.length) {
      set({ currentIndex: nextIdx });
      return queue[nextIdx];
    }
    // End of queue
    if (repeatMode === 'repeat-all') {
      set({ currentIndex: 0 });
      return queue[0];
    }
    return null;
  },

  playPrev: () => {
    const { queue, currentIndex, repeatMode } = get();
    const prevIdx = currentIndex - 1;
    if (prevIdx >= 0) {
      set({ currentIndex: prevIdx });
      return queue[prevIdx];
    }
    if (repeatMode === 'repeat-all' && queue.length > 0) {
      set({ currentIndex: queue.length - 1 });
      return queue[queue.length - 1];
    }
    return null;
  },

  setCurrentIndex: (index: number) => set({ currentIndex: index }),
  clearQueue: () => set({ queue: [], currentIndex: -1 }),

  reorder: (fromIndex, toIndex) => {
    set(s => {
      const newQueue = [...s.queue];
      const [item] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, item);
      let newIdx = s.currentIndex;
      if (fromIndex === s.currentIndex) newIdx = toIndex;
      else if (fromIndex < s.currentIndex && toIndex >= s.currentIndex) newIdx--;
      else if (fromIndex > s.currentIndex && toIndex <= s.currentIndex) newIdx++;
      return { queue: newQueue, currentIndex: newIdx };
    });
  },

  addToHistory: (item) => {
    set(s => ({ history: [item, ...s.history].slice(0, 50) }));
  },

  setRepeatMode: (mode) => set({ repeatMode: mode }),

  cycleRepeatMode: () => {
    const order: RepeatMode[] = ['sequential', 'repeat-all', 'shuffle', 'repeat-one'];
    const current = get().repeatMode;
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    set({ repeatMode: order[nextIdx] });
  },
}),
    { name: 'playlist-queue' },
  )
);
