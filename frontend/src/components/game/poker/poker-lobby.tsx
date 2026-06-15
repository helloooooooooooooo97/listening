// ─── Poker Lobby — 重新设计：牌桌氛围 · 沉浸感 ───

import { HiPlay, HiArrowLeft, HiTrophy, HiCurrencyDollar } from 'react-icons/hi2';
import { cardImageUrl } from '../../../lib/api';
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

const RARITY_STYLES: Record<string, { ring: string; label: string; glow: string }> = {
  UR: { ring: 'shadow-[0_0_10px_rgba(250,204,21,0.25)]', label: 'text-yellow-300', glow: 'from-yellow-400/10 to-amber-500/5' },
  SSR: { ring: 'shadow-[0_0_10px_rgba(251,146,60,0.25)]', label: 'text-orange-400', glow: 'from-orange-400/10 to-red-500/5' },
  SR: { ring: 'shadow-[0_0_10px_rgba(168,85,247,0.25)]', label: 'text-purple-400', glow: 'from-purple-400/10 to-fuchsia-500/5' },
};

export default function PokerLobby({
  cards, history, canPlay, balance, loading, starting, audioLoadProgress, error, onClearError, onBack, onStart,
}: PokerLobbyProps) {
  const totalGames = history.length;
  const wins = history.filter(h => h.is_win).length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const bg = 'var(--bg-primary)';
  const borderClr = 'var(--border-primary)';
  const textSec = 'var(--text-secondary)';
  const textTer = 'var(--text-tertiary)';
  const accent = 'var(--accent)';

  return (
    <div className="h-full flex flex-col overflow-y-auto"
      style={{ background: bg }}>

      {/* ─── Subtle background texture ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full opacity-[0.02]"
          style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[32rem] h-[32rem] rounded-full opacity-[0.015]"
          style={{ background: `radial-gradient(circle, #22c55e 0%, transparent 70%)` }}
        />
      </div>

      {/* ─── Top bar ─── */}
      <div className="relative z-10 flex-shrink-0 px-5 pt-6 pb-1">
        <button onClick={onBack}
          className="flex items-center gap-1 text-xs cursor-pointer"
          style={{ color: textTer }}
        >
          <HiArrowLeft size={14} />
          返回
        </button>
      </div>

      <div className="relative z-10 flex-1 px-5 pb-6 space-y-5">

        {/* ─── Loading state ─── */}
        {loading || starting ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="relative">
              <Spinner size={32} />
              <div
                className="absolute -inset-4 rounded-full animate-ping opacity-10"
                style={{ border: `2px solid ${accent}` }}
              />
            </div>
            <div className="text-center">
              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {starting ? '正在发牌...' : '加载牌局'}
              </p>
              <p className="text-xs mt-1" style={{ color: textTer }}>
                {starting ? '洗牌中，请稍候' : ''}
              </p>
            </div>
            {starting && (
              <div
                className="w-56 h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${audioLoadProgress}%`, background: 'var(--accent-gradient)' }}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ─── Hero section ─── */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-secondary)',
                border: `1px solid ${borderClr}`,
              }}
            >
              {/* Decorative diamond pattern */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.3) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
              <div className="relative p-5 flex flex-col items-center text-center">
                {/* Title */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🃏</span>
                  <h1 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                    德州听词
                  </h1>
                </div>
                <p className="text-xs mb-5" style={{ color: textTer }}>
                  听词比牌 · 智者为王
                </p>

                {/* Start button */}
                <button
                  onClick={onStart}
                  disabled={!canPlay}
                  className="relative w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    background: canPlay ? 'var(--accent-gradient)' : 'var(--bg-tertiary)',
                    color: canPlay ? '#fff' : textTer,
                    opacity: canPlay ? 1 : 0.6,
                    boxShadow: canPlay ? `0 4px 20px color-mix(in srgb, ${accent} 35%, transparent)` : 'none',
                  }}
                >
                  {canPlay ? (
                    <span className="flex items-center justify-center gap-2">
                      <HiPlay size={16} />
                      开始对决 · 底注 <strong>10</strong> IP
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <HiCurrencyDollar size={14} />
                      余额不足，需要至少 10 IP
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ─── Stats row ─── */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  icon: HiCurrencyDollar,
                  label: '余额',
                  value: balance,
                  accentColor: '#22c55e',
                },
                {
                  icon: HiTrophy,
                  label: '胜率',
                  value: `${winRate}%`,
                  accentColor: '#fbbf24',
                },
                {
                  icon: HiPlay,
                  label: '对局',
                  value: totalGames,
                  accentColor: '#60a5fa',
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3 text-center transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${borderClr}`,
                  }}
                >
                  <stat.icon size={16} style={{ color: stat.accentColor }} className="mx-auto mb-1.5" />
                  <p className="text-[10px] mb-0.5" style={{ color: textTer }}>
                    {stat.label}
                  </p>
                  <p className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* ─── Rules ─── */}
            <div
              className="rounded-xl p-4"
              style={{
                background: 'var(--bg-secondary)',
                border: `1px solid ${borderClr}`,
              }}
            >
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: textTer }}>
                玩法说明
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: '🎴', text: '你与 AI 各获 5 张角色牌' },
                  { icon: '📢', text: '每回合揭晓 1 个公共词汇' },
                  { icon: '✨', text: '词汇命中关键词即计 1 点' },
                  { icon: '🏆', text: '牌型大者赢取底池' },
                ].map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs" style={{ color: textSec }}>
                    <span className="text-sm flex-shrink-0">{r.icon}</span>
                    <span>{r.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Card pool ─── */}
            {cards.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-xs font-semibold" style={{ color: textSec }}>
                    角色卡池
                  </h2>
                  <span className="text-[10px]" style={{ color: textTer }}>
                    {cards.length} 张
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {cards.slice(0, 12).map((c) => {
                    const rs = RARITY_STYLES[c.rarity] || {
                      ring: '',
                      label: '',
                      glow: 'from-gray-500/10 to-gray-600/5',
                    };
                    return (
                      <div
                        key={c.id}
                        className={`group relative rounded-lg p-2.5 flex flex-col items-center gap-1 transition-all duration-200 hover:-translate-y-1 cursor-default ${rs.ring}`}
                        style={{
                          background: `linear-gradient(180deg, var(--bg-tertiary) 0%, rgba(255,255,255,0.01) 100%)`,
                          border: `1px solid ${borderClr}`,
                        }}
                      >
                        {c.png ? (
                          <img
                            src={cardImageUrl(c.png)}
                            alt={c.name}
                            className="w-8 h-8 object-contain drop-shadow-lg"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ background: borderClr }}>
                            🃏
                          </div>
                        )}
                        <span className="text-[9px] font-medium truncate w-full text-center leading-tight" style={{ color: 'var(--text-primary)' }}>
                          {c.name}
                        </span>
                        <span className={`text-[8px] font-bold opacity-80 ${rs.label}`}>
                          {c.rarity}
                        </span>
                      </div>
                    );
                  })}
                  {cards.length > 12 && (
                    <div
                      className="rounded-lg p-2.5 flex items-center justify-center"
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: `1px dashed ${borderClr}`,
                      }}
                    >
                      <span className="text-[10px]" style={{ color: textTer }}>
                        +{cards.length - 12}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── History ─── */}
            {history.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold mb-2.5" style={{ color: textSec }}>
                  最近对局
                </h2>
                <div className="space-y-1.5">
                  {history.slice(0, 5).map((h) => (
                    <div
                      key={h.game_id}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: `1px solid ${borderClr}`,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background: h.is_win ? '#34d399' : '#f87171',
                            boxShadow: h.is_win ? '0 0 6px rgba(52,211,153,0.5)' : 'none',
                          }}
                        />
                        <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                          {h.human_card || '未知'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className="text-xs font-medium"
                          style={{ color: h.is_win ? '#34d399' : '#f87171' }}
                        >
                          {h.is_win ? '+' : ''}{h.pot} IP
                        </span>
                        <span className="text-[10px]" style={{ color: textTer }}>
                          {fmtTime(h.completed_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Error toast ─── */}
        {error && (
          <div
            onClick={onClearError}
            className="px-3.5 py-2.5 rounded-xl text-xs cursor-pointer text-center"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: textSec,
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
