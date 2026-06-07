import { useState } from 'react';
import { HiPlay, HiCheck, HiXMark } from 'react-icons/hi2';
import type { ListeningLesson } from '../../types/lesson';
import { useAudioStore } from '../../stores/audioStore';

interface Props {
  lesson: ListeningLesson;
  scores: number[];
  onRetrySentence: (idx: number) => void;
  onClose: () => void;
}

function scoreColor(s: number) {
  if (s >= 80) return 'text-emerald-400 bg-emerald-500/10';
  if (s >= 50) return 'text-amber-400 bg-amber-500/10';
  return 'text-red-400 bg-red-500/10';
}

export default function DictationOverview({ lesson, scores, onRetrySentence, onClose }: Props) {
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
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-[var(--border-secondary)]">
        <div>
          <h3 className="text-sm font-bold text-primary">听写总览</h3>
          <p className="text-xs text-tertiary">{scores.length}/{lesson.transcript.length} 句 · 均分 {avgScore}%</p>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-secondary hover:text-secondary transition-colors cursor-pointer rounded-lg hover:bg-[var(--bg-tertiary)]">
          返回听写
        </button>
      </div>

      {/* Passage */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {lesson.transcript.map((line, idx) => {
          const score = scores[idx];
          const hasScore = score !== undefined;
          const isExpanded = expanded.has(idx);

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

              {/* Expanded: show word-level results if we had them */}
              {isExpanded && (
                <div className="ml-9 mb-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] text-xs text-tertiary">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { onRetrySentence(idx); }}
                      className="flex items-center gap-1 text-[var(--accent)] hover:underline cursor-pointer">
                      <HiPlay size={10} /> 复练此句
                    </button>
                    <span className="flex items-center gap-1">
                      <HiCheck size={10} className="text-emerald-400" /> 得分 {score}%
                    </span>
                    {score < 80 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <HiXMark size={10} /> 需加强
                      </span>
                    )}
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
