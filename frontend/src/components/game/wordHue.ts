/**
 * Deterministic hue from a word string — same word always gets the same color.
 */
export function wordHue(word: string): number {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = word.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ((hash % 360) + 360) % 360;
}

/** Shared tile color constants — must be same for board and slot. */
export const TILE_SAT = 55;
export const TILE_LIGHT = 48;
export const TILE_LIGHT_BLOCKED = 15;
