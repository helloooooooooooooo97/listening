import type { WordResult } from '../stores/dictationStore';

/**
 * Align expected words with actual (user) words using LCS-based diff.
 * Produces inline-ordered results — correct, wrong, missing, extra interleaved
 * in the natural expected sentence order.
 */
export function alignDictation(expected: string[], actual: string[]): WordResult[] {
  const expLower = expected.map(w => w.toLowerCase());
  const actLower = actual.map(w => w.toLowerCase());
  const m = expLower.length, n = actLower.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = expLower[i - 1] === actLower[j - 1]
      ? dp[i - 1][j - 1] + 1
      : Math.max(dp[i - 1][j], dp[i][j - 1]);
  }

  // Build aligned results — walk both sequences, interleaving extra/missing
  const results: WordResult[] = [];
  let correct = 0;
  let ei = 0, ai = 0;

  while (ei < m || ai < n) {
    if (ei < m && ai < n && expLower[ei] === actLower[ai]) {
      results.push({ expected: expected[ei], actual: actual[ai], status: 'correct' });
      correct++;
      ei++; ai++;
    } else if (ei < m && ai < n && dp[ei + 1][ai] >= dp[ei][ai + 1]) {
      let foundAt = -1;
      for (let k = ai; k < n && k - ai <= 2; k++) {
        if (expLower[ei] === actLower[k]) { foundAt = k; break; }
      }
      if (foundAt >= 0) {
        while (ai < foundAt) { results.push({ expected: '', actual: actual[ai], status: 'extra' }); ai++; }
        results.push({ expected: expected[ei], actual: actual[ai], status: 'correct' });
        correct++;
        ei++; ai++;
      } else {
        results.push({ expected: expected[ei], actual: null, status: 'missing' });
        ei++;
      }
    } else if (ai < n && (ei >= m || dp[ei][ai + 1] >= dp[ei + 1][ai])) {
      results.push({ expected: '', actual: actual[ai], status: 'extra' });
      ai++;
    } else {
      if (ei < m) { results.push({ expected: expected[ei], actual: null, status: 'missing' }); ei++; }
      if (ai < n) { results.push({ expected: '', actual: actual[ai], status: 'extra' }); ai++; }
    }
  }

  return results;
}

/**
 * Compute score from alignment results.
 */
export function alignmentScore(expected: string[], actual: string[]): number {
  const expLower = expected.map(w => w.toLowerCase());
  const actLower = actual.map(w => w.toLowerCase());
  let correct = 0;
  let ei = 0, ai = 0;
  while (ei < expLower.length && ai < actLower.length) {
    if (expLower[ei] === actLower[ai]) { correct++; ei++; ai++; }
    else { ei++; }
  }
  return expected.length > 0 ? Math.round((correct / expected.length) * 100) : 0;
}
