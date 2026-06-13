// ─── Poker v2 Table — 赌桌布局,每人5张卡,按牌型比大小 ───

import { useState, useEffect, useRef } from 'react';
import { HiSpeakerWave, HiArrowLeft } from 'react-icons/hi2';
import type { PokerV2RoundResult } from '../../../lib/api';
import { useWordAudio } from '../../../hooks/useWordAudio';

interface Props {
  roundResult: PokerV2RoundResult;
  roundNum: number;
  totalRounds: number;
  totalNet: number;
  error: string | null;
  onPlayNext: () => void;
  onBack: () => void;
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

function HandBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: 'from-amber-300 to-orange-500', 2: 'from-violet-300 to-fuchsia-500',
    3: 'from-rose-300 to-red-500', 4: 'from-sky-300 to-indigo-500',
    5: 'from-teal-300 to-green-500', 6: 'from-gray-300 to-zinc-400',
    7: 'from-stone-300 to-gray-400', 8: 'from-stone-200 to-gray-300',
  };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r ${colors[rank] || 'from-gray-300 to-gray-400'} text-black`}>
      {HAND_LABELS[rank] || `#${rank}`}
    </span>
  );
}

export default function PokerV2TableView({
  roundResult, roundNum, totalRounds, totalNet, error, onPlayNext, onBack,
}: Props) {
  const { playWordOnClick } = useWordAudio();
  const [phase, setPhase] = useState<'words' | 'cards' | 'done'>('words');
  const [wordIdx, setWordIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { words, players, winner_index, pot } = roundResult;

  // Auto-advance: reveal words one by one → show cards → done
  useEffect(() => {
    if (phase === 'words' && wordIdx < words.length) {
      timerRef.current = setTimeout(() => setWordIdx(i => i + 1), 900);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    if (phase === 'words' && wordIdx >= words.length) {
      const t = setTimeout(() => setPhase('cards'), 400);
      return () => clearTimeout(t);
    }
    if (phase === 'cards') {
      const t = setTimeout(() => setPhase('done'), 1200);
      return () => clearTimeout(t);
    }
  }, [phase, wordIdx, words.length]);

  const handleNext = () => {
    setPhase('words'); setWordIdx(0); onPlayNext();
  };

  const isRevealed = phase !== 'words';

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-1 z-10">
        <button onClick={onBack}
          className="text-[11px] text-tertiary hover:text-secondary transition-colors cursor-pointer flex items-center gap-1">
          <HiArrowLeft size={13} /> 返回
        </button>
        <div className="flex items-center gap-3 text-[11px] text-tertiary">
          <span className="font-medium text-primary/70">第 {roundNum}/{totalRounds} 回合</span>
          <span>底池 <strong className="text-amber-400">{pot} ✨</strong></span>
          <span>净收益 <strong className={totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>{totalNet >= 0 ? '+' : ''}{totalNet}</strong></span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 relative mx-3 mb-1 rounded-2xl overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at center, #1a4a2e 0%, #0d2818 50%, #0a1a10 100%)',
          border: '1px solid rgba(255,215,0,0.12)',
          boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5)',
        }}>
        {/* Felt texture rings */}
        <div className="absolute inset-[10%] rounded-full border border-amber-900/15" />
        <div className="absolute inset-[20%] rounded-full border border-amber-900/8" />

        {/* ── Top AI ── */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-primary/70 font-medium">{players[1]?.name}</span>
            {isRevealed && <HandBadge rank={players[1]?.hand.rank} />}
          </div>
          <PlayerCards
            cards={players[1]?.cards || []}
            scores={players[1]?.scores || []}
            isRevealed={isRevealed}
            delay={200}
            isWinner={winner_index === 1}
          />
        </div>

        {/* ── Left AI ── */}
        <div className="absolute top-1/2 -translate-y-1/2 left-2 flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-primary/70 font-medium">{players[2]?.name}</span>
              {isRevealed && <HandBadge rank={players[2]?.hand.rank} />}
            </div>
            <PlayerCards
              cards={players[2]?.cards || []}
              scores={players[2]?.scores || []}
              isRevealed={isRevealed}
              delay={400}
              isWinner={winner_index === 2}
            />
          </div>
        </div>

        {/* ── Right AI ── */}
        <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-primary/70 font-medium">{players[3]?.name}</span>
              {isRevealed && <HandBadge rank={players[3]?.hand.rank} />}
            </div>
            <PlayerCards
              cards={players[3]?.cards || []}
              scores={players[3]?.scores || []}
              isRevealed={isRevealed}
              delay={600}
              isWinner={winner_index === 3}
            />
          </div>
        </div>

        {/* ── Bottom Human ── */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary">{players[0]?.name}</span>
            {isRevealed && <HandBadge rank={players[0]?.hand.rank} />}
          </div>
          <PlayerCards
            cards={players[0]?.cards || []}
            scores={players[0]?.scores || []}
            isRevealed={isRevealed}
            delay={0}
            isWinner={winner_index === 0}
          />
        </div>

        {/* ── Community Words (center) ── */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-20">
          <div className="text-[8px] text-amber-400/40 mb-1 tracking-widest uppercase">公共词</div>
          <div className="flex items-center gap-1 justify-center">
            {words.map((w, i) => (
              <button key={i} onClick={() => playWordOnClick(w)}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all duration-500 cursor-pointer ${
                  i < wordIdx
                    ? 'bg-white/15 text-primary border border-white/10'
                    : i === wordIdx && phase === 'words'
                      ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40 scale-110 shadow-lg shadow-amber-500/20'
                      : 'bg-white/5 text-tertiary/30 border border-white/5'
                }`}>
                <HiSpeakerWave size={9} className={`inline mr-0.5 ${i === wordIdx && phase === 'words' ? 'animate-pulse' : ''}`} />
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* ── Pot (center low) ── */}
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 text-center z-20"
          style={{ marginBottom: '-1rem' }}>
          <div className="text-[8px] text-amber-400/40">底池</div>
          <div className="text-lg font-bold text-amber-400 drop-shadow-lg">{pot} ✨</div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex-shrink-0 flex items-center justify-center px-4 pb-3 pt-1 gap-3">
        {phase === 'done' ? (
          <button onClick={handleNext}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:scale-105 transition-all cursor-pointer shadow-lg shadow-amber-500/20">
            下一回合
          </button>
        ) : phase === 'cards' ? (
          <div className="text-[11px] text-tertiary/50 animate-pulse">正在揭晓手牌...</div>
        ) : wordIdx < words.length ? (
          <div className="text-[11px] text-tertiary/50">
            播报第 {wordIdx + 1}/{words.length} 个词
            <span className="ml-1 animate-pulse">▌</span>
          </div>
        ) : null}
        {error && <div className="text-[11px] text-red-400">{error}</div>}
      </div>
    </div>
  );
}

/* ── 5 cards row for a player ── */
function PlayerCards({ cards, scores, isRevealed, delay, isWinner }: {
  cards: { card_id: string; name: string; rarity: string; png: string }[];
  scores: number[];
  isRevealed: boolean;
  delay: number;
  isWinner: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {cards.map((card, ci) => {
        const sc = scores[ci] ?? 0;
        const scoreColor = sc >= 4 ? '#34d399' : sc >= 2 ? '#fbbf24' : '#6b7280';
        return (
          <div key={ci}
            className={`w-[52px] h-[76px] rounded-lg border ${RARITY_BORDER[card.rarity] || 'border-white/15'} bg-gradient-to-b ${RARITY_BG[card.rarity] || 'from-white/5 to-white/0'} flex flex-col items-center justify-center text-center p-0.5 transition-all duration-500 ${
              isRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            } ${isWinner ? 'ring-1 ring-amber-400/30' : ''}`}
            style={{ transitionDelay: `${delay + ci * 80}ms` }}>
            <div className="text-[6px] font-bold text-primary/80 leading-tight truncate w-full px-0.5">{card.name}</div>
            <div className="text-lg font-bold mt-0.5" style={{ color: scoreColor }}>{sc}</div>
            <div className="text-[6px] text-tertiary/40">/5</div>
          </div>
        );
      })}
    </div>
  );
}
