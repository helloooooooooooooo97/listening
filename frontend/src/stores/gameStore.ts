import { create } from 'zustand';
import type { TileData, Difficulty } from '../components/game/levelGenerator';
import { generateLevel } from '../components/game/levelGenerator';
import { submitBatchReview } from '../lib/api';

export interface GameStore {
  status: 'idle' | 'playing' | 'won' | 'lost';
  difficulty: Difficulty;
  words: string[];
  tiles: TileData[];
  /** Current in-degree for each tile ID (number of blockers still on board). 0 = clickable. */
  inDegree: Record<string, number>;
  slot: (TileData | null)[];
  matchedWords: string[];
  totalWords: number;
  slotCapacity: number;
  elapsed: number;
  tools: { shuffle: number; undo: number; remove3: number };

  initGame: (allWords: string[], difficulty: Difficulty) => void;
  clickTile: (tileId: string) => void;
  useShuffle: () => void;
  useUndo: () => void;
  useRemove3: () => void;
  reset: () => void;
}

const SLOT_CAPACITY = 7;

function buildInDegree(tiles: TileData[]): Record<string, number> {
  const deg: Record<string, number> = {};
  for (const t of tiles) {
    // in-degree = number of blockers still on the board (all blockers initially)
    deg[t.id] = t.blockedBy.length;
  }
  return deg;
}

function emptySlot() {
  return Array(SLOT_CAPACITY).fill(null) as (null)[];
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  difficulty: 'easy',
  words: [],
  tiles: [],
  inDegree: {},
  slot: emptySlot(),
  matchedWords: [],
  totalWords: 0,
  slotCapacity: SLOT_CAPACITY,
  elapsed: 0,
  tools: { shuffle: 1, undo: 2, remove3: 1 },

  initGame: (allWords, difficulty) => {
    const config = generateLevel(allWords, difficulty);
    if (!config) return;

    const inDegree = buildInDegree(config.tiles);

    set({
      status: 'playing',
      difficulty,
      words: config.words,
      tiles: config.tiles,
      inDegree,
      slot: emptySlot(),
      matchedWords: [],
      totalWords: config.totalWords,
      slotCapacity: SLOT_CAPACITY,
      elapsed: 0,
      tools: { shuffle: 1, undo: 2, remove3: 1 },
    });

    // Start timer
    const start = Date.now();
    const interval = setInterval(() => {
      const s = get();
      if (s.status !== 'playing') {
        clearInterval(interval);
        return;
      }
      set({ elapsed: Math.floor((Date.now() - start) / 1000) });
    }, 1000);
  },

  clickTile: (tileId) => {
    const state = get();
    if (state.status !== 'playing') return;

    // Must be clickable (in-degree = 0)
    if ((state.inDegree[tileId] ?? 1) !== 0) return;

    const tile = state.tiles.find(t => t.id === tileId);
    if (!tile) return;

    // Must have room in slot
    const slotCopy = [...state.slot];
    const emptyIdx = slotCopy.findIndex(s => s === null);
    if (emptyIdx < 0) return;

    // Remove tile from board
    const tilesCopy = state.tiles.filter(t => t.id !== tileId);
    const inDegreeCopy = { ...state.inDegree };
    delete inDegreeCopy[tileId];

    // Decrement in-degree of all tiles that this tile was blocking
    for (const blockedId of tile.blocks) {
      if (inDegreeCopy[blockedId] !== undefined) {
        inDegreeCopy[blockedId] = Math.max(0, inDegreeCopy[blockedId] - 1);
      }
    }

    slotCopy[emptyIdx] = { ...tile };

    // Sort slot: group identical words together, nulls at the end
    const filled = slotCopy.filter(s => s !== null) as TileData[];
    filled.sort((a, b) => a.word.localeCompare(b.word));
    for (let i = 0; i < SLOT_CAPACITY; i++) {
      slotCopy[i] = i < filled.length ? filled[i] : null;
    }

    // Check for triple match in slot
    const slotWords = slotCopy.filter(s => s !== null).map(s => s!.word);
    let matchedWord: string | null = null;
    for (const word of new Set(slotWords)) {
      if (slotWords.filter(w => w === word).length >= 3) {
        matchedWord = word;
        break;
      }
    }

    if (matchedWord) {
      // Remove 3 matching tiles from slot
      let removed = 0;
      for (let i = 0; i < slotCopy.length && removed < 3; i++) {
        if (slotCopy[i]?.word === matchedWord) {
          slotCopy[i] = null;
          removed++;
        }
      }

      const newMatched = [...state.matchedWords, matchedWord];
      const isWin = newMatched.length >= state.totalWords;

      set({
        tiles: tilesCopy,
        inDegree: inDegreeCopy,
        slot: slotCopy,
        matchedWords: newMatched,
        status: isWin ? 'won' : 'playing',
      });

      submitBatchReview(`sheep-${Date.now()}`, 'sheep_game', 'game', [
        { word: matchedWord, correct: true, score: 100, session_index: 0 },
      ]).catch(() => {});
    } else {
      set({ tiles: tilesCopy, inDegree: inDegreeCopy, slot: slotCopy });
    }

    // Check loss condition: all 7 slots full AND no match
    const filledCount = slotCopy.filter(s => s !== null).length;
    if (filledCount >= SLOT_CAPACITY && !matchedWord) {
      set({ status: 'lost' });
    }
  },

  useShuffle: () => {
    const state = get();
    if (state.tools.shuffle <= 0 || state.status !== 'playing') return;
    const words = state.tiles.map(t => t.word);
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
    const tilesCopy = state.tiles.map((t, i) => ({ ...t, word: words[i] }));
    // in-degree unchanged — same tile IDs, just shuffled words
    set({ tiles: tilesCopy, tools: { ...state.tools, shuffle: state.tools.shuffle - 1 } });
  },

  useUndo: () => {
    const state = get();
    if (state.tools.undo <= 0 || state.status !== 'playing') return;
    const slotCopy = [...state.slot];
    let lastIdx = -1;
    for (let i = slotCopy.length - 1; i >= 0; i--) {
      if (slotCopy[i] !== null) { lastIdx = i; break; }
    }
    if (lastIdx < 0) return;

    const tile = slotCopy[lastIdx]!;
    slotCopy[lastIdx] = null;

    // Restore tile to board — re-add to tiles, increment in-degree of blocked tiles
    const tilesCopy = [...state.tiles, { ...tile }];
    const inDegreeCopy = { ...state.inDegree, [tile.id]: 0 };
    for (const blockedId of tile.blocks) {
      if (inDegreeCopy[blockedId] !== undefined) {
        inDegreeCopy[blockedId] = (inDegreeCopy[blockedId] ?? 0) + 1;
      }
    }

    set({ tiles: tilesCopy, inDegree: inDegreeCopy, slot: slotCopy, tools: { ...state.tools, undo: state.tools.undo - 1 } });
  },

  useRemove3: () => {
    const state = get();
    if (state.tools.remove3 <= 0 || state.status !== 'playing') return;
    const slotCopy = [...state.slot];
    let removed = 0;
    for (let i = 0; i < slotCopy.length && removed < 3; i++) {
      if (slotCopy[i] !== null) {
        slotCopy[i] = null;
        removed++;
      }
    }
    set({ slot: slotCopy, tools: { ...state.tools, remove3: state.tools.remove3 - 1 } });
  },

  reset: () => {
    set({
      status: 'idle',
      tiles: [],
      inDegree: {},
      slot: emptySlot(),
      matchedWords: [],
      totalWords: 0,
      elapsed: 0,
      tools: { shuffle: 1, undo: 2, remove3: 1 },
    });
  },
}));
