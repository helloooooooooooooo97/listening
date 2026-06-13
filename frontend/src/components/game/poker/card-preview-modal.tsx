// ─── Card Preview Modal — 与卡组界面CardDetailModal样式一致 ───

import { HiXMark, HiSparkles } from 'react-icons/hi2';
import { cardImageUrl } from '../../../lib/api';
import { rarity as rarityCfg } from '../../../constants/rarity';
import type { PokerV2Card } from '../../../lib/api';

interface CardPreviewModalProps {
  card: {
    name: string;
    rarity: string;
    png: string;
    keywords?: string[];
    title?: string;
    motto?: string;
  };
  matchedWords?: string[];
  onClose: () => void;
}

export default function CardPreviewModal({ card, matchedWords, onClose }: CardPreviewModalProps) {
  const glow = rarityCfg(card.rarity);

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
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: glow.bg, color: glow.color }}>
                {glow.label}
              </span>
            </div>
          </div>

          {/* Card details */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[500px]"
            style={{ background: glow.gradient }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold" style={{ color: glow.color }}>{card.name}</h2>
                {card.title && <p className="text-xs text-tertiary mt-0.5">{card.title}</p>}
                <div className="mt-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: glow.bg, color: glow.color }}>
                    {glow.label}
                  </span>
                </div>
              </div>
              <button onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                <HiXMark size={16} />
              </button>
            </div>

            {/* Matched words (game context) */}
            {matchedWords && matchedWords.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-tertiary font-medium uppercase tracking-wider mb-1.5">
                  命中的公共词 <span className="text-emerald-400">({matchedWords.length})</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {matchedWords.map(w => (
                    <span key={w} className="text-[10px] px-1.5 py-0.5 rounded text-emerald-400"
                      style={{ background: `${glow.color}15` }}>✓ {w}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {card.keywords && card.keywords.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-tertiary font-medium uppercase tracking-wider mb-1.5">关键词</p>
                <div className="flex flex-wrap gap-1">
                  {card.keywords.map(kw => (
                    <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded text-tertiary"
                      style={{ background: `${glow.color}15` }}>{kw}</span>
                  ))}
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

            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: glow.color }}>
              <HiSparkles size={12} /> 已收藏
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
