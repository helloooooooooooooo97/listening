import { useState, useEffect, useRef, useMemo } from 'react';
import { HiXMark, HiSparkles, HiBookOpen } from 'react-icons/hi2';
import { submitBatchReview } from '../../lib/api';
import ReviewFillIn from './ReviewFillIn';
import ReviewFlashcard from './ReviewFlashcard';

// ── Props ──

export interface ReviewResult {
  word: string;
  correct: boolean;
  score: number;
}

interface ReviewWord {
  word: string;
  source?: string;
}

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  words: ReviewWord[];
  mode?: 'fill-in' | 'flashcard';
  onComplete?: (results: ReviewResult[]) => void;
}

// ── Helpers ──

function genSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Component ──

export default function ReviewModal({ open, onClose, words, mode: initialMode = 'fill-in', onComplete }: ReviewModalProps) {
  const [reviewMode, setReviewMode] = useState<'fill-in' | 'flashcard'>(initialMode);
  const [index, setIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const resultsRef = useRef<ReviewResult[]>([]);
  const sessionIdRef = useRef('');

  // Reset on open
  useEffect(() => {
    if (open) {
      setIndex(0);
      setComplete(false);
      setReviewMode(initialMode);
      resultsRef.current = [];
      sessionIdRef.current = genSessionId();
    }
  }, [open]);

  const current = words[index];

  const submitScore = (score: number) => {
    if (!current) return;
    const correct = score >= 80;
    // Push to local results immediately
    resultsRef.current.push({ word: current.word, correct, score });
    onComplete?.(resultsRef.current);

    if (index + 1 >= words.length) {
      setComplete(true);
    } else {
      setIndex(i => i + 1);
    }
  };

  const close = () => {
    // Flush batch results to backend on close
    const results = resultsRef.current;
    if (results.length > 0 && sessionIdRef.current) {
      const items = results.map((r, i) => ({
        word: r.word,
        correct: r.correct,
        score: r.score,
        session_index: i,
      }));
      submitBatchReview(sessionIdRef.current, words[0]?.source || 'review', reviewMode, items).catch(() => {});
    }
    setComplete(false);
    onClose();
  };

  const summary = useMemo(() => {
    const r = resultsRef.current;
    const wrong = r.filter(x => !x.correct).length;
    const correct = r.filter(x => x.correct).length;
    const pct = r.length > 0 ? Math.round((correct / r.length) * 100) : 0;
    return { wrong, correct, pct, total: r.length };
  }, [complete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && complete) close(); }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden"
        style={{ background: 'var(--bg-primary)' }}>

        {/* Source & mode header */}
        {!complete && (
          <div className="flex items-center justify-between px-6 pt-6 pb-0">
            <div className="flex items-center gap-2">
              {words.length > 0 && words[0].source && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-tertiary">
                  {words[0].source}{words.length > 1 && ` +${words.length - 1}`}
                </span>
              )}
            </div>
            <button onClick={() => setReviewMode(m => m === 'fill-in' ? 'flashcard' : 'fill-in')}
              className="text-[10px] px-2 py-1 rounded-md text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center gap-1">
              <HiBookOpen size={11} />
              {reviewMode === 'fill-in' ? '闪卡模式' : '拼写模式'}
            </button>
          </div>
        )}

        {complete ? (
          /* Summary */
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <HiSparkles size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-primary mb-2">复习完成！</h2>
            <p className="text-sm text-tertiary mb-6">
              共复习 {summary.total} 个单词
              {words[0]?.source && `（来自 ${words[0].source}）`}
            </p>
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between text-sm px-4 py-2 rounded-lg bg-emerald-500/5">
                <span className="text-emerald-400">正确</span>
                <span className="text-emerald-400 font-bold tabular-nums">{summary.correct}</span>
              </div>
              <div className="flex items-center justify-between text-sm px-4 py-2 rounded-lg bg-red-500/5">
                <span className="text-red-400">错误</span>
                <span className="text-red-400 font-bold tabular-nums">{summary.wrong}</span>
              </div>
              <div className="text-center mt-4">
                <span className="text-2xl font-black text-primary tabular-nums">{summary.pct}%</span>
                <p className="text-xs text-tertiary">正确率</p>
              </div>
            </div>
            <button onClick={close}
              className="px-6 py-2 rounded-lg text-sm font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
              完成
            </button>
          </div>
        ) : reviewMode === 'fill-in' ? (
          <ReviewFillIn
            key={current?.word}
            word={current?.word || ''}
            index={index}
            total={words.length}
            onScore={submitScore}
            onClose={close}
          />
        ) : (
          <ReviewFlashcard
            key={current?.word}
            word={current?.word || ''}
            index={index}
            total={words.length}
            onScore={submitScore}
            onClose={close}
          />
        )}
      </div>
    </div>
  );
}
