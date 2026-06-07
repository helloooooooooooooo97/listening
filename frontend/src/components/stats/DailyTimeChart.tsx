import Skeleton from '../Skeleton';
import type { DailyDay } from '../../lib/api';

interface Props {
  dailyTime: DailyDay[];
  tab: '7d'|'30d';
  setTab: (t: '7d'|'30d') => void;
  loading: boolean;
}

export default function DailyTimeChart({ dailyTime, tab, setTab, loading }: Props) {
  const maxDailySec = Math.max(...dailyTime.map(d=>d.seconds), 1);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-primary">每日听力时长</h2>
        <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
          {(['7d','30d'] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${tab===t ? 'bg-[var(--bg-active)] text-primary' : 'text-tertiary hover:text-secondary'}`}>
              {t==='7d'?'7天':'30天'}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-tertiary)' }}>
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
                  <span className="text-xs text-white/0 group-hover:text-secondary font-mono transition-opacity">{Math.floor(d.seconds)}秒</span>
                  <div className="w-full rounded-t transition-all cursor-pointer hover:opacity-80" style={{
                    flex: `${Math.max(0.01, ratio)}`,
                    background: d.seconds > 0 ? 'linear-gradient(180deg, #fa2d48, rgba(250,45,72,0.3))' : 'var(--bg-tertiary)',
                  }} title={`${Math.floor(d.seconds)}秒`} />
                  <span className="text-xs text-tertiary">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
