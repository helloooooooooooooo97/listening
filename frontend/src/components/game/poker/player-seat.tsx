// ─── Player Seat — 每人展示5张卡+命中数,保留赌桌布局 ───

import { useEffect, useRef, useState } from 'react';
import { cardImageUrl } from '../../../lib/api';
import { rarity as rc } from '../../../constants/rarity';
import type { PokerPlayerState, PokerGameState } from '../../../lib/api';

interface PlayerSeatProps {
  player: PokerPlayerState;
  cardPng?: string;
  isHuman: boolean;
  communityWords: PokerGameState['community_words'];
  position: 'top' | 'left' | 'right' | 'bottom';
  game: PokerGameState;
  seatIndex?: number;
  isThinking?: boolean;
  entranceDelay?: number;
  onCardClick?: (name: string, rarity: string, png: string, keywords: string[]) => void;
  revealedIndices?: Record<number, boolean>;
}

const RARITY_BORDER: Record<string, string> = {
  R: 'border-blue-500/30', SR: 'border-purple-500/30',
  SSR: 'border-orange-500/30', UR: 'border-amber-500/30',
};
const RARITY_BG: Record<string, string> = {
  R: 'from-blue-500/10 to-blue-600/5', SR: 'from-purple-500/10 to-purple-600/5',
  SSR: 'from-orange-500/10 to-orange-600/5', UR: 'from-amber-400/10 to-amber-600/5',
};

const HAND_LABELS: Record<number, string> = {
  1: '五福临门', 2: '一条龙', 3: '四喜临门', 4: '葫芦',
  5: '三花聚顶', 6: '两对', 7: '一对', 8: '散牌',
};

export default function PlayerSeat({
  player, cardPng, isHuman, communityWords, position, game, seatIndex,
  isThinking, entranceDelay, onCardClick, revealedIndices,
}: PlayerSeatProps) {
  const isWinner = player.is_winner;
  const isCompleted = game.status === 'completed';
  const isBottom = position === 'bottom';
  const prevFoldedRef = useRef(player.folded);
  const [showFoldAnim, setShowFoldAnim] = useState(false);

  const cards = player.cards || [];
  const scores = player.scores || [];
  const hand = player.hand;

  useEffect(() => {
    if (player.folded && !prevFoldedRef.current) {
      setShowFoldAnim(true);
      const t = setTimeout(() => setShowFoldAnim(false), 600);
      prevFoldedRef.current = player.folded;
      return () => clearTimeout(t);
    }
    prevFoldedRef.current = player.folded;
  }, [player.folded]);

  const label = isBottom ? '' : '';

  return (
    <div className={`transition-all duration-500 flex flex-col items-center gap-0.5
        ${isThinking ? 'animate-think-glow' : ''}
        ${showFoldAnim ? 'animate-fold-shrink' : ''}`}
      style={{
        opacity: player.folded && !isCompleted ? 0.3 : 1,
      }}>

      {/* Hand badge (settlement only) */}
      {isCompleted && hand && (
        <div className="mb-0.5">
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full text-black"
            style={{
              background: hand.rank <= 2 ? 'linear-gradient(135deg, #fbbf24, #f97316)' :
                          hand.rank <= 4 ? 'linear-gradient(135deg, #38bdf8, #6366f1)' :
                          hand.rank <= 6 ? 'linear-gradient(135deg, #a3a3a3, #787878)' :
                          'linear-gradient(135deg, #d4d4d4, #a3a3a3)'
            }}>
            {HAND_LABELS[hand.rank] || hand.name}
          </span>
        </div>
      )}

      {/* 5 cards row */}
      <div className="flex gap-1">
        {cards.length > 0 ? cards.map((c, ci) => {
          const sc = scores[ci] ?? 0;
          const scoreColor = '#ef4444';
          const cardKw: string[] = (c as any).keywords || [];
          const matchedWords = communityWords
            .filter(cw => cw.revealed && (!revealedIndices || revealedIndices[cw.index]) && cw.word && cardKw.includes(cw.word))
            .map(cw => cw.word!) as string[];
          return (
            <div key={ci} className="flex flex-col items-center gap-0.5">
              <div onClick={() => {
                if (onCardClick) onCardClick(c.name, c.rarity, c.png, cardKw);
              }}
                className={`relative rounded-lg border ${RARITY_BORDER[c.rarity] || 'border-white/15'} bg-gradient-to-b ${RARITY_BG[c.rarity] || 'from-white/5 to-white/0'} flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer hover:ring-1 hover:ring-white/20 w-[76px] h-[106px] sm:w-[110px] sm:h-[154px]
                  ${isWinner && isCompleted ? 'ring-1 ring-amber-400/40' : ''}
                  ${player.folded ? 'grayscale' : ''}`}>
                {isHuman || isCompleted ? (
                  <img src={cardImageUrl(c.png)} alt={c.name}
                    className="w-full h-full object-cover rounded-lg absolute inset-0" />
                ) : (
                  <div className="w-full h-full rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08))' }}>
                    <span className="text-white/20 text-3xl">🂠</span>
                  </div>
                )}
                {/* Score — human always, AI only at settlement */}
                {(isHuman || isCompleted) && (
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shadow-lg ring-1 ring-black/20"
                    style={{ background: scoreColor, color: '#fff' }}>
                    {sc}
                  </div>
                )}
                {/* Matched words overlay at bottom of card */}
                {(isHuman || isCompleted) && matchedWords.length > 0 && (
                  <div className="absolute bottom-0 inset-x-0 flex flex-wrap justify-center gap-x-1 gap-y-0 px-1 pb-1 pt-4 rounded-b-lg"
                    style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.8))' }}>
                    {matchedWords.map(w => (
                      <span key={w} className="text-[9px] sm:text-[10px] text-emerald-300 leading-tight truncate max-w-[48px]">{w}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }) : (
          /* Fallback: card back */
          <div className="w-[46px] h-[64px] rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-white/20 text-lg">🂠</span>
          </div>
        )}
      </div>

      {isThinking && (
        <div className="flex items-center gap-1 mt-0.5 animate-thinking-dots">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
        </div>
      )}
    </div>
  );
}
