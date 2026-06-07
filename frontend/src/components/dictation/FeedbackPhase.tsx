import { HiCheck, HiXMark, HiPlay, HiArrowLeft, HiArrowRight } from 'react-icons/hi2';
import type { WordResult } from '../../stores/dictationStore';

interface Props {
  score: number;
  results: WordResult[];
  onPrev: () => void;
  onNext: () => void;
  onReplay: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
}

export default function FeedbackPhase({ score, results, onPrev, onNext, onReplay, canGoPrev, canGoNext }: Props) {
  return (
    <div className="animate-scale-in">
      <div className="text-center mb-4">
        <span className="text-3xl font-bold text-primary">{score}%</span>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center mb-6">
        {results.map((r, i) => (
          <span key={i} className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-medium transition-all animate-scale-in ${
            r.status === 'correct' ? 'bg-emerald-500/20 text-emerald-400' :
            r.status === 'wrong' ? 'bg-red-500/20 text-red-400 line-through' :
            r.status === 'missing' ? 'bg-red-500/10 text-red-300/50' :
            'bg-amber-500/20 text-amber-400 line-through'
          }`} style={{animationDelay:`${i*30}ms`}}>
            {r.status === 'correct' && <HiCheck size={12}/>}
            {r.status === 'wrong' && <HiXMark size={12}/>}
            {(r.status === 'correct' || r.status === 'wrong') && r.expected}
            {r.status === 'missing' && <span className="italic">{r.expected}</span>}
            {r.status === 'extra' && <span>{r.actual}</span>}
          </span>
        ))}
      </div>
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
          className="px-4 py-2 bg-[var(--accent)] on-accent rounded-full text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer flex items-center gap-1.5">
          下一句 <HiArrowRight size={14}/>
        </button>
      </div>
    </div>
  );
}
