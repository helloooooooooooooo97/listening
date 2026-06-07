import { create } from 'zustand';
import type { ListeningLesson, AudioClip } from '../types/lesson';

export type QueueItem =
  | { kind: 'lesson'; lesson: ListeningLesson }
  | { kind: 'clip'; clip: AudioClip; lesson?: ListeningLesson | null };

interface PlaylistState {
  queue: QueueItem[];
  currentIndex: number;
  history: QueueItem[];
  addToQueue: (item: QueueItem) => void;
  removeFromQueue: (index: number) => void;
  playNext: () => QueueItem | null;
  playPrev: () => QueueItem | null;
  clearQueue: () => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  addToHistory: (item: QueueItem) => void;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  history: [],

  addToQueue: (item) => {
    set(s => ({ queue: [...s.queue, item] }));
  },

  removeFromQueue: (index) => {
    set(s => ({ queue: s.queue.filter((_, i) => i !== index) }));
  },

  playNext: () => {
    const { queue, currentIndex } = get();
    const nextIdx = currentIndex + 1;
    if (nextIdx >= queue.length) return null;
    set({ currentIndex: nextIdx });
    return queue[nextIdx];
  },

  playPrev: () => {
    const { queue, currentIndex } = get();
    const prevIdx = currentIndex - 1;
    if (prevIdx < 0) return null;
    set({ currentIndex: prevIdx });
    return queue[prevIdx];
  },

  clearQueue: () => set({ queue: [], currentIndex: -1 }),

  reorder: (fromIndex, toIndex) => {
    set(s => {
      const newQueue = [...s.queue];
      const [item] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, item);
      return { queue: newQueue };
    });
  },

  addToHistory: (item) => {
    set(s => ({ history: [item, ...s.history].slice(0, 50) }));
  },
}));
