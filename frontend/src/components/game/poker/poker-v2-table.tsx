// ─── Poker v2 Table — 每人5张卡, 5个公共词, 按牌型大小比胜负 ───

import { useState, useEffect, useRef } from 'react';
import { HiSpeakerWave, HiArrowPath } from 'react-icons/hi2';
import type { PokerV2RoundResult } from '../../../lib/api';
import { useWordAudio } from '../../../hooks/useWordAudio';

interface Props {
  roundResult: PokerV2RoundResult;
  roundNum: number;
  totalRounds: number;
  totalNet: number;
  sessionOver: boolean;
  error: string | null;
  onPlayNext: () => void;
  onBack: () => void;
}

const HAND_COLORS: Record<number, string> = {
  1: 'from-amber-300 via-yellow-400 to-orange-500',  // 五福临门
  2: 'from-violet-300 via-purple-400 to-fuchsia-500', // 一条龙
  3: 'from-rose-300 via-pink-400 to-red-500',         // 四喜临门
  4: 'from-sky-300 via-blue-400 to-indigo-500',       // 葫芦
  5: 'from-teal-300 via-emerald-400 to-green-500',    // 三花聚顶
  6: 'from-slate-200 via-gray-300 to-zinc-400',       // 两对
  7: 'from-stone-200 via-neutral-300 to-gray-400',    // 一对
  8: 'from-stone-100 via-neutral-200 to-gray-300',    // 散牌
};

const HAND_BG: Record<number, string> = {
  1: 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-amber-400/40',
  2: 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border-violet-400/40',
  3: 'bg-gradient-to-br from-rose-500/20 to-red-500/10 border-rose-400/40',
  4: 'bg-gradient-to-br from-sky-500/20 to-indigo-500/10 border-sky-400/40',
  5: 'bg-gradient-to-br from-teal-500/20 to-green-500/10 border-teal-400/40',
  6: 'bg-gray-500/10 border-gray-400/20',
  7: 'bg-gray-500/5 border-gray-400/15',
  8: 'bg-gray-400/5 border-gray-300/10',
};

const RARITY_GRADIENT: Record<string, string> = {
  R: 'from-blue-400/30 to-blue-600/10',
  SR: 'from-purple-400/30 to-purple-600/10',
  SSR: 'from-orange-400/30 to-orange-600/10',
  UR: 'from-amber-300/30 to-amber-600/10',
};

const RARITY_BORDER: Record<string, string> = {
  R: 'border-blue-500/30',
  SR: 'border-purple-500/30',
  SSR: 'border-orange-500/30',
  UR: 'border-amber-500/30',
};

