import type { CardMeta } from '../../lib/api';
import { cardImageUrl } from '../../lib/api';
import CardRarityBadge from './CardRarityBadge';
import { CLIP_COLORS } from '../../constants/colors';

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

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Keyword preview for unobtained cards — colored but no glow, each card unique */
function UnobtainedWordWall({ card }: { card: CardMeta }) {
  const words = (card.keywords.length > 0 ? card.keywords : card.vocab_signature).slice(0, 7);
  const accent = RARITY_COLORS[card.rarity] || RARITY_COLORS.R;
  const seed = hashId(card.id);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 overflow-hidden relative"
      style={{
        background: `linear-gradient(160deg, ${accent}08 0%, ${accent}18 100%)`,
      }}>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5 px-1.5">
        {words.map((kw, i) => {
          const big = (seed + i * 3) % 5 < 2;
          return (
            <span key={i}
              className={`font-black leading-none tracking-tight ${big ? 'text-[28px]' : 'text-[18px]'}`}
              style={{
                color: CLIP_COLORS[(seed + i * 5) % CLIP_COLORS.length],
                fontWeight: (seed + i) % 2 === 0 ? 900 : 800,
                transform: `rotate(${((seed + i * 7) % 15 - 7)}deg)`,
              }}>
              {kw}
            </span>
          );
        })}
      </div>
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <span className="text-[11px] font-black tracking-[0.15em]"
          style={{ color: accent + '99', letterSpacing: '0.15em' }}>
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
