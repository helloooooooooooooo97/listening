// ─── Showdown Result — dramatic card reveal with win/loss feedback ───

import { useState, useEffect, useRef, useMemo } from 'react';
import { cardImageUrl } from '../../../lib/api';
import { rarity as rc } from '../../../constants/rarity';
import type { PokerGameState } from '../../../lib/api';

interface ShowdownResultProps {
  showdown: NonNullable<PokerGameState['showdown']>;
  pot: number;
  communityWords?: PokerGameState['community_words'];
  onPlayAgain: () => void;
}

type RevealPhase = 'spotlight' | 'revealing' | 'showing' | 'done';

interface ParticleSeed {
  left: string;
  top: string;
  dx: string;
  dy: string;
  color: string;
  delay: string;
}

interface ConfettiSeed {
  left: string;
  dy: string;
  rot: string;
  color: string;
  delay: string;
}

function makeParticles(count: number): ParticleSeed[] {
  const colors = ['rgba(250,204,21,0.7)', 'rgba(16,185,129,0.6)', 'rgba(255,255,255,0.5)',
    'rgba(250,45,72,0.5)', 'rgba(52,211,153,0.6)'];
  return Array.from({ length: count }, (_, i) => ({
    left: `${20 + Math.random() * 60}%`,
    top: `${20 + Math.random() * 60}%`,
    dx: `${(Math.random() - 0.5) * 160}px`,
    dy: `${(Math.random() - 0.5) * 160 - 40}px`,
    color: colors[i % 5],
    delay: `${(i < 20 ? 0 : 0.3) + i * 0.04}s`,
  }));
}

function makeConfetti(count: number): ConfettiSeed[] {
  const colors = ['#facc15', '#22c55e', '#fbbf24', '#a7f3d0', '#fde68a'];
  return Array.from({ length: count }, (_, i) => ({
    color: colors[i % colors.length],
    left: `${10 + Math.random() * 80}%`,
    dy: `${80 + Math.random() * 100}px`,
    rot: `${Math.random() * 720}deg`,
    delay: `${i * 0.15}s`,
  }));
}

