import Skeleton from '../Skeleton';
import type { DictationScore } from '../../lib/api';

export default function DictationTrend({ trend, loading }: { trend: DictationScore[]; loading: boolean }) {
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
