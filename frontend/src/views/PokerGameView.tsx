import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiArrowLeft, HiCheck, HiXMark, HiSpeakerWave,
  HiTrophy, HiStar, HiPlay, HiClock, HiInformationCircle,
  HiChevronDown, HiSparkles,
} from 'react-icons/hi2';
import { usePokerStore } from '../stores/pokerStore';
import { cardImageUrl } from '../lib/api';
import type { PokerGameState, PokerPlayerState } from '../lib/api';
import { useCurrencyStore } from '../stores/currencyStore';
import { useWordAudio } from '../hooks/useWordAudio';

// ─── Rarity config (consistent with CardDetailModal) ───

const RARITY_CFG: Record<string, { label: string; color: string; glow: string; bg: string; border: string }> = {
  R:   { label: 'R',  color: '#3b82f6', glow: 'rgba(59,130,246,0.4)',  bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
  SR:  { label: 'SR', color: '#a855f7', glow: 'rgba(168,85,247,0.45)', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)' },
  SSR: { label: 'SSR',color: '#fb923c', glow: 'rgba(251,146,60,0.5)', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.4)' },
  UR:  { label: 'UR', color: '#fbbf24', glow: 'rgba(251,191,36,0.55)',bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.45)' },
};

function rc(rarity: string) { return RARITY_CFG[rarity] || RARITY_CFG.R; }

function fmtTime(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Main view ───

export default function PokerGameView() {
  const store = usePokerStore();
  const navigate = useNavigate();
  const loadBalance = useCurrencyStore(s => s.loadBalance);
  const { lobbyMode, loading, game, cards, history, canPlay, balance, selectedBet, betting } = store;

  useEffect(() => { store.loadLobby(); }, []);
  useEffect(() => {
    if (game?.status === 'completed') loadBalance();
  }, [game?.status]);

  if (lobbyMode === 'lobby') {
    return (
      <PokerLobby
        cards={cards}
        history={history}
        canPlay={canPlay}
        balance={balance}
        loading={loading}
        onStart={store.startGame}
        onBack={() => navigate(-1)}
      />
    );
  }

  if (!game) return null;

  return (
    <PokerTableView
      game={game}
      selectedBet={selectedBet}
      betting={betting}
      onSetBet={store.setSelectedBet}
      onAction={store.doAction}
      onBack={() => { store.backToLobby(); store.loadLobby(); }}
    />
  );
}

// ════════════════════════════════════════════════════════════
//  LOBBY — upgraded with card-game elegance
// ════════════════════════════════════════════════════════════

function PokerLobby({
  cards, history, canPlay, balance, loading, onStart, onBack,
}: {
  cards: { id: string; name: string; rarity: string; png: string; keywords: string[] }[];
  history: { game_id: number; pot: number; human_card: string | null; is_win: boolean; completed_at: number }[];
  canPlay: boolean; balance: number; loading: boolean;
  onStart: (cardId: string) => void; onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-10 pb-2">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="w-8 h-8 rounded-xl flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
            <HiArrowLeft size={16} />
          </button>
          <div className="flex-1" />
          {/* Balance chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            <HiStar size={13} className="text-[var(--accent)]" />
            <span className="tabular-nums">{balance}</span>
            <span className="text-tertiary font-normal">IP</span>
          </div>
        </div>

        <div className="mt-2">
          <h1 className="text-2xl font-extrabold text-primary tracking-tight">🃏 德州听词</h1>
          <p className="text-xs text-tertiary mt-1 max-w-xs">
            德州扑克式词汇对决 · 选一张角色牌，与 3 名 AI 对战，匹配公共词赢取底池
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-6 pb-8 space-y-6">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 border-2 border-[var(--border-secondary)] rounded-full" />
              <div className="absolute inset-0 border-2 border-transparent border-t-[var(--accent)] rounded-full animate-spin" />
            </div>
            <span className="text-xs text-tertiary animate-pulse">加载牌局...</span>
          </div>
        ) : (
          <>

            {/* ── Card selection ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-tertiary uppercase tracking-widest">选择角色牌</h2>
                <span className="text-[10px] text-tertiary">{cards.length} 张可用</span>
              </div>

              {cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-[var(--border-secondary)]"
                  style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="w-16 h-20 rounded-lg mb-3 flex items-center justify-center text-3xl opacity-30"
                    style={{ background: 'var(--bg-secondary)' }}>🂠</div>
                  <p className="text-xs text-tertiary">还没有收藏卡牌</p>
                  <p className="text-[10px] text-tertiary/60 mt-0.5">先去抽卡收集角色吧！</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {cards.map(card => {
                    const cfg = rc(card.rarity);
                    const isSelected = selectedId === card.id;
                    return (
                      <button key={card.id} onClick={() => setSelectedId(card.id)}
                        className="group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer text-left focus:outline-none"
                        style={{
                          background: 'var(--bg-secondary)',
                          boxShadow: isSelected ? `0 0 0 2px ${cfg.color}, 0 8px 24px ${cfg.glow}20` : '0 1px 3px rgba(0,0,0,0.04)',
                          transform: isSelected ? 'translateY(-4px)' : 'none',
                        }}>
                        {/* Rarity stripe top */}
                        <div className="absolute top-0 left-0 right-0 h-1 z-10"
                          style={{ background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})` }} />

                        <div className="aspect-[3/4] relative">
                          <img src={cardImageUrl(card.png)} alt={card.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />

                          {/* Rarity badge */}
                          <div className="absolute top-2 right-2 z-10">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-extrabold tracking-wider"
                              style={{ background: cfg.bg, color: cfg.color, boxShadow: `0 0 8px ${cfg.glow}40` }}>
                              {cfg.label}
                            </span>
                          </div>

                          {/* Gradient overlay at bottom */}
                          <div className="absolute bottom-0 left-0 right-0 h-1/2"
                            style={{ background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.75))' }} />

                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-[11px] font-bold text-white truncate drop-shadow-sm">{card.name}</p>
                          </div>
                        </div>

                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-2 left-2 z-10">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: cfg.color }}>
                              <HiCheck size={11} className="text-white" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Start button ── */}
            <button onClick={() => selectedId && onStart(selectedId)}
              disabled={!selectedId || !canPlay}
              className="relative w-full py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 overflow-hidden cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: selectedId && canPlay
                  ? 'linear-gradient(135deg, var(--accent), #ff6b7f)'
                  : 'var(--bg-secondary)',
                color: selectedId && canPlay ? '#fff' : 'var(--text-tertiary)',
                opacity: selectedId && canPlay ? 1 : 0.5,
              }}>
              {selectedId && canPlay ? (
                <span className="flex items-center justify-center gap-2">
                  <HiPlay size={16} />
                  开始对决 · 底注 <strong>10</strong> IP
                </span>
              ) : !canPlay ? (
                <span className="flex items-center justify-center gap-1.5">
                  <HiStar size={14} />
                  余额不足，需要至少 10 IP
                </span>
              ) : (
                <span>请选择一张角色牌</span>
              )}
            </button>

            {/* ── Quick stats ── */}
            <div className="flex items-center justify-center gap-6 text-[10px] text-tertiary">
              <span className="flex items-center gap-1">
                余额 <strong className="text-primary tabular-nums">{balance}</strong>
              </span>
              <span className="w-px h-3" style={{ background: 'var(--border-primary)' }} />
              <span className="flex items-center gap-1">
                底注 <strong>10</strong> IP
              </span>
              <span className="w-px h-3" style={{ background: 'var(--border-primary)' }} />
              <span className="flex items-center gap-1">
                <HiTrophy size={10} className="text-[var(--accent)]" />
                胜率{' '}
                <strong className="tabular-nums">
                  {history.length > 0
                    ? Math.round((history.filter(h => h.is_win).length / history.length) * 100)
                    : 0}%
                </strong>
              </span>
            </div>

            {/* ── History ── */}
            {history.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-tertiary uppercase tracking-widest mb-3">最近对局</h2>
                <div className="space-y-1.5">
                  {history.slice(0, 5).map(h => (
                    <div key={h.game_id}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-colors"
                      style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="flex items-center gap-2.5">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                          h.is_win ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/10 text-[var(--accent)]'
                        }`}>
                          {h.is_win ? '胜' : '负'}
                        </span>
                        <span className="text-tertiary">{h.human_card || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-tertiary">
                        <span className="tabular-nums">
                          {h.is_win ? '+' : ''}{h.pot} IP
                        </span>
                        <span className="text-[9px] opacity-60">{h.completed_at ? fmtTime(h.completed_at) : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Rules ── */}
            <section>
              <button onClick={() => setRulesOpen(!rulesOpen)}
                className="flex items-center gap-2 text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer">
                <HiInformationCircle size={14} />
                游戏规则
                <HiChevronDown size={12} className={`transition-transform duration-200 ${rulesOpen ? 'rotate-180' : ''}`} />
              </button>
              {rulesOpen && (
                <div className="mt-3 px-3.5 py-3 rounded-xl text-xs leading-relaxed animate-fade-in"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <p>🎴 每局 4 人对战</p>
                    <p>🃏 每人选一张角色牌</p>
                    <p>📖 场上有 5 张单词牌</p>
                    <p>🔓 每轮翻开 1 张</p>
                    <p>✓ 过牌 · ✨ 下注 · ✗ 弃牌</p>
                    <p>🏆 匹配最多者赢全池</p>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  POKER TABLE — the main game view
// ════════════════════════════════════════════════════════════

function PokerTableView({
  game, selectedBet, betting, onSetBet, onAction, onBack,
}: {
  game: PokerGameState;
  selectedBet: number; betting: boolean;
  onSetBet: (amount: number) => void;
  onAction: (action: string, amount?: number) => void;
  onBack: () => void;
}) {
  const isCompleted = game.status === 'completed';
  const [dealAnimate, setDealAnimate] = useState(false);
  const [previewCard, setPreviewCard] = useState<{
    name: string; rarity: string; png: string; keywords: string[];
  } | null>(null);
  const prevRoundRef = useRef(game.round);

  // Trigger deal animation on round change
  useEffect(() => {
    if (game.round !== prevRoundRef.current) {
      setDealAnimate(true);
      const t = setTimeout(() => setDealAnimate(false), 600);
      prevRoundRef.current = game.round;
      return () => clearTimeout(t);
    }
    // First mount
    if (!prevRoundRef.current) prevRoundRef.current = game.round;
  }, [game.round]);

  // Auto-play revealed community words on loop using real audio
  const { playWordAudio } = useWordAudio();
  useEffect(() => {
    if (isCompleted || game.phase === 'showdown') return;

    // Only play the word revealed in this round (index = round - 1)
    const cw = game.community_words[game.round - 1];
    if (!cw?.revealed || !cw.word) return;

    let timer: number;

    const playCurrent = () => {
      playWordAudio(cw.word!);
      timer = window.setTimeout(playCurrent, 5000);
    };

    timer = window.setTimeout(playCurrent, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [game.round, isCompleted, game.phase]);

  const potSize = game.pot;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#0a0a0b] via-[#0f1a12] to-[#0a0a0b] overflow-hidden">
      {/* ── Table header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 pt-10 pb-1 z-10">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors cursor-pointer">
          <HiArrowLeft size={18} />
        </button>

        {/* Round & Pot display */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <HiClock size={13} />
            第 {game.round}/5 轮
          </div>
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
            style={{
              background: 'rgba(250,45,72,0.12)',
              color: 'var(--accent)',
              boxShadow: '0 0 16px rgba(250,45,72,0.2)',
            }}>
            <HiSparkles size={16} />
            <span className="tabular-nums text-base" key={potSize}>{potSize}</span>
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
        <div className="relative w-full max-w-3xl" style={{ minHeight: '560px' }}>
          {/* ── Community words (center) ── */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center gap-2 sm:gap-3 z-10">
            {game.community_words.map((cw, i) => (
              <div key={i}
                className={`relative w-16 h-[90px] sm:w-20 sm:h-[112px] rounded-2xl border-2 transition-all duration-500 flex items-center justify-center
                  ${cw.revealed
                    ? 'border-white/15 scale-100 opacity-100'
                    : 'border-white/5 scale-95 opacity-50'
                  }
                  ${dealAnimate && cw.revealed ? 'animate-scale-in' : ''}`}
                style={{
                  background: cw.revealed
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                  boxShadow: cw.revealed ? '0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                  animationDelay: `${i * 80}ms`,
                }}>
                {cw.revealed ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-bold text-white/90 leading-tight text-center px-1">{cw.word}</span>
                    <button onClick={(e) => { e.stopPropagation(); playWordAudio(cw.word!); }}
                      className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                      <HiSpeakerWave size={11} />
                    </button>
                  </div>
                ) : (
                  <span className="text-white/20 text-2xl font-bold">?</span>
                )}
                {/* Step indicator */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                  <span className={`text-[10px] ${cw.revealed ? 'text-emerald-400/70' : 'text-white/20'}`}>
                    {cw.revealed ? '✦' : '·'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Table oval background ── */}
          <div className="absolute inset-0 top-4 bottom-4 mx-6 rounded-[120px] border border-white/5"
            style={{
              background: 'radial-gradient(ellipse at 50% 60%, rgba(16,185,129,0.06), transparent 70%)',
            }}
          />

          {/* ── Players around the table ── */}
          {/* Layout:
                 [top]
           [left]     [right]
                 [bottom] ← 你
          */}
          {(() => {
            const ai = game.players.filter(p => p.player_type === 'ai');
            const human = game.players.find(p => p.player_type === 'human');
            const seats: { player: PokerPlayerState; pos: 'top' | 'left' | 'right' | 'bottom' }[] = [];
            if (ai[0]) seats.push({ player: ai[0], pos: 'top' });
            if (ai[1]) seats.push({ player: ai[1], pos: 'left' });
            if (ai[2]) seats.push({ player: ai[2], pos: 'right' });
            if (human) seats.push({ player: human, pos: 'bottom' });
            return seats.map(s => (
              <PlayerSeat
                key={s.player.id}
                player={s.player}
                isHuman={s.player.player_type === 'human'}
                communityWords={game.community_words}
                position={s.pos}
                game={game}
                onCardClick={(name, rarity, png, keywords) => setPreviewCard({ name, rarity, png, keywords })}
              />
            ));
          })()}

          {/* ── Result overlay (showdown / quick-win) ── */}
          {isCompleted && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl animate-fade-in">
              {game.showdown ? (
                <ShowdownResult
                  showdown={game.showdown}
                  pot={game.pot}
                  communityWords={game.community_words}
                  onPlayAgain={() => { onBack(); }}
                />
              ) : (
                <div className="text-center px-6">
                  <div className="mb-3">
                    <span className="text-5xl">🎉</span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-white mb-1">全胜！</h2>
                  <p className="text-sm text-white/50 mb-4">AI 全部弃牌，赢得底池</p>
                  <p className="text-3xl font-extrabold text-[var(--accent)] mb-5 tabular-nums">+{game.pot} IP</p>
                  <button onClick={() => { onBack(); }}
                    className="w-56 py-3.5 rounded-xl text-sm font-bold bg-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer"
                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
                    再来一局
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Showdown phase (waiting) — overlay ── */}
          {game.phase === 'showdown' && !isCompleted && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
              <div className="flex items-center justify-center gap-3 py-4">
                <div className="relative w-5 h-5">
                  <div className="absolute inset-0 border-2 border-white/5 rounded-full" />
                  <div className="absolute inset-0 border-2 border-transparent border-t-[var(--accent)] rounded-full animate-spin" />
                </div>
                <span className="text-sm text-white/40">摊牌中...</span>
              </div>
            </div>
          )}

          {/* ── Card preview modal ── */}
          {previewCard && (
            <CardPreviewModal
              name={previewCard.name}
              rarity={previewCard.rarity}
              png={previewCard.png}
              keywords={previewCard.keywords}
              communityWords={game.community_words}
              onClose={() => setPreviewCard(null)}
            />
          )}
        </div>

      </div>

      {/* ── Bottom controls ── */}

      {/* Betting controls */}
      {!isCompleted && game.phase === 'betting' && game.can_act && (
        <div className="flex-shrink-0 px-5 pb-6 pt-3 mb-8">
          <div className="max-w-sm mx-auto">
            {/* Bet slider */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs text-white/30 w-5 text-right">5</span>
              <div className="flex-1 relative">
                <input type="range" min={5} max={50} step={5}
                  value={selectedBet} disabled={betting}
                  onChange={e => onSetBet(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--accent)]"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                  }} />
              </div>
              <span className="text-xs text-white/30 w-5">50</span>
              <div className="flex items-center gap-1 min-w-[60px] justify-end">
                <span className="text-lg font-extrabold text-white tabular-nums">{selectedBet}</span>
                <span className="text-[10px] text-white/30">IP</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <ActionButton
                icon={<HiCheck size={15} />}
                label="过牌"
                onClick={() => onAction('check')}
                disabled={betting}
                variant="secondary"
              />
              <ActionButton
                icon={<HiStar size={15} />}
                label={String(selectedBet)}
                onClick={() => onAction('bet', selectedBet)}
                disabled={betting}
                variant="primary"
              />
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
        <div className="flex-shrink-0 px-5 pb-6 pt-3 mb-8">
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 border-2 border-white/5 rounded-full" />
              <div className="absolute inset-0 border-2 border-transparent border-t-white/40 rounded-full animate-spin" />
            </div>
            <span className="text-sm text-white/40">等待 AI 行动...</span>
          </div>
        </div>
      )}

    </div>
  );
}


function PlayerSeat({
  player, isHuman, communityWords, position, game, onCardClick,
}: {
  player: PokerPlayerState;
  isHuman: boolean;
  communityWords: PokerGameState['community_words'];
  position: 'top' | 'left' | 'right' | 'bottom';
  game: PokerGameState;
  onCardClick?: (name: string, rarity: string, png: string, keywords: string[]) => void;
}) {
  const cfg = rc(player.card_rarity || 'R');
  const isWinner = player.is_winner;
  const isCompleted = game.status === 'completed';
  const kw = player.keywords || [];
  const matchedCount = kw.filter(k => communityWords.some(cw => cw.revealed && cw.word === k)).length;
  const isBottom = position === 'bottom';

  // Position styles — traditional poker table: top / left / right / bottom
  const posStyles: Record<string, string> = {
    top: 'top-0 left-1/2 -translate-x-1/2',
    left: 'top-1/2 -translate-y-1/2 -left-2 sm:left-2 md:left-8',
    right: 'top-1/2 -translate-y-1/2 -right-2 sm:right-2 md:right-8',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2',
  };

  const cardW = isBottom ? 'w-24' : 'w-[72px]';
  const cardH = isBottom ? 'h-[130px]' : 'h-[98px]';

  return (
    <div className={`absolute ${posStyles[position]} z-20 transition-all duration-500 flex flex-col items-center`}
      style={{
        opacity: player.folded && !isCompleted ? 0.3 : 1,
      }}>
      {/* Label above card for top-position player */}
      {position === 'top' && (
        <p className={`text-xs font-bold mb-1.5 text-center ${isWinner && isCompleted ? 'text-[var(--accent)]' : 'text-white/70'}`}>
          AI-{player.id}{isWinner && isCompleted && ' 👑'}
        </p>
      )}

      {/* Player card — bottom player gets larger + accent glow. Click to preview. */}
      <div className={`relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer
        ${isWinner && isCompleted ? 'ring-2' : ''} ${player.folded ? 'grayscale' : ''}
        ${isBottom ? 'ring-2 ring-[var(--accent)]/30' : ''} ${cardW} ${cardH}
        hover:ring-2 hover:ring-white/20`}
        onClick={() => {
          const imgName = player.card_name?.toLowerCase().replace(/\s+/g, '_') || '';
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
              : '0 4px 12px rgba(0,0,0,0.3)',
        }}>
        {isHuman ? (
          <img src={cardImageUrl(player.card_name!.toLowerCase().replace(/\s+/g, '_'))}
            alt={player.card_name || ''}
            className="w-full h-full object-cover" />
        ) : isCompleted && player.card_name ? (
          <img src={cardImageUrl(player.card_name!.toLowerCase().replace(/\s+/g, '_'))}
            alt={player.card_name}
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-16 rounded-lg border border-white/10 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08))' }}>
              <span className="text-white/20 text-2xl">🂠</span>
            </div>
          </div>
        )}
      </div>

      {/* Label below card (bottom = you, left/right/top = AI) */}
      {isBottom ? (
        <div className="text-center mt-1.5">
          <p className={`text-sm font-bold ${isWinner && isCompleted ? 'text-[var(--accent)]' : 'text-white/80'}`}>
            你{isWinner && isCompleted && ' 👑'}
          </p>
          <p className="text-[10px] text-white/40">
            {player.folded ? '弃牌' : !isCompleted && matchedCount > 0 ? `✓${matchedCount} 匹配` : `$${player.total_bet}`}
          </p>
        </div>
      ) : (
        <div className="text-center mt-1">
          <p className="text-[10px] font-bold text-white/60 max-w-[80px] truncate">
            AI-{player.id}
            {player.folded ? ' 弃牌' : ''}
            {isWinner && isCompleted && !isBottom ? ' 👑' : ''}
          </p>
          {!player.folded && (
            <p className="text-[9px] text-[var(--accent)]/70 font-semibold tabular-nums">
              ${player.total_bet}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card Preview Modal ───

function CardPreviewModal({ name, rarity, png, keywords, communityWords, onClose }: {
  name: string; rarity: string; png: string; keywords: string[];
  communityWords: PokerGameState['community_words'];
  onClose: () => void;
}) {
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

// ─── Action Button ───

function ActionButton({
  icon, label, onClick, disabled, variant,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: 'primary' | 'secondary' | 'danger';
}) {
  const styles = {
    primary: {
      bg: 'linear-gradient(135deg, var(--accent), #ff6b7f)',
      color: '#fff',
      border: 'none',
    },
    secondary: {
      bg: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.7)',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    danger: {
      bg: 'rgba(239,68,68,0.1)',
      color: 'rgba(239,68,68,0.7)',
      border: '1px solid rgba(239,68,68,0.15)',
    },
  };
  const s = styles[variant];

  return (
    <button onClick={onClick} disabled={disabled}
      className="flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer
        disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
      style={{
        background: s.bg,
        color: s.color,
        border: s.border,
        boxShadow: variant === 'primary' ? '0 2px 10px rgba(250,45,72,0.3)' : 'none',
      }}>
      <span className="flex items-center justify-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════
//  SHOWDOWN RESULT — dramatic reveal
// ════════════════════════════════════════════════════════════

function ShowdownResult({
  showdown, pot, communityWords, onPlayAgain,
}: {
  showdown: NonNullable<PokerGameState['showdown']>;
  pot: number;
  communityWords?: PokerGameState['community_words'];
  onPlayAgain: () => void;
}) {
  const humanResult = showdown.results.find(r => r.player_type === 'human');
  const isWin = humanResult?.is_winner;
  const sorted = [...showdown.results].sort((a, b) => b.matches - a.matches);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex-shrink-0 px-5 pb-6 pt-3 overflow-y-auto max-h-[60vh]">
      <div className="max-w-sm mx-auto animate-fade-in">
        {/* Result banner */}
        <div className={`text-center py-5 px-6 rounded-2xl mb-5 relative overflow-hidden`}
          style={{
            background: isWin
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.06))',
            border: `1px solid ${isWin ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.15)'}`,
          }}>
          {/* Particles for win */}
          {isWin && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="absolute w-1.5 h-1.5 rounded-full animate-ping"
                  style={{
                    background: i % 2 === 0 ? 'rgba(16,185,129,0.5)' : 'rgba(250,45,72,0.4)',
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: '1.5s',
                  }} />
              ))}
            </div>
          )}

          <div className={`text-xl font-extrabold mb-1 ${isWin ? 'text-emerald-400' : 'text-white/60'}`}>
            {isWin ? '🏆 胜利！' : '💔 本局惜败'}
          </div>
          <div className="text-sm text-white/50">
            底池 <strong className={`tabular-nums ${isWin ? 'text-emerald-400' : 'text-white/70'}`}>{pot}</strong> IP
            {!isWin && ' · 再接再厉'}
          </div>
        </div>

        {/* All cards — comparison grid */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/40 uppercase tracking-widest">摊牌结果</span>
            <span className="text-[10px] text-white/20">匹配数</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {sorted.map((r, i) => {
              const cfg = rc(r.card_rarity);
              const isHum = r.player_type === 'human';
              return (
                <div key={r.player_id}
                  className={`rounded-xl p-2 text-center transition-all duration-500 ${
                    r.folded ? 'opacity-30' : ''
                  } ${r.is_winner ? 'ring-1' : ''}`}
                  style={{
                    background: r.is_winner
                      ? `linear-gradient(135deg, ${cfg.bg}, transparent)`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${r.is_winner ? cfg.border : 'rgba(255,255,255,0.06)'}`,
                    transform: revealed ? 'scale(1)' : 'scale(0.9)',
                    opacity: revealed ? (r.folded ? 0.3 : 1) : 0,
                    animationDelay: `${i * 100}ms`,
                  }}>
                  {/* Card mini */}
                  <div className="w-full aspect-[3/4] rounded-lg overflow-hidden mb-1.5"
                    style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <img src={cardImageUrl(r.card_png)} alt={r.card_name}
                      className="w-full h-full object-cover" />
                  </div>
                  {!r.folded && (
                    <div className="flex items-center justify-center gap-0.5">
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
