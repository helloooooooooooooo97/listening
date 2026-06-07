import { useState } from 'react';
import { HiChevronDown } from 'react-icons/hi2';
import type { TranscriptLine } from '../../types/lesson';

interface Props {
  sentences: TranscriptLine[];
  sentenceIndex: number;
  scores: number[];
  avgScore: number | null;
  onGoToSentence: (idx: number) => void;
}

export default function SentenceSelector({ sentences, sentenceIndex, scores, avgScore, onGoToSentence }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-tertiary hover:text-secondary transition-colors cursor-pointer text-xs"
      >
        第 {sentenceIndex + 1}/{sentences.length} 句
        <HiChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {avgScore !== null && <span className="text-tertiary">· 均分 {avgScore}%</span>}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-2xl z-50 py-1 animate-scale-in">
          {sentences.map((s, i) => {
            const done = scores[i] !== undefined;
            const sScore = scores[i];
            return (
              <button
                key={i}
                onClick={() => { onGoToSentence(i); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-xs flex items-center gap-3 transition-colors cursor-pointer ${
                  i === sentenceIndex
                    ? 'bg-[var(--accent)]/15 on-accent'
                    : 'text-secondary hover:bg-[var(--bg-tertiary)] hover:text-secondary'
                }`}
              >
                <span className={`w-6 h-5 rounded flex items-center justify-center text-xs font-mono flex-shrink-0 ${
                  done
                    ? sScore! >= 80 ? 'bg-emerald-500/20 text-emerald-400' : sScore! >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                    : 'bg-[var(--bg-tertiary)] text-tertiary'
                }`}>
                  {done ? `${sScore}%` : i + 1}
                </span>
                <span className="truncate">{s.text.slice(0, 50)}{s.text.length > 50 ? '...' : ''}</span>
                {done && sScore! < 50 && <span className="ml-auto text-xs text-red-500/70">需复习</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
