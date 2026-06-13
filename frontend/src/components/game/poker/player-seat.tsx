// ─── Player Seat — individual player display around the poker table ───

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
}

export default function PlayerSeat({
  player, cardPng, isHuman, communityWords, position, game, seatIndex,
  isThinking, entranceDelay, onCardClick,
}: PlayerSeatProps) {
  const cfg = rc(player.card_rarity || 'R');
  const isWinner = player.is_winner;
  const isCompleted = game.status === 'completed';
  const kw = player.keywords || [];
  const matchedCount = kw.filter(k => communityWords.some(cw => cw.revealed && cw.word === k)).length;
  const isBottom = position === 'bottom';
  const prevFoldedRef = useRef(player.folded);
  const [showFoldAnim, setShowFoldAnim] = useState(false);

  // Trigger fold animation on fold
  useEffect(() => {
    if (player.folded && !prevFoldedRef.current) {
      setShowFoldAnim(true);
      const t = setTimeout(() => setShowFoldAnim(false), 600);
      prevFoldedRef.current = player.folded;
      return () => clearTimeout(t);
    }
    prevFoldedRef.current = player.folded;
  }, [player.folded]);

  // Position styles — traditional poker table: top / left / right / bottom
  const posStyles: Record<string, string> = {
    top: 'top-0 left-1/2 -translate-x-1/2',
    left: 'top-1/2 -translate-y-1/2 left-0 md:left-8',
    right: 'top-1/2 -translate-y-1/2 right-0 md:right-8',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2',
  };

  const cardW = isBottom ? 'w-24' : 'w-20';
  const cardH = isBottom ? 'h-[130px]' : 'h-[108px]';

  return (
    <div className={`absolute ${posStyles[position]} z-20 transition-all duration-500 flex flex-col items-center
        ${entranceDelay !== undefined && entranceDelay > 0 ? 'animate-seat-pop-in' : ''}
        ${isThinking ? 'animate-think-glow' : ''}
        ${showFoldAnim ? 'animate-fold-shrink' : ''}`}
      style={{
        opacity: player.folded && !isCompleted ? 0.3 : 1,
        animationDelay: entranceDelay ? `${entranceDelay}ms` : '0ms',
      }}>
      {/* Label above card for top / left / right (keeps visual center aligned with community words) */}
      {position !== 'bottom' && (
        <p className={`text-xs font-bold mb-1.5 text-center ${isWinner && isCompleted ? 'text-[var(--accent)]' : 'text-white/70'}`}>
          AI-{(seatIndex ?? 0) + 1}{isWinner && isCompleted && ' 👑'}
        </p>
      )}

      {/* Player card — bottom player gets larger + accent glow. Click to preview. */}
      <div className={`relative rounded-xl overflow-hidden transition-all duration-300 ${player.folded && !isCompleted ? '' : 'cursor-pointer'}
        ${isWinner && isCompleted ? 'ring-2' : ''} ${player.folded ? 'grayscale' : ''} ${player.folded && !isCompleted ? 'pointer-events-none' : ''}
        ${isBottom ? 'ring-2 ring-[var(--accent)]/30' : ''} ${cardW} ${cardH}
        ${isThinking ? 'animate-think-shake' : ''}
        hover:ring-2 hover:ring-white/20`}
        onClick={() => {
          const imgName = cardPng || player.card_name?.toLowerCase().replace(/\s+/g, '_') || '';
          const rarity = player.card_rarity || 'R';
          if (imgName) onCardClick?.(player.card_name || '', rarity, imgName, player.keywords || []);
        }}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: `2px solid ${isCompleted && isWinner ? cfg.border : isBottom ? 'rgba(250,45,72,0.25)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isCompleted && isWinner
            ? `0 0 30px ${cfg.glow}40, 0 4px 16px rgba(0,0,0,0.4)`
            : isBottom
              ? '0 0 18px rgba(250,45,72,0.2)'
              : isThinking
                ? '0 0 14px rgba(16,185,129,0.25)'
                : '0 4px 12px rgba(0,0,0,0.3)',
        }}>
        {isHuman ? (
          <img src={cardImageUrl(cardPng || player.card_name!.toLowerCase().replace(/\s+/g, '_'))}
            alt={player.card_name || ''}
            className="w-full h-full object-cover" />
        ) : isCompleted && (cardPng || player.card_name) ? (
          <img src={cardImageUrl(cardPng || player.card_name!.toLowerCase().replace(/\s+/g, '_'))}
            alt={player.card_name || ''}
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-16 rounded-lg border border-white/10 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08))' }}>
              <span className="text-white/20 text-3xl">🂠</span>
            </div>
          </div>
        )}
      </div>

      {/* Label below card — always show bet amount + match count if any */}
      {isBottom ? (
        <div className="text-center mt-1.5">
          <p className={`text-sm font-bold ${isWinner && isCompleted ? 'text-[var(--accent)]' : 'text-white/80'}`}>
            你{isWinner && isCompleted && ' 👑'}
          </p>
          <div className="flex items-center justify-center gap-1">
            {player.folded ? (
              <span className="text-[10px] text-white/30">✗ 弃牌</span>
            ) : (
              <>
                <span className="text-[10px] text-white/50 font-semibold tabular-nums">${player.total_bet}</span>
                {!isCompleted && matchedCount > 0 && (
                  <span className="text-[9px] text-emerald-400/70">✓{matchedCount}</span>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center mt-1 flex flex-col items-center">
          {player.folded ? (
            <p className="text-[9px] text-white/30">✗ 弃牌</p>
          ) : (
            <>
              <p className="text-[9px] text-white/50 font-semibold tabular-nums">${player.total_bet}</p>
              {!isCompleted && matchedCount > 0 && (
                <p className="text-[7px] text-emerald-400/70">✓{matchedCount}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Thinking dots indicator */}
      {isThinking && (
        <div className="flex items-center gap-1 mt-1 animate-thinking-dots">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
        </div>
      )}
    </div>
  );
}
