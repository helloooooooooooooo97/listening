import { useEffect, useState } from 'react';
import { HiCheck, HiXMark, HiPlay, HiArrowLeft, HiArrowRight } from 'react-icons/hi2';
import type { WordResult } from '../../stores/dictationStore';

interface Props {
  score: number;
  prevScore?: number; // previous score for this sentence, for comparison
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
      // ease-out quad
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

  return (
    <div className="animate-scale-in">
      {/* Score */}
      <div className="text-center mb-4">
        <div className="text-3xl font-bold text-primary tabular-nums">
          <CountUpScore target={score} />%
        </div>
        {improved && <span className="text-xs text-emerald-500 animate-scale-in">↑ 比上次高 {score - prevScore!}%</span>}
        {worse && <span className="text-xs text-amber-500 animate-scale-in">↓ 比上次低 {prevScore! - score}%</span>}
      </div>

      {/* Word results — staggered reveal with color fade-in */}
      <div className="flex flex-wrap gap-1.5 justify-center mb-6">
        {results.map((r, i) => (
          <span key={i}
            className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-medium animate-scale-in ${
              r.status === 'correct' ? 'bg-emerald-500/20 text-emerald-400' :
              r.status === 'wrong' ? 'bg-red-500/20 text-red-400 line-through' :
              r.status === 'missing' ? 'bg-red-500/10 text-red-300/50' :
              'bg-amber-500/20 text-amber-400 line-through'
            }`}
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
          >
            {r.status === 'correct' && <HiCheck size={12} />}
            {r.status === 'wrong' && <HiXMark size={12} />}
            {(r.status === 'correct' || r.status === 'wrong') && r.expected}
            {r.status === 'missing' && <span className="italic">{r.expected}</span>}
            {r.status === 'extra' && <span>{r.actual}</span>}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center flex-wrap">
        <button onClick={onPrev}
          disabled={!canGoPrev}
          className="px-4 py-2 bg-[var(--bg-tertiary)] text-secondary rounded-full text-sm hover:bg-[var(--bg-active)] disabled:opacity-20 disabled:cursor-default transition-colors cursor-pointer flex items-center gap-1.5">
          <HiArrowLeft size={14}/> 上一句
        </button>
        <button onClick={onReplay}
          className="px-4 py-2 bg-[var(--bg-tertiary)] text-secondary rounded-full text-sm hover:bg-[var(--bg-active)] transition-colors cursor-pointer flex items-center gap-1.5">
          <HiPlay size={14}/> 重听
        </button>
        <button onClick={onNext}
          disabled={!canGoNext}
          className="px-4 py-2 bg-[var(--accent)] on-accent rounded-full text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer flex items-center gap-1.5">
          下一句 <HiArrowRight size={14}/>
        </button>
      </div>
    </div>
  );
}
