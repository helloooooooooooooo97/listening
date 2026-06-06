import { useEffect, useState } from 'react';
import { HiClock, HiBookOpen, HiPencil, HiBookmark, HiAcademicCap, HiChevronUp, HiChevronDown, HiSpeakerWave } from 'react-icons/hi2';
import { getAudioDetailStats, type AudioDetailStats } from '../lib/api';

interface Props {
  audioId: string;
}

function fmtTime(s: number) {
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  return s % 60 > 0 ? `${m}分${s % 60}秒` : `${m}分钟`;
}

export default function AudioStatsBar({ audioId }: Props) {
  const [stats, setStats] = useState<AudioDetailStats | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAudioDetailStats(audioId)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [audioId]);

  if (loading) return null;
  if (!stats) return null;

  const pct = stats.duration_seconds > 0
    ? Math.round((listeningSeconds / stats.duration_seconds) * 100)
    : 0;
  const progress = Math.min(100, pct);

  return (
    <div className="border-b border-white/[0.04]">
      {/* Toggle header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-6 py-1.5 text-[11px] text-white/25 hover:text-white/50 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <HiSpeakerWave size={12} />
          文章统计
        </span>
        {collapsed ? <HiChevronDown size={12} /> : <HiChevronUp size={12} />}
      </button>

      {!collapsed && (
        <div className="px-6 pb-3 space-y-2.5 animate-fade-in">
          {/* Stats row 1 */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { icon: HiClock, label: '进度', value: `${progress}%`, color: '#f59e0b' },
              { icon: HiClock, label: '已听', value: fmtTime(listeningSeconds), color: '#f59e0b' },
              { icon: HiPencil, label: '听写均分', value: stats.dictation_count > 0 ? `${stats.dictation_avg_score}%` : '--', color: '#8b5cf6' },
              { icon: HiAcademicCap, label: '掌握单词', value: `${stats.known_words}/${stats.total_words}`, color: '#10b981' },
              { icon: HiBookmark, label: '片段', value: `${stats.clips_count}`, color: '#3b82f6' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <s.icon size={10} style={{ color: s.color }} />
                  <span className="text-[9px] text-white/20">{s.label}</span>
                </div>
                <p className="text-xs font-semibold text-white/70">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: progress >= 100
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #fa2d48, #ff6b7f)',
                }}
              />
            </div>
            <span className="text-[10px] text-white/20 w-8 text-right font-mono">{progress}%</span>
          </div>

          {/* Secondary info row */}
          <div className="flex items-center gap-3 text-[10px] text-white/15">
            {stats.dictation_count > 0 && (
              <span>📝 听写 {stats.dictation_count} 次 · {stats.last_practiced?.slice(0, 10) || ''}</span>
            )}
            <span>🔤 {stats.total_sentences} 句</span>
            {stats.completed && <span className="text-emerald-400/50">✅ 已完成</span>}
          </div>
        </div>
      )}
    </div>
  );
}
