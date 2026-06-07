import { useEffect, useState } from 'react';
import { HiPlay, HiArrowLeft, HiArrowRight } from 'react-icons/hi2';
import type { WordResult } from '../../stores/dictationStore';

interface Props {
  score: number;
  prevScore?: number;
  results: WordResult[];
  onPrev: () => void;
  onNext: () => void;
  onReplay: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

function CountUpScore({ target, duration = 500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return <>{count}</>;
}

export default function FeedbackPhase({ score, prevScore, results, onPrev, onNext, onReplay, canGoPrev, canGoNext }: Props) {
  const improved = prevScore !== undefined && score > prevScore;
  const worse = prevScore !== undefined && score < prevScore;

  // Merge adjacent missing+extra into "wrong" pairs for inline display
  const merged: WordResult[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'missing' && i + 1 < results.length && results[i + 1].status === 'extra') {
      // User typed something wrong instead of the expected word
      merged.push({ expected: r.expected, actual: results[i + 1].actual, status: 'wrong' });
      i++; // skip the extra
    } else if (r.status === 'extra' && merged.length > 0 && merged[merged.length - 1].status !== 'correct') {
      // Lone extra — could be from an insertion, just show it
      merged.push(r);
    } else {
      merged.push(r);
    }
  }

  return (
    <div className="animate-scale-in w-full flex flex-col items-center gap-4">
      {/* Score */}
      <div className="text-center">
        <span className="text-4xl font-bold text-primary tabular-nums"><CountUpScore target={score} />%</span>
        {improved && <span className="block text-xs text-emerald-500 mt-0.5">↑ 比上次高</span>}
        {worse && <span className="block text-xs text-amber-500 mt-0.5">↓ 比上次低</span>}
      </div>

      {/* Word blocks — inline sentence order */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {merged.map((r, i) => {
          if (r.status === 'correct') {
            return (
              <span key={i} className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-medium bg-emerald-500/20 text-emerald-400 animate-scale-in"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}>
                {r.expected}
              </span>
            );
          }
          if (r.status === 'wrong') {
            return (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium bg-red-500/20 text-red-400 animate-scale-in"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}>
                <span className="line-through">{r.actual}</span>
                <span>→</span>
                <span className="text-emerald-400">{r.expected}</span>
              </span>
            );
          }
          if (r.status === 'missing') {
            return (
              <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-red-500/10 text-red-300/50 italic animate-scale-in"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}>
                {r.expected}
              </span>
            );
          }
          if (r.status === 'extra') {
            return (
              <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-amber-500/20 text-amber-400 line-through animate-scale-in"
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}>
                {r.actual}
              </span>
            );
          }
          return null;
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-center w-full">
        <button onClick={onPrev} disabled={!canGoPrev}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--bg-tertiary)] text-secondary hover:bg-[var(--bg-active)] disabled:opacity-20 disabled:cursor-default transition-colors cursor-pointer">
          <HiArrowLeft size={16} />
        </button>
        <button onClick={onReplay}
          className="px-4 py-2 bg-[var(--bg-tertiary)] text-secondary rounded-full text-sm hover:bg-[var(--bg-active)] transition-colors cursor-pointer flex items-center gap-1.5">
          <HiPlay size={14} /> 重听
        </button>
        <button onClick={onNext} disabled={!canGoNext}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--accent)] on-accent hover:bg-[var(--accent-hover)] disabled:opacity-20 disabled:cursor-default transition-colors cursor-pointer">
          <HiArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
