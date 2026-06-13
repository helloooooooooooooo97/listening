// ─── Poker Table View — the game table with community words, players, and controls ───

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  HiArrowLeft, HiClock, HiSparkles, HiCheck, HiXMark, HiSpeakerWave,
} from 'react-icons/hi2';
import type { PokerGameState, PokerPlayerState } from '../../../lib/api';
import { useWordAudio, primeWordAudioContext } from '../../../hooks/useWordAudio';
import Spinner from '../../ui/Spinner';
import PlayerSeat from './player-seat';
import CardPreviewModal from './card-preview-modal';
import ActionButton from './action-button';

interface PokerTableViewProps {
  game: PokerGameState;
  cardPngMap: Record<string, string>;
  selectedBet: number;
  betting: boolean;
  error: string | null;
  onClearError: () => void;
  onSetBet: (amount: number) => void;
  onAction: (action: string, amount?: number) => void;
  onBack: () => void;
  onRestart: () => void;
}

export default function PokerTableView({
  game, cardPngMap, selectedBet, betting, error, onClearError, onSetBet, onAction, onBack, onRestart,
}: PokerTableViewProps) {
  const isCompleted = game.status === 'completed';
  const [previewCard, setPreviewCard] = useState<{
    name: string; rarity: string; png: string; keywords?: string[]; title?: string; motto?: string;
    matchedWords?: string[];
  } | null>(null);
  const prevPotRef = useRef(game.pot);
  const [potPulse, setPotPulse] = useState(false);

  // ── Entrance animation state ──
  const [animState, setAnimState] = useState<'entering' | 'ready'>('entering');

  // ── Round reveal glow ──
  const [revealGlowIdx, setRevealGlowIdx] = useState(-1);
  const prevRevealedCountRef = useRef(0);

  // ── Chip fly animations ──
  const [chipFlies, setChipFlies] = useState<Array<{ id: number; dx: number; dy: number }>>([]);
  const chipIdRef = useRef(0);

  // Track AI total_bet changes to trigger chip fly animations one by one
  const prevPlayerBetsRef = useRef<Record<number, number>>({});

  // ── Announcement bar ──
  const [announcement, setAnnouncement] = useState<{ key: number; text: string } | null>(null);
  const announceTimerRef = useRef<number | null>(null);

  // ── User-clicked card reveal (instead of auto-flip) ──
  const [userRevealed, setUserRevealed] = useState<Record<number, boolean>>({});
  const { playWordOnClick } = useWordAudio();

  const handleCommunityWordClick = useCallback((index: number, word: string) => {
    primeWordAudioContext();
    playWordOnClick(word);
    setUserRevealed(prev => ({ ...prev, [index]: true }));
  }, [playWordOnClick]);

  // Auto-flip the first unrevealed community word (called after bet/check)
  const autoFlipCurrentWord = () => {
    const idx = game.community_words.findIndex(cw => cw.revealed && !userRevealed[game.community_words.indexOf(cw)]);
    if (idx >= 0 && game.community_words[idx]?.word) {
      primeWordAudioContext();
      playWordOnClick(game.community_words[idx].word!);
      setUserRevealed(prev => ({ ...prev, [idx]: true }));
    }
  };

  // Entrance animation sequence
  useEffect(() => {
    const t = setTimeout(() => setAnimState('ready'), 1500);
    return () => clearTimeout(t);
  }, []);

  // Reveal glow on new community word — auto-flip it
  useEffect(() => {
    const revealedCount = game.community_words.filter(cw => cw.revealed).length;
    if (revealedCount > prevRevealedCountRef.current) {
      const newIdx = revealedCount - 1;
      const cw = game.community_words[newIdx];
      // Auto-flip the newly revealed word
      if (cw?.word) {
        primeWordAudioContext();
        playWordOnClick(cw.word);
        setUserRevealed(prev => ({ ...prev, [newIdx]: true }));
      }
      setRevealGlowIdx(newIdx);
      const t = setTimeout(() => setRevealGlowIdx(-1), 700);
      prevRevealedCountRef.current = revealedCount;
      return () => clearTimeout(t);
    }
    prevRevealedCountRef.current = revealedCount;
  }, [game.community_words, playWordOnClick]);

  // Announcement on round change
  useEffect(() => {
    if (game.round > 1) {
      const text = `📢 第 ${game.round} 轮`;
      setAnnouncement({ key: Date.now(), text });
      if (announceTimerRef.current !== null) clearTimeout(announceTimerRef.current);
      announceTimerRef.current = window.setTimeout(() => {
        setAnnouncement(null);
        announceTimerRef.current = null;
      }, 2800);
    }
  }, [game.round]);

  // Pot change → pulse animation
  useEffect(() => {
    if (game.pot !== prevPotRef.current && game.pot > 0) {
      setPotPulse(true);
      const t = setTimeout(() => setPotPulse(false), 400);
      prevPotRef.current = game.pot;
      return () => clearTimeout(t);
    }
    prevPotRef.current = game.pot;
  }, [game.pot]);

  // AI bet change → chip fly animation (one by one)
  useEffect(() => {
    const ai = game.players.filter(p => p.player_type === 'ai' && !p.folded);
    const positionDirs: Record<number, { dx: number; dy: number }> = {
      0: { dx: 0, dy: 160 },    // top
      1: { dx: 180, dy: -10 },  // left
      2: { dx: -180, dy: -10 }, // right
      3: { dx: 0, dy: -160 },   // bottom (human — already handled in button)
    };

    for (const p of ai) {
      const seatIdx = game.players.indexOf(p);
      const prev = prevPlayerBetsRef.current[p.id] ?? 0;
      const curr = p.total_bet;
      if (curr > prev && curr > 0 && seatIdx >= 0 && seatIdx <= 2) {
        const dir = positionDirs[seatIdx] || { dx: 0, dy: 160 };
        const id = ++chipIdRef.current;
        setChipFlies(prevFlies => [...prevFlies, {
          id,
          dx: dir.dx + (Math.random() - 0.5) * 20,
          dy: dir.dy + (Math.random() - 0.5) * 20,
        }]);
        setTimeout(() => setChipFlies(prev => prev.filter(c => c.id !== id)), 500);
      }
    }

    // Update all player bets ref
    for (const p of game.players) {
      prevPlayerBetsRef.current[p.id] = p.total_bet;
    }
  }, [game.players, game.pot]);

  const potSize = game.pot;
  const aiPlayer = game.players.find(p => p.player_type === 'ai');
  const humanPlayer = game.players.find(p => p.player_type === 'human');
  const aiRoundBets = aiPlayer?.round_bets ?? [];
  const humanRoundBets = humanPlayer?.round_bets ?? [];

  // Render community word cards (center of table) with 3D flip
  const renderCommunityWords = () => (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center gap-1 sm:gap-3 z-10">
      {game.community_words.map((cw, i) => {
        const isFlipped = cw.revealed && userRevealed[i];
        const canReveal = Boolean(cw.word) && cw.revealed && !userRevealed[i] && !isCompleted;
        return (
        <div key={i} className="relative flex flex-col items-center gap-0.5">
          {/* AI round bet above */}
          <div className="text-[9px] text-purple-400/60 font-mono tabular-nums">${aiRoundBets[i] ?? 0}</div>
          <button
            type="button"
            disabled={!canReveal}
            className={`card-flip-container relative min-w-[58px] w-[58px] h-[84px] sm:w-24 sm:h-[120px] border-0 p-0 bg-transparent
              ${animState === 'entering' ? 'animate-card-deal-drop' : ''}
              ${canReveal ? 'cursor-pointer hover:ring-1 hover:ring-emerald-400/40 hover:scale-105 transition-all duration-200' : 'cursor-default'}`}
            style={{
              animationDelay: animState === 'entering' ? `${700 + i * 100}ms` : `${i * 80}ms`,
            }}
            onClick={() => {
              if (!canReveal || !cw.word) return;
              handleCommunityWordClick(i, cw.word);
            }}>
            <div className={`card-flip-inner rounded-2xl ${isFlipped ? 'flipped' : ''}`}>
              {/* Front face — unrevealed (?) */}
              <div className="card-flip-front rounded-2xl border-2 border-white/5"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                }}>
                <span className="text-white/20 text-2xl font-bold">?</span>
                {canReveal && (
                  <span className="absolute bottom-1 text-[6px] text-white/30">点击开牌</span>
                )}
              </div>
              {/* Back face — revealed word */}
              <div className={`card-flip-back rounded-2xl border-2 border-white/15 ${
                  revealGlowIdx === i ? 'animate-word-reveal-glow' : isFlipped ? 'animate-word-ambient' : ''
                }`}
                style={{
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}>
                <div className="flex flex-col items-center gap-1 w-full px-1.5">
                  <span className="text-[10px] sm:text-sm leading-tight font-bold text-white/90 text-center break-words w-full max-w-full">{cw.word}</span>
                  {isFlipped && (
                    <span
                      onClick={(e) => { e.stopPropagation(); if (cw.word) playWordOnClick(cw.word); }}
                      className="text-white/30 hover:text-white/60 transition-colors cursor-pointer inline-flex items-center justify-center">
                      <HiSpeakerWave size={11} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
          {/* Human round bet below */}
          <div className="text-[9px] text-amber-400/60 font-mono tabular-nums">${humanRoundBets[i] ?? 0}</div>
        </div>
        );
      })}
    </div>
  );

  // Render players — AI at top row, human at bottom, community words in middle
  const renderPlayers = () => {
    const ai = game.players.filter(p => p.player_type === 'ai');
    const human = game.players.find(p => p.player_type === 'human');

    const isAIThinking = !isCompleted && game.phase === 'betting' && !betting
      && game.acting_player_id != null && game.acting_player_id !== human?.id;

    return (
      <>
        {/* AI (top) — single opponent */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10">
          {ai[0] && (
            <PlayerSeat
              player={ai[0]}
              cardPng={cardPngMap[ai[0].card_name?.toLowerCase() || '']}
              isHuman={false}
              communityWords={game.community_words}
              position="top"
              seatIndex={0}
              game={game}
              isThinking={isAIThinking && game.acting_player_id === ai[0].id}
              entranceDelay={animState === 'entering' ? 300 : 0}
              onCardClick={(name, rarity, png, keywords) => setPreviewCard({ name, rarity, png, keywords })}
              revealedIndices={userRevealed}
            />
          )}
        </div>

        {/* Human (bottom) */}
        {human && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10">
            <PlayerSeat
              player={human}
              cardPng={cardPngMap[human.card_name?.toLowerCase() || '']}
              isHuman={true}
              communityWords={game.community_words}
              position="bottom"
              seatIndex={3}
              game={game}
              entranceDelay={animState === 'entering' ? 600 : 0}
              onCardClick={(name, rarity, png, keywords) => setPreviewCard({ name, rarity, png, keywords })}
              revealedIndices={userRevealed}
            />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#0a0a0b] via-[#0f1a12] to-[#0a0a0b] overflow-hidden">
      {error && (
        <div className="flex-shrink-0 mx-4 mt-3 px-4 py-2 rounded-xl text-xs flex items-center justify-between gap-2 z-50"
          style={{ background: 'rgba(239,68,68,0.12)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <span>{error}</span>
          <button onClick={onClearError} className="text-white/40 hover:text-white/70 cursor-pointer">
            <HiXMark size={14} />
          </button>
        </div>
      )}
      {/* ── Announcement bar ── */}
      {announcement && (
        <div key={announcement.key} className="absolute top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="mt-3 px-5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-sm text-white/80 font-medium animate-announce-enter"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.1))',
            }}>
            {announcement.text}
          </div>
        </div>
      )}

      {/* ── Chip fly animations ── */}
      {chipFlies.map(cf => (
        <div key={cf.id}
          className="absolute z-50 w-3 h-3 rounded-full pointer-events-none animate-chip-fly"
          style={{
            background: 'radial-gradient(circle, rgba(250,204,21,0.9), rgba(250,204,21,0.4))',
            boxShadow: '0 0 10px rgba(250,204,21,0.6)',
            left: '50%',
            top: '50%',
            '--dx': `${cf.dx}px`,
            '--dy': `${cf.dy}px`,
          } as React.CSSProperties} />
      ))}

      {/* ── Table header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 pt-6 pb-0 z-10">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors cursor-pointer">
          <HiArrowLeft size={18} />
        </button>

        {/* Round & Pot display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 animate-round-pop-in"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <HiClock size={13} />
            第 {game.round}/5 轮
          </div>
          <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold animate-pot-ambient ${
              potPulse ? 'animate-pot-pulse' : ''
            }`}
            style={{
              background: 'rgba(250,45,72,0.12)',
              color: 'var(--accent)',
              boxShadow: '0 0 16px rgba(250,45,72,0.2)',
            }}>
            <HiSparkles size={16} />
            <span className="tabular-nums text-base">{potSize}</span>
            <span className="text-[10px] font-normal text-white/50">IP</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="w-9" />
      </div>

      {/* ── Table area ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 relative overflow-hidden">

        {/* Table felt texture through subtle gradient */}
        <div className="absolute inset-0 rounded-[40px] opacity-20"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.08) 0%, transparent 70%),
                        radial-gradient(ellipse at 50% 80%, rgba(59,130,246,0.05) 0%, transparent 60%)`,
          }}
        />

        {/* Player positions + Community words */}
        <div className="relative w-full max-w-4xl" style={{ minHeight: '400px' }}>
          {isCompleted ? (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4">
              <p className="text-lg font-bold text-primary">🏆 +{potSize} IP</p>
              <div className="flex gap-3">
                <button onClick={() => { onRestart(); }}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-white/10 text-white/80 hover:bg-white/15 transition-colors cursor-pointer">
                  再来一局
                </button>
                <button onClick={() => { onBack(); }}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-transparent text-white/50 hover:text-white/70 border border-white/10 hover:border-white/20 transition-colors cursor-pointer">
                  退出游戏
                </button>
              </div>
            </div>
          ) : (
            renderCommunityWords()
          )}


          {/* ── Table oval background ── */}
          <div className={`absolute inset-0 top-4 bottom-4 mx-6 rounded-[120px] border border-white/5
              ${animState === 'entering' ? 'animate-table-reveal' : ''}
              animate-felt-breath`}
            style={{
              background: 'radial-gradient(ellipse at 50% 60%, rgba(16,185,129,0.06), transparent 70%)',
            }}
          />

          {renderPlayers()}

          {/* ── Result overlay — removed, winner gets 👑 in seat instead ── */}
          {game.phase === 'showdown' && !isCompleted && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
              <div className="flex items-center justify-center gap-3 py-4">
                <Spinner size={20} />
                <span className="text-sm text-white/40">摊牌中...</span>
              </div>
            </div>
          )}

          {/* ── Card preview modal ── */}
          {previewCard && (
            <CardPreviewModal
              card={previewCard}
              matchedWords={(() => {
                const kw = previewCard.keywords || [];
                return game.community_words
                  .filter(cw => cw.revealed && cw.word && kw.includes(cw.word))
                  .map(cw => cw.word!);
              })()}
              onClose={() => setPreviewCard(null)}
            />
          )}
        </div>

      </div>

      {/* ── Bottom controls ── */}

      {/* Betting controls */}
      {!isCompleted && game.phase === 'betting' && game.can_act && (
        <div className="flex-shrink-0 px-5 pb-24 pt-3">
          <div className="max-w-sm mx-auto">
            {/* Action row: check | bet amounts | fold */}
            <div className="flex items-center gap-2">
              <ActionButton
                icon={<HiCheck size={15} />}
                label="过牌"
                onClick={() => { autoFlipCurrentWord(); onAction('check'); }}
                disabled={betting}
                variant="secondary"
              />

              <div className="flex gap-1">
                {[10, 50, 100, 500, 1000].map(amount => (
                  <button key={amount}
                    onClick={() => {
                      autoFlipCurrentWord();
                      const id = ++chipIdRef.current;
                      const dx = (Math.random() - 0.5) * 60;
                      const dy = -(180 + Math.random() * 60);
                      setChipFlies(prev => [...prev, { id, dx, dy }]);
                      setTimeout(() => setChipFlies(prev => prev.filter(c => c.id !== id)), 500);
                      onSetBet(amount); onAction('bet', amount);
                    }}
                    disabled={betting}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer poker-chip-btn
                      disabled:opacity-30 disabled:cursor-not-allowed active:scale-95
                      bg-white/6 text-white/50
                      ${selectedBet === amount ? 'ring-1 ring-white/20' : ''}`}>
                    {amount}
                  </button>
                ))}
              </div>

              <ActionButton
                icon={<HiXMark size={15} />}
                label="弃牌"
                onClick={() => onAction('fold')}
                disabled={betting}
                variant="danger"
              />
            </div>
          </div>
        </div>
      )}

      {/* Waiting for AI */}
      {!isCompleted && game.phase === 'betting' && !game.can_act && (
        <div className="flex-shrink-0 px-5 pb-24 pt-3">
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="flex items-center gap-1 animate-thinking-dots">
              <span className="w-2 h-2 rounded-full bg-emerald-400/40" />
              <span className="w-2 h-2 rounded-full bg-emerald-400/40" />
              <span className="w-2 h-2 rounded-full bg-emerald-400/40" />
            </div>
            <span className="text-sm text-white/40">AI 对手思考中</span>
          </div>
        </div>
      )}

    </div>
  );
}
