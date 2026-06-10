/**
 * 羊了个羊 关卡生成器
 *
 * DAG 模型：tile 按层级堆叠，入度 = 被上层压住的 tile 数
 * 只有入度为 0 的 tile 可被点击。
 *
 * 难度参数由 DAG 深度（层数）× 宽度（每层覆盖率）× 密度（分支因子）控制。
 */

export interface TileData {
  id: string;
  word: string;
  emoji: string;
  layer: number;
  row: number;
  col: number;
  blockedBy: string[];   // IDs of tiles above (入度)
  blocks: string[];      // IDs of tiles below (出度)
}

export interface LevelConfig {
  words: string[];
  tiles: TileData[];
  totalWords: number;
}

import { EMOJIS } from './wordEmoji';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyParams {
  wordCount: number;        // N: how many unique words
  layers: number;           // DAG depth
  coveragePerLayer: number[]; // % of previous layer, per layer index
  branchFactor: number;     // max tiles one upper tile can block
}

const DIFFICULTY: Record<Difficulty, DifficultyParams> = {
  easy: {
    wordCount: 10,
    layers: 2,
    coveragePerLayer: [1.0, 0.55],
    branchFactor: 1,
  },
  medium: {
    wordCount: 15,
    layers: 3,
    coveragePerLayer: [1.0, 0.50, 0.30],
    branchFactor: 2,
  },
  hard: {
    wordCount: 20,
    layers: 4,
    coveragePerLayer: [1.0, 0.65, 0.40, 0.20],
    branchFactor: 3,
  },
};

/**
 * Try to generate a solvable level, retrying if unsolvable.
 */
export function generateLevel(words: string[], difficulty: Difficulty): LevelConfig | null {
  const params = DIFFICULTY[difficulty];
  // Fix: clamp wordCount to available words
  const count = Math.min(params.wordCount, words.length);
  if (count < 4) return null;

  // Pick N words, each repeated 3 times (3 matched tiles = one review)
  const selected = pickN(words, count);

  // Assign each unique word a UNIQUE emoji (no duplicates in this game)
  const shuffledEmojis = shuffleArray([...EMOJIS]);
  const emojiMap: Record<string, string> = {};
  for (let i = 0; i < selected.length; i++) {
    emojiMap[selected[i]] = shuffledEmojis[i % shuffledEmojis.length];
  }

  const tileWords: string[] = [];
  for (const w of selected) {
    tileWords.push(w, w, w);
  }

  // Try to generate a solvable layout
  for (let attempt = 0; attempt < 30; attempt++) {
    const tiles = buildLayout(tileWords, params, emojiMap);
    if (tiles && isSolvable(tiles)) {
      return { words: selected, tiles, totalWords: count };
    }
  }
  // Fallback: reduce difficulty (one less tile)
  return null;
}

/**
 * Build a multi-layer tile layout.
 *
 * Grid: 8 cols × 6 rows (fixed).
 * Layer 0: fills a region.
 * Higher layers: smaller offset regions centered above lower layers.
 *
 * Blocking: a tile at (l+1, r, c) blocks tiles at (l, r, c),
 * (l, r+1, c), (l, r, c+1), (l, r+1, c+1) — mimicking offset stacking.
 */
function buildLayout(words: string[], params: DifficultyParams, emojiMap: Record<string, string>): TileData[] | null {
  const GRID_COLS = 8;
  const GRID_ROWS = 6;
  const allTiles: TileData[] = [];
  let idCounter = 0;

  // Determine which cells each layer occupies
  const layers: { row: number; col: number }[][] = [];

  // Total tiles needed = words.length (each word exactly 3 times)
  const totalTiles = words.length;

  for (let l = 0; l < params.layers; l++) {
    const coverage = params.coveragePerLayer[l];
    const regionCols = Math.max(3, Math.round(GRID_COLS * coverage));
    const regionRows = Math.max(2, Math.round(GRID_ROWS * coverage));
    // Center the region
    const colOffset = Math.floor((GRID_COLS - regionCols) / 2);
    const rowOffset = Math.floor((GRID_ROWS - regionRows) / 2);

    const cells: { row: number; col: number }[] = [];
    for (let r = rowOffset; r < rowOffset + regionRows; r++) {
      for (let c = colOffset; c < colOffset + regionCols; c++) {
        cells.push({ row: r, col: c });
      }
    }
    layers.push(cells);
  }

  // Calculate how many tiles per layer (proportional to coverage)
  const totalCells = layers.reduce((sum, c) => sum + c.length, 0);
  let tilesRemaining = totalTiles;

  // Shuffle words once — each word appears 3 times in sequence
  const shuffledWords = shuffleArray([...words]);

  let wordIdx = 0;
  for (let l = 0; l < params.layers; l++) {
    const cells = layers[l];
    // Assign proportionally to this layer's share
    const layerShare = Math.round((cells.length / totalCells) * totalTiles);
    const tilesForLayer = Math.min(layerShare, tilesRemaining, cells.length);

    // Pick random cells from this layer
    const pickedCells = shuffleArray([...cells]).slice(0, tilesForLayer);

    for (const cell of pickedCells) {
      if (wordIdx >= shuffledWords.length) break;
      const w = shuffledWords[wordIdx];
      allTiles.push({
        id: `t${idCounter++}`,
        word: w,
        emoji: emojiMap[w] || '',
        layer: l,
        row: cell.row,
        col: cell.col,
        blockedBy: [],
        blocks: [],
      });
      wordIdx++;
    }
    tilesRemaining -= tilesForLayer;
  }

  // If some words weren't placed (layout too small), add remaining to top layer
  while (wordIdx < shuffledWords.length) {
    // Find first layer with space
    for (let l = params.layers - 1; l >= 0; l--) {
      const cells = layers[l];
      const used = allTiles.filter(t => t.layer === l).length;
      if (used < cells.length) {
        const available = cells.filter(c => !allTiles.some(t => t.layer === l && t.row === c.row && t.col === c.col));
        if (available.length > 0) {
          const cell = available[0];
          const w = shuffledWords[wordIdx];
          allTiles.push({
            id: `t${idCounter++}`,
            word: w,
            emoji: emojiMap[w] || '',
            layer: l,
            row: cell.row,
            col: cell.col,
            blockedBy: [],
            blocks: [],
          });
          wordIdx++;
          break;
        }
      }
    }
  }

  // Build DAG: higher-layer tiles block lower-layer tiles
  // A tile at (l+1, r, c) blocks tiles at (l, r, c), (l, r+1, c), (l, r, c+1), (l, r+1, c+1)
  const upperTiles = allTiles.filter(t => t.layer > 0);
  const lowerTiles = allTiles.filter(t => t.layer < params.layers - 1);

  for (const ut of upperTiles) {
    // A tile at (l+1, r, c) overlaps with lower tiles at (r,c), (r+1,c), (r,c+1), (r+1,c+1)
    // due to the half-tile offset. Block ALL of them.
    const covered = lowerTiles.filter(lt =>
      lt.layer === ut.layer - 1 &&
      lt.row >= ut.row && lt.row <= ut.row + 1 &&
      lt.col >= ut.col && lt.col <= ut.col + 1
    );
    for (const st of covered) {
      ut.blocks.push(st.id);
      st.blockedBy.push(ut.id);
    }
  }

  return allTiles;
}

