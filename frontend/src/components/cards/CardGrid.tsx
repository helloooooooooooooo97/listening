import type { CardMeta } from '../../lib/api';
import { cardImageUrl } from '../../lib/api';
import CardRarityBadge from './CardRarityBadge';

interface CardGridProps {
  cards: CardMeta[];
  onCardClick: (card: CardMeta) => void;
  /** 'standard' → ??? placeholder for unobtained (default)
   *  'deck' → show keyword word-wall for unobtained; clicking unobtained does nothing */
  variant?: 'standard' | 'deck';
}

const RARITY_BORDER: Record<string, string> = {
  R: 'rgba(59,130,246,0.25)',
  SR: 'rgba(168,85,247,0.3)',
  SSR: 'rgba(251,146,60,0.35)',
  UR: 'rgba(251,191,36,0.4)',
};

const RARITY_COLORS: Record<string, string> = {
  R: '#3b82f6',
  SR: '#a855f7',
  SSR: '#fb923c',
  UR: '#fbbf24',
};

function cardShadow(rarity: string, obtained: boolean): string {
  if (!obtained) return 'none';
  const c = RARITY_BORDER[rarity] || RARITY_BORDER.R;
  return '0 0 12px ' + c.replace('0.25', '0.08').replace('0.3', '0.1').replace('0.35', '0.12').replace('0.4', '0.15');
}

/** Vibrant colour palette for the keyword word-wall */
const PROMO_COLORS = [
  { text: '#facc15', glow: 'rgba(250,204,21,0.7)' },   // bright yellow
  { text: '#38bdf8', glow: 'rgba(56,189,248,0.6)' },   // electric blue
  { text: '#e879f9', glow: 'rgba(232,121,249,0.55)' }, // hot pink
  { text: '#4ade80', glow: 'rgba(74,222,128,0.55)' },  // neon green
  { text: '#fb923c', glow: 'rgba(251,146,60,0.6)' },   // vibrant orange
  { text: '#f472b6', glow: 'rgba(244,114,182,0.55)' }, // rose pink
  { text: '#2dd4bf', glow: 'rgba(45,212,191,0.55)' },  // bright teal
  { text: '#a78bfa', glow: 'rgba(167,139,250,0.55)' }, // soft purple
];

function randomRot(seed: number) {
  return ((seed * 7 + seed % 3) % 7 - 3) + 'deg';
}

/** Word-wall display for unobtained cards — large promotional keywords, no details on click */
function UnobtainedWordWall({ card }: { card: CardMeta }) {
  const words = card.keywords.length > 0 ? card.keywords : card.vocab_signature.slice(0, 10);
  const accent = RARITY_COLORS[card.rarity] || RARITY_COLORS.R;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 overflow-hidden relative"
      style={{
        background: `linear-gradient(160deg, ${accent}08 0%, ${accent}18 100%)`,
      }}>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5 px-1.5">
        {words.slice(0, 7).map((kw, i) => {
          const c = PROMO_COLORS[(card.id.charCodeAt(0) + i * 5) % PROMO_COLORS.length];
          const big = i % 3 === 0;
          return (
            <span key={i}
              className={`font-black leading-none tracking-tight ${big ? 'text-[28px]' : 'text-[18px]'}`}
              style={{
                color: c.text,
                textShadow: `0 0 ${big ? '20' : '10'}px ${c.glow}`,
                fontWeight: i % 2 === 0 ? 900 : 800,
                transform: `rotate(${randomRot(i + card.id.length)})`,
              }}>
              {kw}
            </span>
          );
        })}
      </div>
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <span className="text-[11px] font-black tracking-[0.15em]"
          style={{ color: accent + 'cc', letterSpacing: '0.15em' }}>
          {words.length > 7 ? `${words.length} 词待解锁` : '待解锁'}
        </span>
      </div>
    </div>
  );
}

function QuestionPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
      <svg className="w-10 h-10 text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
  );
}

export default function CardGrid({ cards, onCardClick, variant = 'standard' }: CardGridProps) {
  return (
    // Original column sizes — not enlarged
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      {cards.map(card => {
        const borderColor = card.obtained ? (RARITY_BORDER[card.rarity] || RARITY_BORDER.R) : 'var(--border-secondary)';
        const accent = RARITY_COLORS[card.rarity] || RARITY_COLORS.R;

        const handleClick = () => {
          // In 'deck' variant, only obtained cards are clickable (show detail)
          if (variant === 'deck' && !card.obtained) return;
          onCardClick(card);
        };

        return (
          <button key={card.id} onClick={handleClick}
            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 text-left
              ${card.obtained
                ? 'hover:shadow-lg hover:border-[var(--accent)]/30 cursor-pointer'
                : variant === 'deck'
                  ? 'opacity-80 cursor-default'
                  : 'opacity-70 hover:opacity-90 cursor-pointer'
              }`}
            style={{
              background: 'var(--bg-secondary)',
              borderColor,
              boxShadow: cardShadow(card.rarity, card.obtained),
            }}>
            <div className="aspect-[3/4] relative overflow-hidden">
              {/* Card image or unobtained placeholder */}
              {card.obtained ? (
                <img src={cardImageUrl(card.png)} alt={card.name}
                  className="w-full h-full object-cover scale-110 transition-transform duration-500 group-hover:scale-125" />
              ) : variant === 'deck' ? (
                <UnobtainedWordWall card={card} />
              ) : (
                <QuestionPlaceholder />
              )}

              {/* Rarity badge */}
              <div className="absolute top-2 right-2">
                {card.obtained ? (
                  <CardRarityBadge rarity={card.rarity} />
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium"
                    style={{
                      background: accent + '15',
                      color: accent + '99',
                      borderColor: accent + '25',
                    }}>
                    ???
                  </span>
                )}
              </div>

              {/* Name overlay at bottom */}
              {card.obtained && (
                <div className="absolute bottom-0 left-0 right-0 p-2"
                  style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                  <p className="text-xs font-semibold text-white truncate">{card.name}</p>
                  {card.title && (
                    <p className="text-[9px] text-white/70 truncate">{card.title}</p>
                  )}
                </div>
              )}
              {!card.obtained && variant === 'standard' && (
                <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
                  <p className="text-xs font-semibold text-tertiary">???</p>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
