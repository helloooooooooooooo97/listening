// ─── Poker Lobby — card selection, game history, and rules ───

import { useState } from 'react';
import {
  HiCheck, HiStar, HiPlay, HiTrophy, HiArrowLeft,
  HiInformationCircle, HiChevronDown, HiXMark,
} from 'react-icons/hi2';
import { cardImageUrl } from '../../../lib/api';
import { rarity as rc } from '../../../constants/rarity';
import Spinner from '../../ui/Spinner';

function fmtTime(ts: number) {
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface PokerLobbyProps {
  cards: { id: string; name: string; rarity: string; png: string; keywords: string[] }[];
  history: { game_id: number; pot: number; human_card: string | null; is_win: boolean; completed_at: number }[];
  canPlay: boolean;
  balance: number;
  loading: boolean;
  starting: boolean;
  audioLoadProgress: number;
  error: string | null;
  onClearError: () => void;
  onBack: () => void;
  onStart: (cardId: string) => void;
  onStartV2?: () => void;
}

export default function PokerLobby({
  cards, history, canPlay, balance, loading, starting, audioLoadProgress, error, onClearError, onBack, onStart, onStartV2,
}: PokerLobbyProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-10 pb-2">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
            <HiArrowLeft size={18} />
          </button>
        </div>
        {error && (
          <div className="mb-3 px-4 py-2 rounded-xl text-xs flex items-center justify-between gap-2"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--text-secondary)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span>{error}</span>
            <button onClick={onClearError} className="text-tertiary hover:text-secondary cursor-pointer">
              <HiXMark size={14} />
            </button>
          </div>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-primary tracking-tight">🃏 德州听词</h1>
            <p className="text-xs text-tertiary mt-1 max-w-sm">
              德州扑克式词汇对决 · 选一张角色牌，与 3 名 AI 对战，匹配公共词赢取底池
            </p>
          </div>
          {/* Balance chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 mt-1"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            <HiStar size={13} className="text-[var(--accent)]" />
            <span className="tabular-nums">{balance}</span>
            <span className="text-tertiary font-normal">IP</span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-6 pb-8 space-y-6">

        {loading || starting ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Spinner size={40} />
            <div className="text-center">
              <p className="text-sm font-semibold text-primary">
                {starting ? '正在缓冲本局音频' : '加载牌局'}
              </p>
              <p className="text-xs text-tertiary mt-1">
                {starting ? '准备好后再开始，点击会更干脆' : '正在同步牌桌状态'}
              </p>
            </div>
            {starting && (
              <div className="w-full max-w-xs">
                <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${audioLoadProgress}%` }}
                  />
                </div>
                <span className="block mt-2 text-center text-[11px] tabular-nums text-tertiary">{audioLoadProgress}%</span>
              </div>
            )}
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
              disabled={!selectedId || !canPlay || starting}
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

            {/* ── v2 play button ── */}
            {onStartV2 && (
              <button onClick={onStartV2}
                disabled={!canPlay || starting}
                className="relative w-full py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 overflow-hidden cursor-pointer disabled:cursor-not-allowed mt-2"
                style={{
                  background: canPlay ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'var(--bg-secondary)',
                  color: canPlay ? '#fff' : 'var(--text-tertiary)',
                  opacity: canPlay ? 1 : 0.5,
                }}>
                <span className="flex items-center justify-center gap-2">
                  🎲 新玩法: 每人5张卡 · 比牌型 · 每回合 5 IP
                </span>
              </button>
            )}

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
