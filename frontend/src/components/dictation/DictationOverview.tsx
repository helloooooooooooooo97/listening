import { useState } from 'react';
import { HiPlay, HiCheck } from 'react-icons/hi2';
import type { ListeningLesson } from '../../types/lesson';
import type { WordResult } from '../../stores/dictationStore';
import { useAudioStore } from '../../stores/audioStore';

interface Props {
  lesson: ListeningLesson;
  scores: number[];
  scoreDetails: WordResult[][];
  onRetrySentence: (idx: number) => void;
  onClose: () => void;
}

function scoreColor(s: number) {
  if (s >= 80) return 'text-emerald-400 bg-emerald-500/10';
  if (s >= 50) return 'text-amber-400 bg-amber-500/10';
  return 'text-red-400 bg-red-500/10';
}

export default function DictationOverview({ lesson, scores, scoreDetails, onRetrySentence, onClose }: Props) {
  const seek = useAudioStore(s => s.seek);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const toggleExpand = (idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-[var(--border-secondary)]">
        <div>
          <h3 className="text-sm font-bold text-primary">听写总览</h3>
          <p className="text-xs text-tertiary">{scores.length}/{lesson.transcript.length} 句 · 均分 {avgScore}%</p>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-secondary hover:text-secondary transition-colors cursor-pointer rounded-lg hover:bg-[var(--bg-tertiary)]">
          返回听写
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {lesson.transcript.map((line, idx) => {
          const score = scores[idx];
          const hasScore = score !== undefined;
          const isExpanded = expanded.has(idx);
          const details = scoreDetails[idx];

          return (
            <div key={line.id} className="group">
              <div
                onClick={() => { if (hasScore) toggleExpand(idx); seek(line.start); }}
                className={`flex items-start gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                  hasScore ? 'hover:bg-[var(--bg-hover)]' : 'opacity-30'
                }`}
              >
                <span className="text-xs text-tertiary w-6 text-right flex-shrink-0 pt-0.5">{idx + 1}</span>
                <p className="flex-1 text-sm text-secondary leading-relaxed">{line.text}</p>
                {hasScore ? (
                  <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${scoreColor(score)}`}>
                    {score}%
                  </span>
                ) : (
                  <span className="text-[10px] text-tertiary flex-shrink-0">未练</span>
                )}
              </div>

              {isExpanded && details && (
                <div className="ml-9 mb-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {details.map((r, i) => {
                      if (r.status === 'correct') {
                        return <span key={i} className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-medium bg-emerald-500/20 text-emerald-400">{r.expected}</span>;
                      }
                      if (r.status === 'wrong') {
                        return <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium bg-red-500/20 text-red-400"><span className="line-through">{r.actual}</span><span>→</span><span className="text-emerald-400">{r.expected}</span></span>;
                      }
                      if (r.status === 'missing') {
                        return <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-red-500/10 text-red-300/50 italic">{r.expected}</span>;
                      }
                      if (r.status === 'extra') {
                        return <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-amber-500/20 text-amber-400 line-through">{r.actual}</span>;
                      }
                      return null;
                    })}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button onClick={() => onRetrySentence(idx)}
                      className="flex items-center gap-1 text-[var(--accent)] hover:underline cursor-pointer">
                      <HiPlay size={10} /> 复练此句
                    </button>
                    <span className="flex items-center gap-1 text-tertiary">
                      <HiCheck size={10} className="text-emerald-400" /> {score}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
