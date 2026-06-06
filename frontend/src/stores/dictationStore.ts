import { create } from 'zustand';

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
  phase: 'idle' | 'typing' | 'feedback';

  start: () => void;
  nextSentence: () => void;
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
  phase: 'idle',

  start: () => set({ active: true, sentenceIndex: 0, results: [], scores: [], phase: 'typing', userInput: '' }),

  nextSentence: () => set(s => ({ sentenceIndex: s.sentenceIndex + 1, phase: 'typing', userInput: '', results: [] })),

  setInput: (v) => set({ userInput: v }),

  submit: (expectedWords) => {
    const input = get().userInput.trim();
    const actualWords = input ? input.split(/\s+/) : [];
    const results: WordResult[] = [];
    let correct = 0;

    // Compare expected vs actual
    const maxLen = Math.max(expectedWords.length, actualWords.length);
    for (let i = 0; i < maxLen; i++) {
      const exp = expectedWords[i];
      const act = actualWords[i];
      if (exp && act && exp.toLowerCase() === act.toLowerCase()) {
        results.push({ expected: exp, actual: act, status: 'correct' });
        correct++;
      } else if (exp && !act) {
        results.push({ expected: exp, actual: null, status: 'missing' });
      } else if (!exp && act) {
        results.push({ expected: '', actual: act, status: 'extra' });
      } else {
        results.push({ expected: exp, actual: act, status: 'wrong' });
      }
    }

    const score = expectedWords.length > 0 ? Math.round((correct / expectedWords.length) * 100) : 0;
    set(s => ({
      results,
      scores: [...s.scores, score],
      phase: 'feedback',
    }));
  },

  reset: () => set({ active: false, sentenceIndex: 0, userInput: '', results: [], scores: [], phase: 'idle' }),
}));
