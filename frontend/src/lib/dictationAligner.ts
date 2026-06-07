import type { WordResult } from '../stores/dictationStore';

/**
 * Align expected words with user's actual words using LCS backtracking.
 * Produces inline-ordered results with extra/missing interleaved naturally.
 */
export function alignDictation(expected: string[], actual: string[]): WordResult[] {
  const expLower = expected.map(w => w.toLowerCase());
  const actLower = actual.map(w => w.toLowerCase());
  const m = expLower.length, n = actLower.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = expLower[i - 1] === actLower[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to find all matched pairs
  const matchedE = new Set<number>();
  const matchedA = new Set<number>();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (expLower[i - 1] === actLower[j - 1]) {
      matchedE.add(i - 1);
      matchedA.add(j - 1);
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // Build inline results: walk both sequences in order
  const results: WordResult[] = [];
  let ei = 0, ai = 0;

  while (ei < m || ai < n) {
    if (ei < m && ai < n && matchedE.has(ei) && matchedA.has(ai) && expLower[ei] === actLower[ai]) {
      // Both matched to each other by LCS
      results.push({ expected: expected[ei], actual: actual[ai], status: 'correct' });
      ei++; ai++;
    } else if (ei < m && matchedE.has(ei)) {
      // Expected word is in LCS but actual pointer isn't at its match — extra words before it
      results.push({ expected: '', actual: actual[ai], status: 'extra' });
      ai++;
    } else if (ai < n && matchedA.has(ai)) {
      // Actual word is in LCS but expected pointer isn't at its match — missing words before it
      results.push({ expected: expected[ei], actual: null, status: 'missing' });
      ei++;
    } else if (ei < m && ai < n) {
      // Neither is in LCS — both are unmatched. Missing from expected, extra in actual.
      results.push({ expected: expected[ei], actual: null, status: 'missing' });
      results.push({ expected: '', actual: actual[ai], status: 'extra' });
      ei++; ai++;
    } else if (ei < m) {
      results.push({ expected: expected[ei], actual: null, status: 'missing' });
      ei++;
    } else if (ai < n) {
      results.push({ expected: '', actual: actual[ai], status: 'extra' });
      ai++;
    }
  }

  return results;
}
