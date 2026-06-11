import { HiXMark, HiSparkles } from 'react-icons/hi2';
import type { CardMeta } from '../../lib/api';
import { cardImageUrl } from '../../lib/api';
import CardRarityBadge from './CardRarityBadge';

interface CardDetailModalProps {
  card: CardMeta;
  onClose: () => void;
}

const RARITY_GLOW: Record<string, { border: string; shadow: string; accent: string; gradient: string }> = {
  R: {
    border: 'rgba(59,130,246,0.3)',
    shadow: '0 0 30px rgba(59,130,246,0.15)',
    accent: '#3b82f6',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.08), transparent)',
  },
  SR: {
    border: 'rgba(168,85,247,0.35)',
    shadow: '0 0 30px rgba(168,85,247,0.2)',
    accent: '#a855f7',
    gradient: 'linear-gradient(135deg, rgba(168,85,247,0.08), transparent)',
  },
  SSR: {
    border: 'rgba(251,146,60,0.4)',
    shadow: '0 0 35px rgba(251,146,60,0.25)',
    accent: '#fb923c',
    gradient: 'linear-gradient(135deg, rgba(251,146,60,0.1), transparent)',
  },
  UR: {
    border: 'rgba(251,191,36,0.45)',
    shadow: '0 0 40px rgba(251,191,36,0.3)',
    accent: '#fbbf24',
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.1), transparent)',
  },
};

export default function CardDetailModal({ card, onClose }: CardDetailModalProps) {
  const glow = RARITY_GLOW[card.rarity] || RARITY_GLOW.R;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          borderColor: glow.border,
          borderWidth: 1,
          boxShadow: glow.shadow,
        }}>
        <div className="flex max-md:flex-col">
          {/* Card image */}
          <div className="w-48 max-md:w-full md:max-h-[500px] flex-shrink-0 relative">
            <img src={cardImageUrl(card.png)} alt={card.name}
              className="w-full h-full object-cover scale-105" />
            <div className="absolute top-2 right-2">
              <CardRarityBadge rarity={card.rarity} />
            </div>
          </div>

          {/* Card details */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[500px]"
            style={{ background: glow.gradient }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold" style={{ color: glow.accent }}>{card.name}</h2>
                <p className="text-xs text-tertiary mt-0.5">{card.title}</p>
                <div className="mt-1.5"><CardRarityBadge rarity={card.rarity} /></div>
              </div>
              <button onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                <HiXMark size={16} />
              </button>
            </div>

            {/* Keywords */}
            {card.keywords && card.keywords.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-tertiary font-medium uppercase tracking-wider mb-1.5">关键词</p>
                <div className="flex flex-wrap gap-1">
                  {card.keywords.map(kw => (
                    <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded text-tertiary"
                      style={{ background: `${glow.accent}15` }}>{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Vocab signature */}
            {card.vocab_signature && card.vocab_signature.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-tertiary font-medium uppercase tracking-wider mb-1.5">
                  词汇覆盖 <span className="text-[9px] opacity-60">({card.vocab_signature.length} 词)</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {card.vocab_signature.slice(0, 15).map(w => (
                    <span key={w} className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{w}</span>
                  ))}
                  {card.vocab_signature.length > 15 && (
                    <span className="text-[9px] px-1 py-0.5 text-tertiary">+{card.vocab_signature.length - 15}</span>
                  )}
                </div>
              </div>
            )}

            {/* Motto */}
            {card.motto && (
              <div className="mb-4 p-3 rounded-lg italic text-sm leading-relaxed"
                style={{ background: 'var(--bg-tertiary)' }}>
                <p className="text-secondary">"{card.motto}"</p>
              </div>
            )}

            {/* Obtained info */}
            {card.obtained && (
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: glow.accent }}>
                <HiSparkles size={12} /> 已收藏
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
