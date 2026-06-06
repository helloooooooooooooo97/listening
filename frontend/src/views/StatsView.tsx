import { useState, useEffect } from 'react';
import { HiClock, HiBookOpen, HiPencil, HiBookmark, HiAcademicCap, HiArrowTrendingUp, HiArrowTrendingDown } from 'react-icons/hi2';

interface Overview {
  total_listening_seconds: number;
  completed_audios: number;
  total_audios: number;
  avg_dictation_score: number;
  dictation_total_sentences: number;
  words_mastered: number;
  total_words: number;
  clips_count: number;
  streak_days: number;
  today_seconds: number;
  yesterday_seconds: number;
}

interface DailyDay { date: string; seconds: number; }
interface DictationScore { date: string; audio: string; score: number; }
interface AudioProgress { id: string; title: string; completed: boolean; last_position: number; total_seconds: number; dictation_score: number | null; }
interface Activity { type: string; time: string; detail: string; }

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.04] rounded-lg ${className}`} />;
}

function OverviewCards({ overview }: { overview: Overview | null }) {
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
        <div key={s.label} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20` }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            {s.change && (
              <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${s.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {s.up ? <HiArrowTrendingUp size={12}/> : <HiArrowTrendingDown size={12}/>}
                {s.change}
              </span>
            )}
          </div>
          {s.value !== null ? (
            <p className="text-2xl font-bold text-white tracking-tight">{s.value}</p>
          ) : (
            <Skeleton className="h-7 w-16" />
          )}
          {s.sub !== null ? (
            <p className="text-[11px] text-white/30 mt-1">{s.sub}</p>
          ) : (
            <Skeleton className="h-3 w-12 mt-2" />
          )}
        </div>
      ))}
    </div>
  );
}

function DailyTimeChart({ dailyTime, tab, setTab, loading }: {
  dailyTime: DailyDay[]; tab: '7d'|'30d'; setTab: (t:'7d'|'30d') => void; loading: boolean;
}) {
  const maxDailySec = Math.max(...dailyTime.map(d=>d.seconds), 1);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">每日听力时长</h2>
        <div className="flex bg-white/[0.04] rounded-lg p-0.5">
          {(['7d','30d'] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${tab===t ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/60'}`}>
              {t==='7d'?'7天':'30天'}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {loading ? (
          <div className="flex items-end gap-1 md:gap-2 h-36">
            {Array.from({length: tab==='7d'?7:30}).map((_,i) => (
              <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1.5 h-full">
                <Skeleton className="w-full flex-1" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-end gap-1 md:gap-2 h-36">
            {dailyTime.map((d, i) => {
              const ratio = maxDailySec > 0 ? d.seconds / maxDailySec : 0;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1.5 group h-full">
                  <span className="text-[10px] text-white/0 group-hover:text-white/40 font-mono transition-opacity">{Math.floor(d.seconds)}秒</span>
                  <div className="w-full rounded-t transition-all cursor-pointer hover:opacity-80" style={{
                    flex: `${Math.max(0.01, ratio)}`,
                    background: d.seconds > 0 ? 'linear-gradient(180deg, #fa2d48, rgba(250,45,72,0.3))' : 'rgba(255,255,255,0.04)',
                  }} title={`${Math.floor(d.seconds)}秒`} />
                  <span className="text-[9px] text-white/20">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DictationTrend({ trend, loading }: { trend: DictationScore[]; loading: boolean }) {
  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-bold text-white mb-4">听写趋势</h2>
        <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }
  if (trend.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">听写趋势</h2>
      <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex items-end gap-1 h-28">
          {trend.map((s, i) => {
            const ratio = s.score / 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
                <span className="text-[10px] text-white/0 group-hover:text-white/40 font-mono transition-opacity">{s.score}%</span>
                <div className="w-full rounded-t transition-all cursor-pointer hover:opacity-80" style={{
                  flex: `${Math.max(0.01, ratio)}`,
                  background: s.score >= 80 ? 'linear-gradient(180deg, #10b981, rgba(16,185,129,0.3))' : s.score >= 50 ? 'linear-gradient(180deg, #f59e0b, rgba(245,158,11,0.3))' : 'linear-gradient(180deg, #ef4444, rgba(239,68,68,0.3))',
                }} title={`${s.audio}: ${s.score}%`} />
                <span className="text-[8px] text-white/15 truncate w-full text-center">{s.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AudioProgressList({ audioProgress, loading }: { audioProgress: AudioProgress[]; loading: boolean }) {
  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-bold text-white mb-4">音频进度</h2>
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      </div>
    );
  }
  if (audioProgress.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">音频进度</h2>
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {audioProgress.slice(0, 6).map(l => (
          <div key={l.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/70 truncate">{l.title}</p>
              <div className="mt-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${l.completed ? 100 : Math.min(100, (l.total_seconds / 300) * 100)}%`,
                  background: l.completed ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }} />
              </div>
            </div>
            <span className="text-[11px] text-white/30 w-12 text-right">
              {l.completed ? (l.dictation_score ? `${l.dictation_score}%` : '✓') : `${Math.floor(l.total_seconds)}秒`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTimeline({ activities, loading }: { activities: Activity[]; loading: boolean }) {
  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-bold text-white mb-4">最近活动</h2>
        <div className="space-y-1">
          {Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>
    );
  }
  if (activities.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">最近活动</h2>
      <div className="space-y-1">
        {activities.slice(0, 10).map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              a.type==='play'?'bg-blue-400':a.type==='dictation'?'bg-[#fa2d48]':a.type==='clip'?'bg-emerald-400':'bg-amber-400'
            }`} />
            <span className="text-[12px] text-white/50 flex-1 truncate">{a.detail}</span>
            <span className="text-[10px] text-white/20">{a.time?.slice(11,16)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsView() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [dailyTime, setDailyTime] = useState<DailyDay[]>([]);
  const [trend, setTrend] = useState<DictationScore[]>([]);
  const [audioProgress, setAudioProgress] = useState<AudioProgress[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tab, setTab] = useState<'7d'|'30d'>('7d');

  // Each data source loads independently
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats/overview').then(r=>r.json()).then(setOverview).finally(()=>setOverviewLoading(false));
    fetch('/api/stats/dictation-trend?limit=20').then(r=>r.json()).then(d=>setTrend(d.scores)).finally(()=>setTrendLoading(false));
    fetch('/api/stats/audio-progress').then(r=>r.json()).then(d=>setAudioProgress(d.audios)).finally(()=>setProgressLoading(false));
    fetch('/api/stats/recent-activity?limit=15').then(r=>r.json()).then(d=>setActivities(d.activities)).finally(()=>setActivityLoading(false));
  }, []);

  useEffect(() => {
    setDailyLoading(true);
    fetch(`/api/stats/daily-time?days=${tab==='7d'?7:30}`).then(r=>r.json()).then(d=>setDailyTime(d.days)).finally(()=>setDailyLoading(false));
  }, [tab]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">学习统计</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
        {/* Overview cards — always render immediately */}
        <OverviewCards overview={overviewLoading ? null : overview} />

        {/* Daily time chart */}
        <DailyTimeChart dailyTime={dailyTime} tab={tab} setTab={setTab} loading={dailyLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <DictationTrend trend={trend} loading={trendLoading} />
          <AudioProgressList audioProgress={audioProgress} loading={progressLoading} />
        </div>

        <ActivityTimeline activities={activities} loading={activityLoading} />
      </div>
    </div>
  );
}
