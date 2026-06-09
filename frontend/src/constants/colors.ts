/** Predefined clip colors used across the app */
export const CLIP_COLORS = ['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7'];

export const COLOR_HEX = CLIP_COLORS;

/** Normalize a hex color: strip `ff` alpha suffix if present */
export function normalizeColor(color?: string): string {
  const value = color?.trim().toLowerCase() || '';
  return value.length === 9 && value.endsWith('ff') ? value.slice(0, 7) : value;
}
