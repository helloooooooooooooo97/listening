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

export interface PokerStore {
  // Lobby
  lobbyMode: 'lobby' | 'playing';
  cards: PlayableCard[];
  history: PokerHistory[];
  canPlay: boolean;
  balance: number;
  loading: boolean;

  // Game
  game: PokerGameState | null;
  gameId: number | null;
  selectedBet: number;
  betting: boolean;

  // Actions
  loadLobby: () => Promise<void>;
  startGame: (cardId: string) => Promise<void>;
  setSelectedBet: (amount: number) => void;
  doAction: (action: string, amount?: number) => Promise<void>;
  refreshGame: () => Promise<void>;
  backToLobby: () => void;
}

export const usePokerStore = create<PokerStore>((set, get) => ({
  lobbyMode: 'lobby',
  cards: [],
  history: [],
  canPlay: false,
  balance: 0,
  loading: false,
  game: null,
  gameId: null,
  selectedBet: 10,
  betting: false,

  loadLobby: async () => {
    set({ loading: true });
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
    } catch { /* ignore */ }
    set({ loading: false });
  },

  startGame: async (cardId: string) => {
    set({ loading: true, betting: false });
    try {
      const state = await createPokerGame(cardId);
      set({
        game: state,
        gameId: state.game_id,
        lobbyMode: 'playing',
        selectedBet: 10,
      });
    } catch { /* ignore */ }
    set({ loading: false });
  },

  setSelectedBet: (amount: number) => set({ selectedBet: amount }),

  doAction: async (action: string, amount?: number) => {
    const { gameId, game } = get();
    if (!gameId || !game) return;
    set({ betting: true });
    try {
      const state = await pokerAction(gameId, action, amount || 0);
      set({ game: state });
    } catch { /* ignore */ }
    set({ betting: false });
  },

  refreshGame: async () => {
    const { gameId } = get();
    if (!gameId) return;
    try {
      const state = await getPokerGameState(gameId);
      set({ game: state });
    } catch { /* ignore */ }
  },

  backToLobby: () => set({ lobbyMode: 'lobby', game: null, gameId: null }),
}));
