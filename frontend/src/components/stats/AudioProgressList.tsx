import Skeleton from '../Skeleton';
import type { AudioProgress } from '../../lib/api';

export default function AudioProgressList({ audioProgress, loading }: { audioProgress: AudioProgress[]; loading: boolean }) {
  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-bold text-primary mb-4">音频进度</h2>
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
          {Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      </div>
    );
  }
  if (audioProgress.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-bold text-primary mb-4">音频进度</h2>
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
        {audioProgress.slice(0, 6).map(l => (
          <div key={l.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-secondary truncate">{l.title}</p>
              <div className="mt-1 h-1 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${l.completed ? 100 : Math.min(100, (l.total_seconds / 300) * 100)}%`,
                  background: l.completed ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                }} />
              </div>
            </div>
            <span className="text-xs text-tertiary w-12 text-right">
              {l.completed ? (l.dictation_score ? `${l.dictation_score}%` : '✓') : `${Math.floor(l.total_seconds)}秒`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
