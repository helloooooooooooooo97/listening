import { useEffect, useState } from 'react';
import { HiClock, HiPencil, HiBookmark, HiAcademicCap } from 'react-icons/hi2';
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
    ? Math.round((stats.listening_seconds / stats.duration_seconds) * 100)
    : 0;
  const progress = Math.min(100, pct);

  return (
    <div className="px-6 py-4 space-y-3">
      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '进度', value: `${progress}%`, icon: HiClock, color: '#f59e0b' },
          { label: '已听', value: fmtTime(stats.listening_seconds), icon: HiClock, color: '#f59e0b' },
          { label: '听写', value: stats.dictation_count > 0 ? `${stats.dictation_avg_score}%` : '--', icon: HiPencil, color: '#8b5cf6' },
          { label: '掌握词', value: `${stats.known_words}/${stats.total_words}`, icon: HiAcademicCap, color: '#10b981' },
          { label: '片段', value: `${stats.clips_count}`, icon: HiBookmark, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}15` }}>
              <s.icon size={12} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary">{s.value}</p>
              <p className="text-xs text-tertiary">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-[var(--bg-hover)] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{
            width: `${progress}%`,
            background: progress >= 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #fa2d48, #ff6b7f)',
          }}/>
        </div>
        <span className="text-xs text-tertiary w-8 text-right font-mono">{progress}%</span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-tertiary">
        <span>🔤 {stats.total_sentences} 句 · {stats.total_words} 词</span>
        {stats.dictation_count > 0 && <span>📝 听写 {stats.dictation_count} 次</span>}
        {stats.completed && <span className="text-emerald-500">✓ 已完成</span>}
        {stats.last_practiced && <span>最近 {stats.last_practiced.slice(0, 10)}</span>}
      </div>
    </div>
  );
}
