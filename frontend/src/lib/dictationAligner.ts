import type { WordResult } from '../stores/dictationStore';

/** Character-level LCS length between two strings */
function charLcs(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Align expected words with user's actual words using character-level LCS similarity.
 * Greedy matching by highest char-LCS score, then inline output in actual word order.
 */
export function alignDictation(expected: string[], actual: string[]): WordResult[] {
  const expClean = expected.map(w => w.toLowerCase().replace(/[^a-z]/g, ''));
  const actClean = actual.map(w => w.toLowerCase().replace(/[^a-z]/g, ''));
  const m = expClean.length, n = actClean.length;

  // Build candidate pairs: all (i,j) with char-LCS > 50% of longer word
  const candidates: { i: number; j: number; s: number }[] = [];
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const s = charLcs(expClean[i], actClean[j]);
      const maxLen = Math.max(expClean[i].length, actClean[j].length);
      if (s > maxLen * 0.5) {
        candidates.push({ i, j, s });
      }
    }
  }

  // Greedy assignment: highest score first, each word at most once
  // Then resolve crossing pairs to maintain monotonic order
  candidates.sort((a, b) => b.s - a.s);
  let matchEtoA = new Map<number, number>();
  const usedE = new Set<number>();
  const usedA = new Set<number>();

  for (const { i, j } of candidates) {
    if (!usedE.has(i) && !usedA.has(j)) {
      usedE.add(i);
      usedA.add(j);
      matchEtoA.set(i, j);
    }
  }

  // Resolve crossings and re-match: keep monotonic matching (E order = A order)
  const sortedByA = [...matchEtoA.entries()].sort(([, a], [, b]) => a - b);
  matchEtoA = new Map();
  let prevA = -1;
  for (const [ei, aj] of sortedByA) {
    if (aj > prevA) {
      matchEtoA.set(ei, aj);
      prevA = aj;
    }
    // else: crossing, this pair is dropped — the E word becomes available for re-match
  }

  // Re-match unmatched E words to remaining free A words
  const usedCleanA = new Set(matchEtoA.values());
  const usedCleanE = new Set(matchEtoA.keys());
  const remaining = candidates.filter(c => !usedCleanE.has(c.i) && !usedCleanA.has(c.j));
  remaining.sort((a, b) => b.s - a.s);
  for (const { i, j } of remaining) {
    if (!usedCleanE.has(i) && !usedCleanA.has(j)) {
      matchEtoA.set(i, j);
      usedCleanE.add(i);
      usedCleanA.add(j);
    }
  }

  // Build inline results: walk through expected words in order.
  // For each expected word, if matched, emit unmatched actual words before the match as extras.
  // If not matched, emit as missing.
  const results: WordResult[] = [];
  const matchedA = new Set(matchEtoA.values());
  let aj = 0;

  for (let ei = 0; ei < m; ei++) {
    const matchedAj = matchEtoA.get(ei);
    if (matchedAj !== undefined) {
      while (aj < matchedAj) {
        if (!matchedA.has(aj)) {
          results.push({ expected: '', actual: actual[aj], status: 'extra' });
        }
        aj++;
      }
      const isExact = expClean[ei] === actClean[matchedAj];
      results.push({
        expected: expected[ei],
        actual: actual[matchedAj],
        status: isExact ? 'correct' : 'wrong',
      });
      if (matchedAj >= aj) aj = matchedAj + 1;
    } else {
      results.push({ expected: expected[ei], actual: null, status: 'missing' });
    }
  }

  // Remaining unmatched actual words
  while (aj < n) {
    if (!matchedA.has(aj)) {
      results.push({ expected: '', actual: actual[aj], status: 'extra' });
    }
    aj++;
  }

  return results;
}
