import { create } from 'zustand';
import { alignDictation } from '../lib/dictationAligner';

export interface WordResult {
  expected: string;
  actual: string | null;
  status: 'correct' | 'wrong' | 'missing' | 'extra';
}

interface DictationState {
  active: boolean;
  sentenceIndex: number;
  userInput: string;
  results: WordResult[];
  scores: number[];
  scoreDetails: WordResult[][];  // per-sentence word results, persisted
  phase: 'idle' | 'typing' | 'feedback';

  start: () => void;
  startFrom: (idx: number) => void;
  nextSentence: () => void;
  prevSentence: () => void;
  goToSentence: (idx: number) => void;
  skip: () => void;
  setInput: (v: string) => void;
  submit: (expectedWords: string[]) => void;
  reset: () => void;
}

export const useDictationStore = create<DictationState>((set, get) => ({
  active: false,
  sentenceIndex: 0,
  userInput: '',
  results: [],
  scores: [],
  scoreDetails: [],
  phase: 'idle',

  start: () => set({ active: true, sentenceIndex: 0, results: [], scores: [], scoreDetails: [], phase: 'typing', userInput: '' }),
  startFrom: (idx: number) => set({ active: true, sentenceIndex: idx, results: [], scores: [], scoreDetails: [], phase: 'typing', userInput: '' }),

  nextSentence: () => set(s => ({ sentenceIndex: s.sentenceIndex + 1, phase: 'typing', userInput: '', results: [] })),

  prevSentence: () => set(s => {
    if (s.sentenceIndex <= 0) return {};
    // Remove last score when going back
    const newScores = s.scores.slice(0, -1);
    return { sentenceIndex: s.sentenceIndex - 1, phase: 'typing', userInput: '', results: [], scores: newScores };
  }),

  goToSentence: (idx: number) => set(s => {
    // Keep scores only up to the sentences before the target
    const newScores = s.scores.slice(0, idx);
    return { sentenceIndex: idx, phase: 'typing', userInput: '', results: [], scores: newScores };
  }),

  skip: () => set(s => ({
    scores: [...s.scores, 0],
    sentenceIndex: s.sentenceIndex + 1,
    phase: 'typing',
    userInput: '',
    results: [],
  })),

  setInput: (v) => set({ userInput: v }),

  submit: (expectedWords) => {
    const input = get().userInput.trim();
    const actualWords = input ? input.split(/\s+/) : [];
    const results = alignDictation(expectedWords, actualWords);
    const correct = results.filter(r => r.status === 'correct').length;
    const score = expectedWords.length > 0 ? Math.round((correct / expectedWords.length) * 100) : 0;
    set(s => {
      const details = [...s.scoreDetails];
      details[s.sentenceIndex] = results;
      return {
        results,
        scores: [...s.scores, score],
        scoreDetails: details,
        phase: 'feedback',
      };
    });
  },

  reset: () => set({ active: false, sentenceIndex: 0, userInput: '', results: [], scores: [], scoreDetails: [], phase: 'idle' }),
}));