/**
 * Greedy solvability checker.
 *
 * Simulates optimal play: prefer matching 3, then filling partial matches,
 * then picking tiles that unblock the most others.
 */
function isSolvable(tiles: TileData[]): boolean {
  const remaining = new Set(tiles.map(t => t.id));
  const tileMap = new Map(tiles.map(t => [t.id, t]));
  const slot: string[] = [];

  // Compute in-degrees
  const inDegree = new Map<string, number>();
  for (const t of tiles) {
    inDegree.set(t.id, t.blockedBy.filter(id => remaining.has(id)).length);
  }

  const clickable = () => [...remaining].filter(id => (inDegree.get(id) ?? 0) === 0);

  let iterations = 0;
  while (remaining.size > 0 && iterations < 1000) {
    iterations++;
    const clickableIds = clickable();
    if (clickableIds.length === 0) break; // stuck (shouldn't happen with proper DAG)

    const clickableWords = clickableIds.map(id => tileMap.get(id)!.word);

    // 1. Match 3 from clickable
    let matched = false;
    for (const word of new Set(clickableWords)) {
      const ids = clickableIds.filter(id => tileMap.get(id)!.word === word);
      if (ids.length >= 3) {
        removeTiles(ids.slice(0, 3), remaining, tileMap, inDegree);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 2. Check if clickable can complete a triple with slot
    for (const word of new Set([...clickableWords, ...slot])) {
      const inClickable = clickableIds.filter(id => tileMap.get(id)!.word === word);
      const inSlot = slot.filter(s => s === word);
      const total = inClickable.length + inSlot.length;
      if (total >= 3) {
        const needed = 3 - inSlot.length;
        if (inClickable.length >= needed) {
          // Add to slot, then match
          for (let i = 0; i < needed; i++) {
            slot.push(inClickable[i].word);
            removeTilesWithoutUpdate(inClickable[i], remaining, tileMap, inDegree);
          }
          // Remove 3 from slot
          for (let i = 0; i < 3; i++) {
            const idx = slot.indexOf(word);
            if (idx >= 0) slot.splice(idx, 1);
          }
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    // 3. Pick best tile: unblock most others, or match slot
    const scored = clickableIds.map(id => {
      const t = tileMap.get(id)!;
      const blocksCount = t.blocks.filter(b => remaining.has(b)).length;
      const slotMatch = slot.filter(s => s === t.word).length;
      return { id, score: blocksCount * 10 + slotMatch * 5 + Math.random() };
    });
    scored.sort((a, b) => b.score - a.score);

    const pick = scored[0].id;
    slot.push(tileMap.get(pick)!.word);
    removeTilesWithoutUpdate(pick, remaining, tileMap, inDegree);

    // Check if slot overflow
    if (slot.length >= 7) return false;

    // After adding to slot, check for matches
    for (const word of new Set(slot)) {
      const count = slot.filter(s => s === word).length;
      if (count >= 3) {
        for (let i = 0; i < 3; i++) {
          const idx = slot.indexOf(word);
          if (idx >= 0) slot.splice(idx, 1);
        }
        break;
      }
    }
  }

  return remaining.size === 0;
}

function removeTiles(ids: string[], remaining: Set<string>, tileMap: Map<string, TileData>, inDegree: Map<string, number>) {
  for (const id of ids) {
    removeTilesWithoutUpdate(id, remaining, tileMap, inDegree);
  }
}

function removeTilesWithoutUpdate(id: string, remaining: Set<string>, tileMap: Map<string, TileData>, inDegree: Map<string, number>) {
  if (!remaining.has(id)) return;
  remaining.delete(id);
  const t = tileMap.get(id)!;
  for (const blockedId of t.blocks) {
    if (remaining.has(blockedId)) {
      inDegree.set(blockedId, (inDegree.get(blockedId) ?? 1) - 1);
    }
  }
}

// ── Utils ──

function pickN(arr: string[], n: number): string[] {
  const shuffled = shuffleArray([...arr]);
  return shuffled.slice(0, n);
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
