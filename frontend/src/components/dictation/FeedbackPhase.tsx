import { useEffect, useState } from 'react';
import { HiCheck, HiXMark, HiPlay, HiArrowLeft, HiArrowRight } from 'react-icons/hi2';
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

  // Split results into correct vs problem words
  const correct = results.filter(r => r.status === 'correct');
  const problems = results.filter(r => r.status !== 'correct');

  return (
    <div className="animate-scale-in w-full flex flex-col items-center gap-4">
      {/* Score */}
      <div className="text-center">
        <span className="text-4xl font-bold text-primary tabular-nums"><CountUpScore target={score} />%</span>
        {improved && <span className="block text-xs text-emerald-500 mt-0.5">↑ 比上次高</span>}
        {worse && <span className="block text-xs text-amber-500 mt-0.5">↓ 比上次低</span>}
      </div>

      {/* Expected vs actual comparison */}
      <div className="w-full space-y-2">
        {/* Correct words — always first */}
        {correct.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {correct.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-medium bg-emerald-500/15 text-emerald-400 animate-scale-in"
                style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }}>
                <HiCheck size={12} /> {r.expected}
              </span>
            ))}
          </div>
        )}

        {/* Problem words — wrong + missing + extra grouped together */}
        {problems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {problems.map((r, i) => (
              <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium animate-scale-in ${
                r.status === 'wrong' ? 'bg-red-500/15 text-red-400' :
                r.status === 'missing' ? 'bg-red-500/10 text-red-300/50' :
                'bg-amber-500/15 text-amber-400'
              }`} style={{ animationDelay: `${(correct.length + i) * 30}ms`, animationFillMode: 'backwards' }}>
                {r.status === 'wrong' && <><HiXMark size={12} /> <span className="line-through">{r.actual}</span> → {r.expected}</>}
                {r.status === 'missing' && <span className="italic">{r.expected}</span>}
                {r.status === 'extra' && <><span className="line-through">{r.actual}</span></>}
              </span>
            ))}
          </div>
        )}
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