export default function PokerV2TableView({
  roundResult, roundNum, totalRounds, totalNet, sessionOver, error, onPlayNext, onBack,
}: Props) {
  const { playWordOnClick } = useWordAudio();
  const [phase, setPhase] = useState<'listening' | 'revealing' | 'showdown'>('listening');
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [revealPlayerIdx, setRevealPlayerIdx] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { words, players, winner_index, winner_name, winner_hand, pot, cost, reward, net, balance_after } = roundResult;

  // Auto-advance through phases
  useEffect(() => {
    if (phase === 'listening' && currentWordIdx < words.length) {
      timerRef.current = setTimeout(() => setCurrentWordIdx(i => i + 1), 800);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    if (phase === 'listening' && currentWordIdx >= words.length) {
      timerRef.current = setTimeout(() => setPhase('revealing'), 500);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    if (phase === 'revealing' && revealPlayerIdx < players.length - 1) {
      timerRef.current = setTimeout(() => setRevealPlayerIdx(i => i + 1), 600);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    if (phase === 'revealing' && revealPlayerIdx >= players.length - 1) {
      timerRef.current = setTimeout(() => setPhase('showdown'), 400);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
  }, [phase, currentWordIdx, revealPlayerIdx, words.length, players.length]);

  const handlePlayWord = (word: string) => {
    playWordOnClick(word);
  };

  const handleNext = () => {
    setPhase('listening');
    setCurrentWordIdx(0);
    setRevealPlayerIdx(-1);
    onPlayNext();
  };

  const handleNewSession = () => {
    setPhase('listening');
    setCurrentWordIdx(0);
    setRevealPlayerIdx(-1);
    onBack();
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#0a0a1a] via-[#0d0d2b] to-[#1a0a2e] overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={onBack}
          className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer flex items-center gap-1">
          ← 返回
        </button>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-tertiary">回合 {roundNum}/{totalRounds}</span>
          <span className="text-tertiary">总盈亏: <span className={totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>{totalNet >= 0 ? '+' : ''}{totalNet} ✨</span></span>
          <span className="text-tertiary">余额: {balance_after} ✨</span>
        </div>
      </div>

      {/* Phase: Listening — 公共词逐个播报 */}
      {phase === 'listening' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <p className="text-xs text-tertiary tracking-widest uppercase">公共词汇</p>
          <div className="flex items-center gap-3">
            {words.map((w, i) => (
              <button key={i} onClick={() => handlePlayWord(w)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-500 cursor-pointer
                  ${i < currentWordIdx ? 'bg-white/10 text-primary border border-white/10' :
                    i === currentWordIdx ? 'bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-amber-300 border border-amber-400/40 scale-110 shadow-lg shadow-amber-500/20' :
                    'bg-white/5 text-tertiary/50 border border-white/5'}`}>
                <HiSpeakerWave size={12} className={`inline mr-1.5 ${i === currentWordIdx ? 'animate-pulse' : ''}`} />
                {w}
              </button>
            ))}
          </div>
          <p className="text-xs text-tertiary mt-4">
            {currentWordIdx < words.length ? `正在播报第 ${currentWordIdx + 1} 个词...` : '播报完毕'}
          </p>
        </div>
      )}

      {/* Phase: Revealing — 逐家揭示牌型 */}
      {phase === 'revealing' && (
        <div className="flex-1 flex flex-col items-center gap-4 px-4 py-4">
          <p className="text-xs text-tertiary tracking-widest uppercase">揭晓牌型</p>
          <div className="w-full max-w-2xl flex flex-col gap-3">
            {players.map((p, pi) => (
              <div key={pi}
                className={`rounded-xl border p-3 transition-all duration-500 ${
                  pi <= revealPlayerIdx
                    ? (pi === winner_index ? HAND_BG[p.hand.rank] || 'bg-emerald-500/10 border-emerald-400/30' : 'bg-white/5 border-white/10')
                    : 'opacity-20 bg-white/5 border-white/5'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-primary">{p.name}</span>
                  {pi <= revealPlayerIdx && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${HAND_COLORS[p.hand.rank] || 'from-gray-300 to-gray-400'} text-black`}>
                      {p.hand.name}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {p.cards.map((card, ci) => (
                    <div key={ci} className={`flex-1 rounded-lg border ${RARITY_BORDER[card.rarity] || 'border-white/10'} ${RARITY_GRADIENT[card.rarity] || 'bg-white/5'} p-1.5 text-center`}>
                      <div className="text-[10px] font-bold text-primary truncate">{card.name}</div>
                      {pi <= revealPlayerIdx && (
                        <div className="text-lg font-bold mt-0.5"
                          style={{ color: p.scores[ci] >= 4 ? '#34d399' : p.scores[ci] >= 2 ? '#fbbf24' : '#6b7280' }}>
                          ✕{p.scores[ci]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase: Showdown — 宣布赢家 */}
      {phase === 'showdown' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          {sessionOver ? (
            <div className="text-center">
              <div className="text-4xl mb-3">{totalNet >= 0 ? '🏆' : '💪'}</div>
              <p className="text-xl font-bold text-primary mb-1">本局结束</p>
              <p className="text-sm text-tertiary mb-4">
                总收益: <span className={totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>{totalNet >= 0 ? '+' : ''}{totalNet} ✨</span>
              </p>
              <button onClick={handleNewSession}
                className="px-6 py-2 rounded-xl bg-white/10 text-primary text-sm font-medium hover:bg-white/20 transition-all cursor-pointer">
                返回大厅
              </button>
            </div>
          ) : (
            <>
              <div className={`text-4xl ${winner_index === 0 ? 'animate-bounce' : ''}`}>
                {winner_index === 0 ? '🎉' : '😅'}
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-primary">
                  {winner_index === 0 ? '你赢了！' : `${winner_name} 获胜`}
                </p>
                <p className="text-sm text-tertiary mt-1">
                  牌型: <span className={`font-bold bg-gradient-to-r ${HAND_COLORS[players[winner_index]?.hand?.rank] || 'from-gray-300 to-gray-400'} bg-clip-text text-transparent`}>
                    {winner_hand}
                  </span>
                </p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-xs text-tertiary">底池</p>
                  <p className="text-lg font-bold text-amber-400">{pot} ✨</p>
                </div>
                <div>
                  <p className="text-xs text-tertiary">本局</p>
                  <p className={`text-lg font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {net >= 0 ? '+' : ''}{net}
                  </p>
                </div>
              </div>
              <button onClick={handleNext}
                className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:scale-105 transition-all cursor-pointer shadow-lg shadow-amber-500/20">
                下一回合
              </button>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex-shrink-0 px-4 py-2 mx-4 mb-2 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
