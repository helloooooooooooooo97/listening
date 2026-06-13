// ─── Card Preview Modal — magnified card with keyword match info ───

import { cardImageUrl } from '../../../lib/api';
import { rarity as rc } from '../../../constants/rarity';
import type { PokerGameState } from '../../../lib/api';

interface CardPreviewModalProps {
  name: string;
  rarity: string;
  png: string;
  keywords: string[];
  communityWords: PokerGameState['community_words'];
  onClose: () => void;
}

export default function CardPreviewModal({
  name, rarity, png, keywords, communityWords, onClose,
}: CardPreviewModalProps) {
  const cfg = rc(rarity);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-56 animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Card image */}
        <div className="rounded-2xl overflow-hidden border-2"
          style={{
            borderColor: cfg.border,
            boxShadow: `0 0 40px ${cfg.glow}50, 0 8px 32px rgba(0,0,0,0.5)`,
          }}>
          <img src={cardImageUrl(png)} alt={name}
            className="w-full object-cover" />
        </div>

        {/* Name + rarity */}
        <div className="text-center mt-3">
          <p className="text-base font-bold text-white">{name}</p>
          <span className="inline-block text-xs px-2 py-0.5 rounded-md font-extrabold mt-1"
            style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>

        {/* Keywords with match highlighting */}
        {keywords.length > 0 && (
          <div className="mt-3 px-1">
            <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-1.5 text-center">关键词</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {keywords.map(kw => {
                const matched = communityWords.some(cw => cw.revealed && cw.word === kw);
                return (
                  <span key={kw}
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-all ${
                      matched
                        ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                        : 'bg-white/8 text-white/50'
                    }`}>
                    {matched ? '✓ ' : ''}{kw}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Close */}
        <button onClick={onClose}
          className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition-colors cursor-pointer active:scale-[0.98]">
          关闭
        </button>
      </div>
    </div>
  );
}
