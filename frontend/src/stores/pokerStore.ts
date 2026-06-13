import { create } from 'zustand';
import type { PokerGameState, PlayableCard, PokerHistory } from '../lib/api';
import {
  getPokerStatus,
  getPlayableCards,
  createPokerGame,
  pokerAction,
  getPokerGameState,
  getPokerHistory,
} from '../lib/api';
import { preloadWordsAudio } from '../hooks/useWordAudio';

function parseError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/fetch|network|failed/i.test(msg)) return '网络错误，请检查连接后重试';
  if (/balance|余额|insufficient/i.test(msg)) return 'IP 余额不足';
  if (/not active|已结束/i.test(msg)) return '对局已结束，请返回大厅';
  return msg.length > 80 ? '操作失败，请重试' : msg;
}

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

  game: PokerGameState | null;
  gameId: number | null;
  selectedBet: number;
  betting: boolean;

  loadLobby: () => Promise<void>;
  startGame: () => Promise<void>;
  setSelectedBet: (amount: number) => void;
  doAction: (action: string, amount?: number) => Promise<void>;
  refreshGame: () => Promise<void>;
  backToLobby: () => void;
  clearError: () => void;
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

  startGame: async () => {
    set({ starting: true, betting: false, error: null, audioLoadProgress: 0 });
    try {
      const state = await createPokerGame();
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

  backToLobby: () => set({ lobbyMode: 'lobby', game: null, gameId: null, error: null }),
}));
