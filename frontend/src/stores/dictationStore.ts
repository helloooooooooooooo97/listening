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
  phase: 'idle',

  start: () => set({ active: true, sentenceIndex: 0, results: [], scores: [], phase: 'typing', userInput: '' }),

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
    const expLower = expectedWords.map(w => w.toLowerCase());
    const actLower = actualWords.map(w => w.toLowerCase());

    // LCS — longest common subsequence
    const m = expLower.length, n = actLower.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = expLower[i - 1] === actLower[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Backtrack to find matched pairs
    const matchedExp = new Set<number>();
    const matchedAct = new Set<number>();
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (expLower[i - 1] === actLower[j - 1]) {
        matchedExp.add(i - 1);
        matchedAct.add(j - 1);
        i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    // Build results
    const results: WordResult[] = [];
    let correct = 0;
    for (let i = 0; i < m; i++) {
      if (matchedExp.has(i)) {
        results.push({ expected: expectedWords[i], actual: expectedWords[i], status: 'correct' });
        correct++;
      } else {
        // Find which actual word is closest or mark as missing
        results.push({ expected: expectedWords[i], actual: null, status: 'missing' });
      }
    }
    for (let j = 0; j < n; j++) {
      if (!matchedAct.has(j)) {
        results.push({ expected: '', actual: actualWords[j], status: 'extra' });
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
