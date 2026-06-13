import { create } from 'zustand';
import type { PokerGameState, PlayableCard, PokerHistory, PokerV2RoundResult } from '../lib/api';
import {
  getPokerStatus,
  getPlayableCards,
  createPokerGame,
  pokerAction,
  getPokerGameState,
  getPokerHistory,
  pokerV2Round,
} from '../lib/api';
import { preloadWordsAudio } from '../hooks/useWordAudio';

function parseError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/fetch|network|failed/i.test(msg)) return '网络错误，请检查连接后重试';
  if (/balance|余额|insufficient/i.test(msg)) return 'IP 余额不足';
  if (/not active|已结束/i.test(msg)) return '对局已结束，请返回大厅';
  return msg.length > 80 ? '操作失败，请重试' : msg;
}

/** All community words for the entire game — preload once at start (same as 听了个听). */
function pokerAudioWords(state: PokerGameState): string[] {
  if (state.audio_words?.length) return state.audio_words;
  return state.community_words.map(cw => cw.word).filter(Boolean) as string[];
}

export interface PokerStore {
  lobbyMode: 'lobby' | 'playing';
  cards: PlayableCard[];
  history: PokerHistory[];
  canPlay: boolean;
  balance: number;
  loading: boolean;
  starting: boolean;
  audioLoadProgress: number;
  error: string | null;

  // v1 (old)
  game: PokerGameState | null;
  gameId: number | null;
  selectedBet: number;
  betting: boolean;

  // v2 (new)
  v2Mode: boolean;
  v2RoundResult: PokerV2RoundResult | null;
  v2RoundNum: number;
  v2TotalRounds: number;
  v2TotalNet: number;
  v2SessionOver: boolean;

  loadLobby: () => Promise<void>;
  startGame: (cardId: string) => Promise<void>;
  setSelectedBet: (amount: number) => void;
  doAction: (action: string, amount?: number) => Promise<void>;
  refreshGame: () => Promise<void>;
  backToLobby: () => void;
  clearError: () => void;

  // v2 actions
  startV2Game: () => Promise<void>;
  playV2Round: () => Promise<void>;
}

export const usePokerStore = create<PokerStore>((set, get) => ({
  lobbyMode: 'lobby',
  cards: [],
  history: [],
  canPlay: false,
  balance: 0,
  loading: false,
  starting: false,
  audioLoadProgress: 0,
  error: null,
  game: null,
  gameId: null,
  selectedBet: 10,
  betting: false,

  // v2
  v2Mode: false,
  v2RoundResult: null,
  v2RoundNum: 0,
  v2TotalRounds: 10,
  v2TotalNet: 0,
  v2SessionOver: false,

  clearError: () => set({ error: null }),

  loadLobby: async () => {
    set({ loading: true, error: null });
    try {
      const [status, cardsData, historyData] = await Promise.all([
        getPokerStatus(),
        getPlayableCards(),
        getPokerHistory(10).catch(() => ({ games: [] })),
      ]);
      set({
        canPlay: status.can_play,
        balance: status.balance,
        cards: cardsData.cards,
        history: historyData.games,
      });
    } catch (e) {
      set({ error: parseError(e) });
    }
    set({ loading: false });
  },

  startGame: async (cardId: string) => {
    set({ starting: true, betting: false, error: null, audioLoadProgress: 0, v2Mode: false });
    try {
      const state = await createPokerGame(cardId);
      const words = pokerAudioWords(state);
      await preloadWordsAudio(words, ({ done, total, phase }) => {
        const base = phase === 'metadata' ? 0 : 55;
        const span = phase === 'metadata' ? 55 : 45;
        set({ audioLoadProgress: total > 0 ? Math.min(100, Math.round(base + (done / total) * span)) : base });
      });
      set({
        game: state,
        gameId: state.game_id,
        lobbyMode: 'playing',
        selectedBet: 10,
        audioLoadProgress: 100,
      });
    } catch (e) {
      set({ error: parseError(e) });
    }
    set({ starting: false });
  },

  setSelectedBet: (amount: number) => set({ selectedBet: amount }),

  doAction: async (action: string, amount?: number) => {
    const { gameId, game } = get();
    if (!gameId || !game) return;
    set({ betting: true, error: null });
    try {
      const state = await pokerAction(gameId, action, amount || 0);
      set({ game: state });
    } catch (e) {
      set({ error: parseError(e) });
    }
    set({ betting: false });
  },

  refreshGame: async () => {
    const { gameId } = get();
    if (!gameId) return;
    try {
      const state = await getPokerGameState(gameId);
      set({ game: state });
    } catch (e) {
      set({ error: parseError(e) });
    }
  },

  backToLobby: () => set({
    lobbyMode: 'lobby', game: null, gameId: null, error: null,
    v2Mode: false, v2RoundResult: null, v2RoundNum: 0, v2TotalNet: 0, v2SessionOver: false,
  }),

  // ── v2 ──

  startV2Game: async () => {
    set({ lobbyMode: 'playing', v2Mode: true, v2RoundResult: null, v2RoundNum: 0, v2TotalNet: 0, v2SessionOver: false, error: null });
    // 直接打第一回合
    const s = get();
    if (s.v2Mode) await s.playV2Round();
  },

  playV2Round: async () => {
    const { v2RoundNum, v2TotalRounds } = get();
    if (v2RoundNum >= v2TotalRounds) {
      set({ v2SessionOver: true });
      return;
    }
    set({ error: null });
    try {
      const result = await pokerV2Round();
      set({
        v2RoundResult: result,
        v2RoundNum: v2RoundNum + 1,
        v2TotalNet: get().v2TotalNet + result.net,
        balance: result.balance_after,
      });
    } catch (e) {
      set({ error: parseError(e) });
    }
  },
}));
