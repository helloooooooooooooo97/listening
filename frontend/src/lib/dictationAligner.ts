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
  candidates.sort((a, b) => b.s - a.s);
  const matchEtoA = new Map<number, number>(); // expected index → actual index
  const usedE = new Set<number>();
  const usedA = new Set<number>();

  for (const { i, j } of candidates) {
    if (!usedE.has(i) && !usedA.has(j)) {
      usedE.add(i);
      usedA.add(j);
      matchEtoA.set(i, j);
    }
  }

  // Build inline results in actual word order
  const results: WordResult[] = [];
  let ei = 0;

  for (let aj = 0; aj < n; aj++) {
    if (usedA.has(aj)) {
      // This actual word is matched — find which expected word maps to it
      const matchedEi = [...matchEtoA.entries()].find(([, j]) => j === aj)?.[0];
      if (matchedEi !== undefined) {
        // Emit missing expected words before this match
        while (ei < matchedEi) {
          results.push({ expected: expected[ei], actual: null, status: 'missing' });
          ei++;
        }
        const isExact = expClean[matchedEi] === actClean[aj];
        results.push({
          expected: expected[matchedEi],
          actual: actual[aj],
          status: isExact ? 'correct' : 'wrong',
        });
        ei = matchedEi + 1;
      }
    } else {
      // Unmatched actual word → extra
      results.push({ expected: '', actual: actual[aj], status: 'extra' });
    }
  }

  // Remaining unmatched expected words → missing
  while (ei < m) {
    results.push({ expected: expected[ei], actual: null, status: 'missing' });
    ei++;
  }

  return results;
}