export default function ShowdownResult({
  showdown, pot, communityWords, onPlayAgain,
}: ShowdownResultProps) {
  const humanResult = showdown.results.find(r => r.player_type === 'human');
  const isWin = humanResult?.is_winner;
  const sorted = [...showdown.results].sort((a, b) => b.matches - a.matches);
  const [phase, setPhase] = useState<RevealPhase>('spotlight');
  const [revealedCards, setRevealedCards] = useState<boolean[]>([false, false, false, false]);
  const doneRef = useRef(false);
  const particles = useMemo(() => makeParticles(40), []);
  const confetti = useMemo(() => makeConfetti(12), []);

  // Staged reveal sequence
  useEffect(() => {
    // Phase 1: spotlight (0-400ms)
    const t1 = setTimeout(() => {
      setPhase('revealing');
    }, 400);

    // Phase 2: reveal cards one by one (400-1600ms)
    const t2 = setTimeout(() => {
      // Reveal winner last
      const order = sorted.map((r, i) => ({ i, isWinner: r.is_winner }));
      const revealOrder = order.sort((a, b) => a.isWinner ? 1 : (b.isWinner ? -1 : 0));
      revealOrder.forEach(({ i }, idx) => {
        setTimeout(() => {
          setRevealedCards(prev => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, idx * 300);
      });
    }, 500);

    // Phase 3: showing (after all revealed)
    const t3 = setTimeout(() => {
      setPhase('showing');
      // Win sound
      if (isWin && !doneRef.current) {
        doneRef.current = true;
      }
    }, 500 + sorted.length * 300);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [sorted, isWin]);

  return (
    <div className="flex-shrink-0 px-5 pb-6 pt-3 overflow-y-auto max-h-[60vh]">
      <div className="max-w-sm mx-auto animate-fade-in">
        {/* Result banner */}
        <div className={`text-center py-5 px-6 rounded-2xl mb-5 relative overflow-hidden ${
            isWin ? 'animate-shimmer-border' : ''
          }`}
          style={{
            background: isWin
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.06))',
            border: `1px solid ${isWin ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.15)'}`,
          }}>
          {/* Particles for win — 2 waves of 20 particles */}
          {isWin && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {particles.map((p, i) => (
                <div key={i} className="absolute w-2 h-2 rounded-full animate-particle"
                  style={{
                    background: p.color,
                    left: p.left,
                    top: p.top,
                    '--dx': p.dx,
                    '--dy': p.dy,
                    animationDelay: p.delay,
                  } as React.CSSProperties} />
              ))}
            </div>
          )}

          {/* Confetti for win */}
          {isWin && phase === 'showing' && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {confetti.map((seed, i) => (
                <div key={'c' + i} className="absolute w-1.5 h-1.5 rounded-sm animate-confetti-fall"
                  style={{
                    background: seed.color,
                    left: seed.left,
                    top: '-5%',
                    '--confetti-dy': seed.dy,
                    '--confetti-rot': seed.rot,
                    animationDelay: seed.delay,
                  } as React.CSSProperties} />
              ))}
            </div>
          )}

          {/* Loss ember effect */}
          {!isWin && phase === 'showing' && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute w-20 h-20 rounded-full animate-ember-fade"
                style={{
                  background: 'radial-gradient(circle, rgba(239,68,68,0.15), transparent)',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }} />
            </div>
          )}

          <div className={`text-xl font-extrabold mb-1 ${isWin ? 'text-emerald-400' : 'text-white/60'}`}
            style={{
              opacity: phase === 'spotlight' ? 0.5 : 1,
              transition: 'opacity 0.5s',
            }}>
            {isWin ? '🏆 胜利！' : '💔 本局惜败'}
          </div>
          <div className="text-sm text-white/50">
            底池 <strong className={`tabular-nums ${isWin ? 'text-emerald-400' : 'text-white/70'}`}>{pot}</strong> IP
            {!isWin && ' · 再接再厉'}
          </div>
        </div>

        {/* All cards — comparison grid with staged reveal */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/40 uppercase tracking-widest">摊牌结果</span>
            <span className="text-[10px] text-white/20">匹配数</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {sorted.map((r, i) => {
              const cfg = rc(r.card_rarity);
              const isHum = r.player_type === 'human';
              const isRevealed = revealedCards[i];
              return (
                <div key={r.player_id}
                  className={`rounded-xl p-2 text-center transition-all duration-500 ${
                    r.folded ? 'opacity-30' : ''
                  } ${r.is_winner ? 'ring-1 animate-pulse-glow' : ''}`}
                  style={{
                    background: r.is_winner
                      ? `linear-gradient(135deg, ${cfg.bg}, transparent)`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${r.is_winner ? cfg.border : 'rgba(255,255,255,0.06)'}`,
                    transform: isRevealed ? 'scale(1)' : 'scale(0.85)',
                    opacity: isRevealed ? (r.folded ? 0.3 : 1) : 0,
                  }}>
                  {/* Card mini with rise animation */}
                  <div className={`w-full aspect-[3/4] rounded-lg overflow-hidden mb-1.5 ${isRevealed ? 'animate-card-rise-flip' : ''}`}
                    style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <img src={cardImageUrl(r.card_png)} alt={r.card_name}
                      className="w-full h-full object-cover" />
                  </div>
                  {!r.folded && (
                    <div className={`flex items-center justify-center gap-0.5 ${isRevealed ? 'animate-speed-pop' : ''}`}>
                      <span className={`text-base font-extrabold tabular-nums ${r.is_winner ? 'text-emerald-400' : 'text-white/70'}`}>
                        {r.matches}
                      </span>
                      <span className="text-[8px] text-white/30">/5</span>
                    </div>
                  )}
                  <p className="text-[9px] text-white/40 truncate mt-0.5">
                    {isHum ? '你' : ''}
                    {r.is_winner ? ' 👑' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Community words recap */}
        {communityWords && (
          <details className="mb-5 text-center">
            <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors">
              公共词回顾
            </summary>
            <div className="flex justify-center flex-wrap gap-2 mt-2">
              {communityWords.map((cw, i) => (
                <span key={i}
                  className={`text-[10px] px-2 py-1 rounded-full ${
                    cw.revealed ? 'bg-white/8 text-white/40' : 'bg-white/5 text-white/20'
                  }`}>
                  {cw.revealed ? cw.word : '?'}
                </span>
              ))}
            </div>
          </details>
        )}

        {/* Play again */}
        <button onClick={onPlayAgain}
          className="w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer active:scale-[0.98]"
          style={{
            background: isWin
              ? 'linear-gradient(135deg, var(--accent), #ff6b7f)'
              : 'rgba(255,255,255,0.08)',
            color: isWin ? '#fff' : 'rgba(255,255,255,0.7)',
            border: isWin ? 'none' : '1px solid rgba(255,255,255,0.1)',
          }}>
          再来一局
        </button>
      </div>
    </div>
  );
}
