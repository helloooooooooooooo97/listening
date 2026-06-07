import Skeleton from '../Skeleton';
import type { Activity } from '../../lib/api';

export default function ActivityTimeline({ activities, loading }: { activities: Activity[]; loading: boolean }) {
  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">最近活动</h2>
        <div className="space-y-1">
          {Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </div>
    );
  }
  if (activities.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-bold text-primary mb-4">最近活动</h2>
      <div className="space-y-1">
        {activities.slice(0, 10).map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              a.type==='play'?'bg-blue-400':a.type==='dictation'?'bg-[#fa2d48]':a.type==='clip'?'bg-emerald-400':'bg-amber-400'
            }`} />
            <span className="text-xs text-secondary flex-1 truncate">{a.detail}</span>
            <span className="text-xs text-tertiary">{a.time?.slice(11,16)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
