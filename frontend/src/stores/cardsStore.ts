import { create } from 'zustand';
import type { CardMeta, DrawWord } from '../lib/api';
import { getCardList, getDrawStatus, performDraw, pickDrawWord } from '../lib/api';

export interface DrawnCard {
  id: string;
  name: string;
  title: string;
  motto: string;
  rarity: string;
  png: string;
  keywords: string[];
  match_score: number;
}

export interface CardsStore {
  cards: CardMeta[];
  total: number;
  obtainedCount: number;
  deckTitle: string;
  deckSubtitle: string;
  deckSeason: number;
  loading: boolean;

  /** Draw state */
  canDraw: boolean;
  newWordsSinceDraw: number;
  minNewWords: number;
  qualifiedCandidates: number;
  drawLoading: boolean;
  drawId: string | null;
  drawWords: DrawWord[];
  drawnCard: DrawnCard | null;
  showWords: boolean;
  showResult: boolean;

  loadCards: () => Promise<void>;
  checkDraw: () => Promise<void>;
  startDraw: () => Promise<void>;
  pickWord: (word: string) => Promise<void>;
  clearDraw: () => void;
}

export const useCardsStore = create<CardsStore>((set, get) => ({
  cards: [],
  total: 0,
  obtainedCount: 0,
  deckTitle: '',
  deckSubtitle: '',
  deckSeason: 1,
  loading: false,
  canDraw: false,
  newWordsSinceDraw: 0,
  minNewWords: 15,
  qualifiedCandidates: 0,
  drawLoading: false,
  drawId: null,
  drawWords: [],
  drawnCard: null,
  showWords: false,
  showResult: false,

  loadCards: async () => {
    set({ loading: true });
    try {
      const data = await getCardList();
      set({
        cards: data.cards,
        total: data.total,
        obtainedCount: data.obtained,
        deckTitle: data.deck.title,
        deckSubtitle: data.deck.subtitle || '',
        deckSeason: data.deck.season || 1,
      });
    } catch { /* ignore */ }
    set({ loading: false });
  },

  checkDraw: async () => {
    try {
      const data = await getDrawStatus();
      set({
        canDraw: data.can_draw,
        newWordsSinceDraw: data.new_words_since_last_draw,
        minNewWords: data.min_new_words,
        qualifiedCandidates: data.qualified_candidates,
      });
    } catch { /* ignore */ }
  },

  startDraw: async () => {
    set({ drawLoading: true });
    try {
      const data = await performDraw();
      set({ drawId: data.draw_id, drawWords: data.words, showWords: true, newWordsSinceDraw: data.new_words_since_last_draw });
    } catch {
      set({ canDraw: false });
    }
    set({ drawLoading: false });
  },

  pickWord: async (word: string) => {
    const { drawId } = get();
    if (!drawId) return;
    set({ drawLoading: true });
    try {
      const data = await pickDrawWord(drawId, word);
      set({ drawnCard: data.card, showWords: false, showResult: true, canDraw: false });
      await get().loadCards();
      await get().checkDraw();
    } catch {
      // Draw failed (session expired, etc.) → reset to initial state
      set({ drawId: null, drawWords: [], showWords: false, showResult: false, canDraw: false });
    }
    set({ drawLoading: false });
  },

  clearDraw: () => {
    set({ drawId: null, drawWords: [], drawnCard: null, showWords: false, showResult: false });
  },
}));
