import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCubeTransparent, HiArrowLeft, HiCheck, HiXMark, HiSpeakerWave, HiTrophy, HiInformationCircle, HiSparkles } from 'react-icons/hi2';
import { usePokerStore } from '../stores/pokerStore';
import { cardImageUrl } from '../lib/api';
import type { PokerGameState } from '../lib/api';
import { useCurrencyStore } from '../stores/currencyStore';

const RARITY_LABEL: Record<string, string> = { R: 'R', SR: 'SR', SSR: 'SSR', UR: 'UR' };
const RARITY_COLORS: Record<string, string> = { R: '#3b82f6', SR: '#a855f7', SSR: '#fb923c', UR: '#fbbf24' };

function fmtTime(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function PokerGameView() {
  const store = usePokerStore();
  const navigate = useNavigate();
  const loadBalance = useCurrencyStore(s => s.loadBalance);
  const { lobbyMode, loading, game, cards, history, canPlay, balance, selectedBet, betting } = store;

  useEffect(() => {
    store.loadLobby();
  }, []);

  // Reload balance after game ends
  useEffect(() => {
    if (game?.status === 'completed') {
      loadBalance();
    }
  }, [game?.status]);

  if (lobbyMode === 'lobby') {
    return <PokerLobby
      cards={cards}
      history={history}
      canPlay={canPlay}
      balance={balance}
      loading={loading}
      onStart={store.startGame}
      onBack={() => navigate(-1)}
    />;
  }

  if (!game) return null;

  return <PokerTableView
    game={game}
    selectedBet={selectedBet}
    betting={betting}
    onSetBet={store.setSelectedBet}
    onAction={store.doAction}
    onRefresh={store.refreshGame}
    onBack={() => { store.backToLobby(); store.loadLobby(); }}
    humanPlayerId={store.game?.human_player_id}
  />;
}

// ── Lobby ──

function PokerLobby({ cards, history, canPlay, balance, loading, onStart, onBack }: {
  cards: { id: string; name: string; rarity: string; png: string; keywords: string[] }[];
  history: { game_id: number; pot: number; human_card: string | null; is_win: boolean; completed_at: number }[];
  canPlay: boolean;
  balance: number;
  loading: boolean;
  onStart: (cardId: string) => void;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto">
      <div className="flex-shrink-0 px-6 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="text-tertiary hover:text-secondary cursor-pointer p-1">
            <HiArrowLeft size={18} />
          </button>
          <HiCubeTransparent size={20} className="text-[var(--accent)]" />
          <h1 className="text-xl font-extrabold text-primary">词牌对决</h1>
        </div>
        <p className="text-xs text-tertiary">德州扑克式词汇对决 · 选一张角色牌与 3 名 AI 对战</p>
      </div>

      <div className="flex-1 px-6 pb-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Card selection */}
            <div>
              <h2 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-3">选择你的角色牌</h2>
              {cards.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-[var(--border-secondary)]">
                  <p className="text-xs text-tertiary">还没有收藏卡牌，先去抽卡吧！</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {cards.map(card => (
                    <button key={card.id} onClick={() => setSelectedId(card.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer text-left
                        ${selectedId === card.id
                          ? 'border-[var(--accent)] shadow-lg shadow-[var(--accent)]/20 scale-[1.02]'
                          : 'border-[var(--border-primary)] hover:border-[var(--accent)]/30'
                        }`}
                      style={{ background: 'var(--bg-secondary)' }}>
                      <div className="aspect-[3/4] relative">
                        <img src={cardImageUrl(card.png)} alt={card.name}
                          className="w-full h-full object-cover" />
                        <div className="absolute top-1.5 right-1.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                            style={{
                              background: (RARITY_COLORS[card.rarity] || '#6b7280') + '30',
                              color: RARITY_COLORS[card.rarity] || '#6b7280',
                            }}>
                            {RARITY_LABEL[card.rarity] || card.rarity}
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-1.5"
                          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                          <p className="text-[10px] font-semibold text-white truncate">{card.name}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Start button */}
            <button onClick={() => selectedId && onStart(selectedId)}
              disabled={!selectedId || !canPlay}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all cursor-pointer
                ${selectedId && canPlay
                  ? 'bg-[var(--accent)] on-accent hover:opacity-90 active:scale-[0.98]'
                  : 'bg-[var(--bg-secondary)] text-tertiary opacity-50 cursor-not-allowed'
                }`}>
              {!canPlay ? '✨ 余额不足，需要至少 10 IP' : selectedId ? '🎴 开始对决 · 底注 10 IP' : '请选择一张角色牌'}
            </button>

            {/* Balance info */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-tertiary">
              <span>余额: <strong className="text-primary tabular-nums">{balance}</strong> ✨</span>
              <span>· 底注: <strong>10</strong> IP</span>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-3">最近对局</h2>
                <div className="space-y-1">
                  {history.slice(0, 5).map(h => (
                    <div key={h.game_id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                      style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="flex items-center gap-2">
                        <span className={h.is_win ? 'text-emerald-400' : 'text-[var(--accent)]'}>
                          {h.is_win ? '🏆 胜' : '💔 负'}
                        </span>
                        <span className="text-tertiary">{h.human_card || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-tertiary">
                        <span>底池 {h.pot} IP</span>
                        <span>{h.completed_at ? fmtTime(h.completed_at) : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rules */}
            <details className="text-xs text-tertiary">
              <summary className="cursor-pointer hover:text-secondary font-medium">📖 游戏规则</summary>
              <div className="mt-2 space-y-1 pl-2 leading-relaxed">
                <p>• 每局 4 人（你 + 3 AI），每人底注 10 IP</p>
                <p>• 你选一张角色牌，AI 各分配一张（隐藏）</p>
                <p>• 场上有 5 张单词牌，每轮翻开 1 张</p>
                <p>• 每轮你可以：过牌 ✓ / 下注 ✨ / 弃牌 ✗</p>
                <p>• 你的角色 keywords 匹配的单词越多，牌力越强</p>
                <p>• 第 5 轮后摊牌，匹配最多者赢全池</p>
                <p>• AI 也匹配关键词，但你看不到他们的牌</p>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

// ── Game Table ──

function PokerTableView({ game, selectedBet, betting, onSetBet, onAction, onRefresh, onBack, humanPlayerId }: {
  game: PokerGameState;
  selectedBet: number;
  betting: boolean;
  onSetBet: (amount: number) => void;
  onAction: (action: string, amount?: number) => void;
  onRefresh: () => void;
  onBack: () => void;
  humanPlayerId?: number | null;
}) {
  const isCompleted = game.status === 'completed';
  const human = game.players.find(p => p.player_type === 'human');
  const humanKeywords = human?.keywords || [];
  const [polling, setPolling] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto">
      {/* Compact header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 pt-8 pb-2">
        <button onClick={onBack} className="text-tertiary hover:text-secondary cursor-pointer p-1">
          <HiArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-tertiary">第 <strong className="text-primary">{game.round}</strong>/5 轮</span>
          <span className="font-bold text-[var(--accent)]">🏆 <span className="tabular-nums">{game.pot}</span></span>
        </div>
        <div className="w-6" /> {/* spacer */}
      </div>

      {/* Community words — compact chips */}
      <div className="flex-shrink-0 px-5 py-3">
        <div className="flex justify-center gap-1.5">
          {game.community_words.map((cw, i) => (
            <div key={i}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all
                ${cw.revealed
                  ? 'border-[var(--accent)]/25 bg-[var(--bg-secondary)] text-primary'
                  : 'border-[var(--border-secondary)] text-tertiary/30'
                }`}>
              {cw.revealed ? (
                <span className="flex items-center gap-1">
                  {cw.word}
                  <button onClick={(e) => { e.stopPropagation(); speechSynthesis.speak(new SpeechSynthesisUtterance(cw.word!)); }}
                    className="text-tertiary hover:text-secondary">
                    <HiSpeakerWave size={9} />
                  </button>
                </span>
              ) : '?'}
            </div>
          ))}
        </div>
      </div>

      {/* Player area — 2×2 grid, poker table feel */}
      <div className="flex-1 flex items-center justify-center px-5 pb-2">
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          {game.players.map(p => {
            const isHuman = p.player_type === 'human';
            const imgUrl = isHuman && p.card_name
              ? cardImageUrl(p.card_name.toLowerCase().replace(/\s+/g, '_'))
              : null;
            const kw = isHuman ? humanKeywords : [];
            const matchedCount = kw.filter(k => game.community_words.some(cw => cw.revealed && cw.word === k)).length;
            return (
              <div key={p.id}
                className={`rounded-xl p-3 text-center transition-all ${p.folded ? 'opacity-35' : ''} ${p.is_winner ? 'ring-2 ring-[var(--accent)]/40' : ''}`}
                style={{ background: p.is_winner ? 'var(--bg-tertiary)' : 'var(--bg-secondary)' }}>
                {/* Card image */}
                <div className="w-14 h-[76px] mx-auto rounded-lg overflow-hidden mb-1.5 border border-white/5"
                  style={{ background: 'var(--bg-primary)' }}>
                  {imgUrl ? (
                    <img src={imgUrl} alt={p.card_name!} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">🂠</div>
                  )}
                </div>
                <p className="text-[10px] font-bold text-primary truncate">
                  {isHuman ? '你' : `AI-${p.id}`}
                  {p.is_winner && ' 👑'}
                </p>
                <p className="text-[8px] text-tertiary">
                  {p.folded ? '弃牌' : isHuman && matchedCount > 0 ? `✓${matchedCount}` : `$${p.total_bet}`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Matched keywords inline — only show when relevant */}
      {!isCompleted && humanKeywords.length > 0 && (
        <div className="flex-shrink-0 px-5 pb-1">
          <div className="flex flex-wrap justify-center gap-1 max-w-xs mx-auto">
            {humanKeywords.slice(0, 6).map(kw => {
              const matched = game.community_words.some(cw => cw.revealed && cw.word === kw);
              return (
                <span key={kw}
                  className={`text-[8px] px-1.5 py-0.5 rounded transition-all ${matched ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : 'text-tertiary/40'}`}>
                  {matched ? '✓ ' : ''}{kw}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Betting controls */}
      {!isCompleted && game.phase === 'betting' && game.can_act && (
        <div className="flex-shrink-0 px-5 py-3 border-t border-white/5">
          <div className="max-w-xs mx-auto space-y-2.5">
            {/* Bet slider */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-tertiary w-6 text-right">5</span>
              <input type="range" min={5} max={50} step={5}
                value={selectedBet} disabled={betting}
                onChange={e => onSetBet(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)] h-1" />
              <span className="text-[9px] text-tertiary w-6">50</span>
              <span className="text-xs font-bold text-primary tabular-nums w-8 text-right">{selectedBet}</span>
            </div>

            {/* Action buttons — 3 compact buttons */}
            <div className="flex gap-2">
              <button onClick={() => onAction('check')} disabled={betting}
                className="flex-1 py-2 rounded-lg text-[10px] font-semibold border cursor-pointer
                  hover:bg-white/5 disabled:opacity-30 transition-all"
                style={{ borderColor: 'var(--border-primary)' }}>
                <HiCheck size={12} className="inline mr-0.5" />过牌
              </button>
              <button onClick={() => onAction('bet', selectedBet)} disabled={betting}
                className="flex-1 py-2 rounded-lg text-[10px] font-semibold cursor-pointer
                  bg-[var(--accent)] on-accent hover:opacity-90 disabled:opacity-30 transition-all">
                <HiSparkles size={12} className="inline mr-0.5" />{selectedBet}
              </button>
              <button onClick={() => onAction('fold')} disabled={betting}
                className="flex-1 py-2 rounded-lg text-[10px] font-semibold cursor-pointer
                  bg-[var(--bg-secondary)] text-tertiary hover:text-[var(--accent)] disabled:opacity-30 transition-all">
                <HiXMark size={12} className="inline mr-0.5" />弃牌
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting state */}
      {!isCompleted && game.phase === 'betting' && !game.can_act && (
        <div className="flex-shrink-0 px-5 py-4 text-center border-t border-white/5">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2.5 h-2.5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
            <span className="text-[10px] text-tertiary">等待 AI...</span>
          </div>
        </div>
      )}

      {/* Showdown result */}
      {isCompleted && game.showdown && (
        <ShowdownResult showdown={game.showdown} pot={game.pot}
          onPlayAgain={() => { onBack(); }}
          communityWords={game.community_words}
        />
      )}

      {/* All fold — simple win screen */}
      {isCompleted && !game.showdown && (
        <div className="flex-1 flex items-center justify-center px-5 pb-6">
          <div className="text-center">
            <HiTrophy size={36} className="mx-auto text-[var(--accent)] mb-2" />
            <h2 className="text-base font-bold text-primary mb-1">🎉 AI 全弃牌！</h2>
            <p className="text-xs text-tertiary mb-4">赢得 <strong className="text-[var(--accent)]">{game.pot}</strong> IP</p>
            <button onClick={() => { onBack(); }}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
              再来一局
            </button>
          </div>
        </div>
      )}

      {/* Waiting for showdown */}
      {game.phase === 'showdown' && !isCompleted && (
        <div className="flex-1 flex items-center justify-center px-5 pb-6">
          <div className="text-center">
            <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[10px] text-tertiary">摊牌中...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Showdown ──

function ShowdownResult({ showdown, pot, onPlayAgain, communityWords }: {
  showdown: NonNullable<PokerGameState['showdown']>;
  pot: number;
  onPlayAgain: () => void;
  communityWords?: PokerGameState['community_words'];
}) {
  const humanResult = showdown.results.find(r => r.player_type === 'human');
  const isWin = humanResult?.is_winner;

  return (
    <div className="flex-1 px-5 pb-6 overflow-y-auto">
      <div className="max-w-sm mx-auto space-y-4">

        {/* Win/loss banner */}
        <div className={`text-center py-4 px-4 rounded-xl ${isWin ? 'bg-emerald-500/10' : 'bg-red-500/5'}`}>
          <p className={`text-lg font-bold ${isWin ? 'text-emerald-400' : 'text-tertiary'}`}>
            {isWin ? '🎉 你赢了！' : '💔 输了'}
          </p>
          <p className="text-xs text-tertiary mt-0.5">底池 <strong className="tabular-nums">{pot}</strong> IP{isWin ? ' 已入账' : ''}</p>
        </div>

        {/* All players — compact grid */}
        <div className="grid grid-cols-4 gap-2">
          {showdown.results.map(r => {
            const imgUrl = r.card_png ? cardImageUrl(r.card_png) : null;
            return (
              <div key={r.player_id}
                className={`rounded-lg p-2 text-center transition-all ${r.folded ? 'opacity-40' : ''} ${r.is_winner ? 'ring-1 ring-emerald-500/40' : ''}`}
                style={{ background: r.is_winner ? 'var(--bg-tertiary)' : 'var(--bg-secondary)' }}>
                {/* Card image */}
                <div className="w-full aspect-[3/4] rounded-md overflow-hidden mb-1 border border-white/5"
                  style={{ background: 'var(--bg-primary)' }}>
                  {imgUrl ? (
                    <img src={imgUrl} alt={r.card_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-base">🂠</div>
                  )}
                </div>
                <p className="text-[8px] font-bold text-primary truncate">
                  {r.player_type === 'human' ? '你' : ''}
                  {r.is_winner ? ' 👑' : ''}
                </p>
                <p className="text-[7px] text-tertiary truncate">{r.card_name}</p>
                <p className="text-[9px] font-bold tabular-nums mt-0.5">{r.matches}<span className="text-[7px] text-tertiary font-normal">/5</span></p>
              </div>
            );
          })}
        </div>

        {/* Community words — tiny recap */}
        <details className="text-[9px] text-tertiary/60 text-center">
          <summary className="cursor-pointer hover:text-secondary">公共词</summary>
          <div className="mt-1.5 flex justify-center flex-wrap gap-1">
            {communityWords?.map((cw, i) => (
              <span key={i}
                className={`text-[8px] px-1.5 py-0.5 rounded ${cw.revealed ? 'bg-white/10 text-tertiary' : 'bg-white/5 text-tertiary/30'}`}>
                {cw.revealed ? cw.word : `?`}
              </span>
            ))}
          </div>
        </details>

        <button onClick={onPlayAgain}
          className="w-full py-2.5 rounded-lg text-xs font-bold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
          再来一局
        </button>
      </div>
    </div>
  );
}
