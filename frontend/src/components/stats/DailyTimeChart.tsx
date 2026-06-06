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
