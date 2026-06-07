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
    const expLower = expectedWords.map(w => w.toLowerCase());
    const actLower = actualWords.map(w => w.toLowerCase());

    // LCS DP table
    const m = expLower.length, n = actLower.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = expLower[i - 1] === actLower[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Build aligned results: walk through expected in order, pairing with actual
    const results: WordResult[] = [];
    let correct = 0;
    let ei = 0, ai = 0;

    while (ei < m || ai < n) {
      if (ei < m && ai < n && expLower[ei] === actLower[ai]) {
        // Exact match
        results.push({ expected: expectedWords[ei], actual: actualWords[ai], status: 'correct' });
        correct++;
        ei++; ai++;
      } else if (ei < m && ai < n && dp[ei + 1][ai] >= dp[ei][ai + 1]) {
        // Skip expected word (missing) — but also check if we should pair with next actual
        // Try to align: is this expected word matched somewhere ahead?
        let foundAt = -1;
        for (let k = ai; k < n; k++) {
          if (expLower[ei] === actLower[k]) { foundAt = k; break; }
        }
        if (foundAt >= 0 && foundAt - ai <= 2) {
          // User has extra words before this match — mark them as extra
          while (ai < foundAt) {
            results.push({ expected: '', actual: actualWords[ai], status: 'extra' });
            ai++;
          }
          // Now match
          results.push({ expected: expectedWords[ei], actual: actualWords[ai], status: 'correct' });
          correct++;
          ei++; ai++;
        } else {
          // Truly missing
          results.push({ expected: expectedWords[ei], actual: null, status: 'missing' });
          ei++;
        }
      } else if (ai < n && (ei >= m || dp[ei][ai + 1] >= dp[ei + 1][ai])) {
        // Extra word from user
        results.push({ expected: '', actual: actualWords[ai], status: 'extra' });
        ai++;
      } else {
        // Fallback: missing
        if (ei < m) { results.push({ expected: expectedWords[ei], actual: null, status: 'missing' }); ei++; }
        if (ai < n) { results.push({ expected: '', actual: actualWords[ai], status: 'extra' }); ai++; }
      }
    }

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
