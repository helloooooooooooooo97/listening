import { create } from 'zustand';
import type { TileData, Difficulty } from '../components/game/levelGenerator';
import { generateLevel } from '../components/game/levelGenerator';
import { submitBatchReview } from '../lib/api';

// ── Dynamic difficulty helpers ──
const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];
const STREAK_KEY = 'sheep_game_streak';

interface StreakData {
  consecutiveWins: number;
  consecutiveLosses: number;
}

function loadStreak(): StreakData {
  try {
    return JSON.parse(localStorage.getItem(STREAK_KEY) || '{"consecutiveWins":0,"consecutiveLosses":0}');
  } catch { return { consecutiveWins: 0, consecutiveLosses: 0 }; }
}

function saveStreak(data: StreakData) {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(data)); } catch {}
}

function suggestDifficulty(prev: Difficulty, streak: StreakData): { difficulty: Difficulty; message: string | null } {
  const idx = DIFFICULTY_ORDER.indexOf(prev);
  if (streak.consecutiveLosses >= 2 && idx > 0) {
    const newDiff = DIFFICULTY_ORDER[idx - 1];
    return { difficulty: newDiff, message: `连续失败 ${streak.consecutiveLosses} 次，已自动调整至 ${newDiff === 'easy' ? '简单' : '中等'} 难度` };
  }
  if (streak.consecutiveWins >= 3 && idx < DIFFICULTY_ORDER.length - 1) {
    const newDiff = DIFFICULTY_ORDER[idx + 1];
    return { difficulty: newDiff, message: `连续过关 ${streak.consecutiveWins} 次，已自动调整至 ${newDiff === 'medium' ? '中等' : '困难'} 难度` };
  }
  return { difficulty: prev, message: null };
}

const HISTORY_KEY = 'sheep_game_history';

interface GameStatsRecord {
  session_id: string;
  difficulty: Difficulty;
  word_count: number;
  matched: number;
  elapsed: number;
  win: boolean;
  source: string;
  tools_used: { shuffle: number; undo: number; remove3: number };
  date: string;
}

function saveGameStats(store: GameStore) {
  const record: GameStatsRecord = {
    session_id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    difficulty: store.difficulty,
    word_count: store.totalWords,
    matched: store.matchedWords.length,
    elapsed: store.elapsed,
    win: store.status === 'won',
    source: store.gameSource,
    tools_used: { ...store.toolsUsed },
    date: new Date().toISOString(),
  };
  try {
    const existing: GameStatsRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    existing.push(record);
    // Keep last 200 records
    if (existing.length > 200) existing.splice(0, existing.length - 200);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
  } catch {}
}

function updateStreakOnEnd(status: 'won' | 'lost', currentDifficulty: Difficulty, setFn: (partial: Partial<GameStore>) => void) {
  const streak = loadStreak();
  const newStreak: StreakData = {
    consecutiveWins: status === 'won' ? streak.consecutiveWins + 1 : 0,
    consecutiveLosses: status === 'lost' ? streak.consecutiveLosses + 1 : 0,
  };
  saveStreak(newStreak);
  const suggested = suggestDifficulty(currentDifficulty, newStreak);
  const update: Partial<GameStore> = {
    consecutiveWins: newStreak.consecutiveWins,
    consecutiveLosses: newStreak.consecutiveLosses,
  };
  if (suggested.message) {
    update.difficulty = suggested.difficulty;
    update.difficultyMessage = suggested.message;
  }
  setFn(update);
  // Save game stats
  const currentState = useGameStore.getState();
  saveGameStats(currentState);
}

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
  /** Transient: whether the last elimination succeeded (for green flash). Cleared after 300ms. */
  lastMatchSuccess: boolean;
  /** Dynamic difficulty adaptation tracking */
  consecutiveWins: number;
  consecutiveLosses: number;
  /** Difficulty auto-adjusted message (shown as toast on next render) */
  difficultyMessage: string | null;
  /** Usage count per tool this session */
  toolsUsed: { shuffle: number; undo: number; remove3: number };
  /** Word source for this session (today / review / all) */
  gameSource: string;

  initGame: (allWords: string[], difficulty: Difficulty, source?: string) => boolean;
  clickTile: (tileId: string) => void;
  useShuffle: () => void;
  useUndo: () => void;
  useRemove3: () => void;
  reset: () => void;
  clearDifficultyMessage: () => void;
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
  lastMatchSuccess: false,
  consecutiveWins: loadStreak().consecutiveWins,
  consecutiveLosses: loadStreak().consecutiveLosses,
  difficultyMessage: null,
  toolsUsed: { shuffle: 0, undo: 0, remove3: 0 },
  gameSource: 'all',

  clearDifficultyMessage: () => set({ difficultyMessage: null }),

  initGame: (allWords, difficulty, source = 'all') => {
    const config = generateLevel(allWords, difficulty);
    if (!config) return false;

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
      lastMatchSuccess: false,
      toolsUsed: { shuffle: 0, undo: 0, remove3: 0 },
      gameSource: source,
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
    return true;
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
      // Remove 3 matching tiles from slot (synchronous atomic update)
      let removed = 0;
      const cleanSlot = [...slotCopy];
      for (let i = 0; i < cleanSlot.length && removed < 3; i++) {
        if (cleanSlot[i]?.word === matchedWord) {
          cleanSlot[i] = null;
          removed++;
        }
      }

      const newMatched = [...state.matchedWords, matchedWord];
      const isWin = newMatched.length >= state.totalWords;

      set({
        tiles: tilesCopy,
        inDegree: inDegreeCopy,
        slot: cleanSlot,
        matchedWords: newMatched,
        status: isWin ? 'won' : 'playing',
        lastMatchSuccess: true,
      });

      // Clear green flash after 300ms
      setTimeout(() => {
        set({ lastMatchSuccess: false });
      }, 300);

      if (isWin) updateStreakOnEnd('won', state.difficulty, set);

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
      updateStreakOnEnd('lost', state.difficulty, set);
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
    set({ tiles: tilesCopy, tools: { ...state.tools, shuffle: state.tools.shuffle - 1 }, toolsUsed: { ...state.toolsUsed, shuffle: state.toolsUsed.shuffle + 1 } });
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

    set({ tiles: tilesCopy, inDegree: inDegreeCopy, slot: slotCopy, tools: { ...state.tools, undo: state.tools.undo - 1 }, toolsUsed: { ...state.toolsUsed, undo: state.toolsUsed.undo + 1 } });
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
    set({ slot: slotCopy, tools: { ...state.tools, remove3: state.tools.remove3 - 1 }, toolsUsed: { ...state.toolsUsed, remove3: state.toolsUsed.remove3 + 1 } });
  },

  reset: () => {
    const streak = loadStreak();
    set({
      status: 'idle',
      tiles: [],
      inDegree: {},
      slot: emptySlot(),
      matchedWords: [],
      totalWords: 0,
      elapsed: 0,
      tools: { shuffle: 1, undo: 2, remove3: 1 },
      lastMatchSuccess: false,
      consecutiveWins: streak.consecutiveWins,
      consecutiveLosses: streak.consecutiveLosses,
      toolsUsed: { shuffle: 0, undo: 0, remove3: 0 },
      gameSource: 'all',
    });
  },
}));
