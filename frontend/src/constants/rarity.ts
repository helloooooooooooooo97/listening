// ─── Unified Rarity Configuration ───
// Single source of truth for all rarity-related visual constants.
// Used by: PokerGameView (lobby, table, showdown), CardDetailModal, CardRarityBadge

export interface RarityConfig {
  label: string;
  color: string;     // Main text/indicator color
  glow: string;      // Glow semi-transparent color
  bg: string;        // Semi-transparent background
  border: string;    // Border color
  shadow: string;    // box-shadow (for modals)
  gradient: string;  // Gradient background (for CardDetailModal)
}

export const RARITY: Record<string, RarityConfig> = {
  R: {
    label: 'R',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.4)',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.3)',
    shadow: '0 0 30px rgba(59,130,246,0.15)',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.08), transparent)',
  },
  SR: {
    label: 'SR',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.45)',
    bg: 'rgba(168,85,247,0.12)',
    border: 'rgba(168,85,247,0.35)',
    shadow: '0 0 30px rgba(168,85,247,0.2)',
    gradient: 'linear-gradient(135deg, rgba(168,85,247,0.08), transparent)',
  },
  SSR: {
    label: 'SSR',
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.5)',
    bg: 'rgba(251,146,60,0.12)',
    border: 'rgba(251,146,60,0.4)',
    shadow: '0 0 35px rgba(251,146,60,0.25)',
    gradient: 'linear-gradient(135deg, rgba(251,146,60,0.1), transparent)',
  },
  UR: {
    label: 'UR',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.55)',
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.45)',
    shadow: '0 0 40px rgba(251,191,36,0.3)',
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.1), transparent)',
  },
};

/** Shorthand: get a rarity config, falling back to R if unknown. */
export function rarity(r: string): RarityConfig {
  return RARITY[r] || RARITY.R;
}
