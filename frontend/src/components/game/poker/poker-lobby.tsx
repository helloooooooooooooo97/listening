// ─── Poker Lobby — 无需选卡, 点击开始直接发5张 ───

import { useState } from 'react';
import { HiPlay, HiArrowLeft, HiTrophy } from 'react-icons/hi2';
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
  onStart: () => void;
}

export default function PokerLobby({
  cards, history, canPlay, balance, loading, starting, audioLoadProgress, error, onClearError, onBack, onStart,
}: PokerLobbyProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-10 pb-2">
        <div className="flex items-start justify-between">
          <button onClick={onBack}
            className="flex items-center gap-1 text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer">
            <HiArrowLeft size={14} />
          </button>
        </div>
        <h1 className="text-xl font-bold text-primary mt-2">德州听词</h1>
        <p className="text-sm text-tertiary mt-1">每局随机发 5 张角色牌 · 5 个公共词 · 按牌型比大小</p>
      </div>

      <div className="flex-1 px-6 space-y-6 pb-6">
        {/* Loading */}
        {loading || starting ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner size={28} />
            <div className="text-center">
              <p className="text-sm font-semibold text-primary">
                {starting ? '正在随机发牌...' : '加载牌局'}
              </p>
              {starting && (
                <p className="text-xs text-tertiary mt-1">准备好后再开始，点击会更干脆</p>
              )}
            </div>
            {starting && (
              <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden bg-white/5">
                <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${audioLoadProgress}%` }} />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Rules */}
            <section className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <h2 className="text-xs font-semibold text-tertiary uppercase tracking-widest mb-3">玩法说明</h2>
              <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <li>🎴 你与 3 位 AI 每人随机获得 <strong className="text-primary">5 张角色牌</strong></li>
                <li>📢 每回合揭晓 1 个公共词汇, 共 5 回合</li>
                <li>✨ 每个词命中的卡 = 该词在卡牌 keywords 中</li>
                <li>🃏 5 张卡的命中数组成<strong className="text-primary">牌型</strong> (五福临门→散牌)</li>
                <li>🏆 牌型最大者赢取底池</li>
              </ul>
            </section>

            {/* Card pool info */}
            {cards.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-tertiary uppercase tracking-widest mb-2">
                  你的角色牌 ({cards.length})
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {cards.slice(0, 10).map(c => (
                    <span key={c.id}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                      style={{
                        background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)',
                        color: c.rarity === 'UR' ? '#fbbf24' : c.rarity === 'SSR' ? '#fb923c' : c.rarity === 'SR' ? '#a855f7' : 'var(--text-secondary)',
                      }}>
                      {c.name}
                    </span>
                  ))}
                  {cards.length > 10 && <span className="text-[10px] text-tertiary self-center">+{cards.length - 10}</span>}
                </div>
              </section>
            )}

            {/* Start button */}
            <button onClick={onStart}
              disabled={!canPlay || starting}
              className="relative w-full py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer disabled:cursor-not-allowed"
              style={{
                background: canPlay ? 'linear-gradient(135deg, var(--accent), #ff6b7f)' : 'var(--bg-secondary)',
                color: canPlay ? '#fff' : 'var(--text-tertiary)',
                opacity: canPlay ? 1 : 0.5,
              }}>
              {canPlay ? (
                <span className="flex items-center justify-center gap-2">
                  <HiPlay size={16} />
                  开始对决 · 底注 <strong>10</strong> IP
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  余额不足，需要至少 10 IP
                </span>
              )}
            </button>

            {/* Stats */}
            <div className="flex items-center justify-center gap-6 text-[10px] text-tertiary">
              <span>余额 <strong className="text-primary tabular-nums">{balance}</strong></span>
              <span className="w-px h-3" style={{ background: 'var(--border-primary)' }} />
              <span>底注 <strong>10</strong> IP</span>
              <span className="w-px h-3" style={{ background: 'var(--border-primary)' }} />
              <span className="flex items-center gap-1">
                <HiTrophy size={10} className="text-[var(--accent)]" />
                胜率 <strong className="tabular-nums">
                  {history.length > 0 ? Math.round((history.filter(h => h.is_win).length / history.length) * 100) : 0}%
                </strong>
              </span>
            </div>

            {/* History */}
            {history.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-tertiary uppercase tracking-widest mb-2">最近对局</h2>
                <div className="space-y-1.5">
                  {history.slice(0, 5).map(h => (
                    <div key={h.game_id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${h.is_win ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-primary truncate">{h.human_card || '未知'}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-tertiary">+{h.pot} IP</span>
                        <span className="text-tertiary">{fmtTime(h.completed_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div onClick={onClearError}
            className="px-3 py-2 rounded-xl text-xs cursor-pointer text-center"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--text-secondary)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
