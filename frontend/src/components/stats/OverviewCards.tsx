import { HiClock, HiBookOpen, HiPencil, HiBookmark, HiAcademicCap, HiArrowTrendingUp, HiArrowTrendingDown } from 'react-icons/hi2';
import Skeleton from '../Skeleton';
import type { Overview } from '../../lib/api';

export default function OverviewCards({ overview }: { overview: Overview | null }) {
  const totalSec = overview ? Math.floor(overview.total_listening_seconds) : 0;
  const todaySec = overview ? Math.floor(overview.today_seconds) : 0;
  const yesterdaySec = overview ? Math.floor(overview.yesterday_seconds) : 0;
  const dayDiff = overview && yesterdaySec > 0 ? Math.round(((todaySec - yesterdaySec) / yesterdaySec) * 100) : null;

  const cards = [
    { label: '总时长', value: overview ? `${totalSec}秒` : null, sub: overview ? `今日 ${todaySec}秒` : null, icon: HiClock, color: '#f59e0b',
      change: dayDiff !== null ? (dayDiff >= 0 ? `+${dayDiff}%` : `${dayDiff}%`) : null, up: dayDiff !== null && dayDiff >= 0 },
    { label: '完成音频', value: overview ? `${overview.completed_audios}/${overview.total_audios}` : null, sub: '已完成', icon: HiBookOpen, color: '#fa2d48', change: null, up: false },
    { label: '听写均分', value: overview ? `${overview.avg_dictation_score}%` : null, sub: overview ? `${overview.dictation_total_sentences} 句` : null, icon: HiPencil, color: '#8b5cf6', change: null, up: false },
    { label: '掌握单词', value: overview?.words_mastered ?? null, sub: overview ? `/${overview.total_words}` : null, icon: HiAcademicCap, color: '#10b981', change: null, up: false },
    { label: '连续天数', value: overview?.streak_days ?? null, sub: '天', icon: HiBookmark, color: '#3b82f6', change: null, up: false },
  ] as const;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map(s => (
        <div key={s.label} className="rounded-xl p-5" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20` }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            {s.change && (
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${s.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {s.up ? <HiArrowTrendingUp size={12}/> : <HiArrowTrendingDown size={12}/>}
                {s.change}
              </span>
            )}
          </div>
          {s.value !== null ? (
            <p className="text-2xl font-bold text-primary tracking-tight">{s.value}</p>
          ) : (
            <Skeleton className="h-7 w-16" />
          )}
          {s.sub !== null ? (
            <p className="text-xs text-tertiary mt-1">{s.sub}</p>
          ) : (
            <Skeleton className="h-3 w-12 mt-2" />
          )}
        </div>
      ))}
    </div>
  );
}
