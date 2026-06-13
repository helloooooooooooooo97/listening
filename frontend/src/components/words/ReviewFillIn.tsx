import { useState, useEffect, useRef, useMemo } from 'react';
import { HiXMark } from 'react-icons/hi2';
import { useAudioStore, getAudio } from '../../stores/audioStore';
import { safePlay } from '../../lib/audioEngine';
import { getWordSentences, submitWordReview, type WordSentence } from '../../lib/api';
import Spinner from '../ui/Spinner';

// ── Helper ──
function cleanWordText(raw: string) {
  return raw.replace(/^[.,!?;:\-"'“”‘’—]+|[.,!?;:\-"'“”‘’—]+$/g, '').toLowerCase();
}

interface ReviewFillInProps {
  word: string;
  index: number;
  total: number;
  onScore: (score: number) => void;
  onClose: () => void;
}

export default function ReviewFillIn({ word, index, total, onScore, onClose }: ReviewFillInProps) {
  const viewClip = useAudioStore(s => s.viewClip);

  const [sentence, setSentence] = useState<WordSentence | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Load sentence context + auto-play
  useEffect(() => {
    setSentence(null);
    setLoading(true);
    setInput('');
    setResult(null);
    setRevealed(false);
    getWordSentences(word)
      .then(data => {
        if (data.sentences.length > 0) {
          const sent = data.sentences[0];
          setSentence(sent);
          const st = Math.max(0, sent.start_time);
          const et = sent.end_time + 0.5;
          viewClip({ id: '', lessonId: sent.lesson_id, lessonTitle: sent.lesson_title, startWordId: '', endWordId: '', startTime: st, endTime: et, text: sent.sentence_text, note: 'review', color: '#facc15', createdAt: '' });
          setTimeout(() => safePlay(getAudio()), 300);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [word]);

  const cleanWord = useMemo(() => cleanWordText(word), [word]);

  const highlightedSentence = useMemo(() => {
    if (!sentence || !cleanWord) return sentence?.sentence_text || '';
    const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    return sentence.sentence_text.replace(regex, '___');
  }, [sentence, cleanWord]);

  const handleCheck = () => {
    const cleaned = cleanWordText(word);
    const isCorrect = input.trim().toLowerCase() === cleaned;
    setResult(isCorrect ? 'correct' : 'wrong');
    setRevealed(true);
  };

  return (
    <div className="p-8">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs text-tertiary tabular-nums">{index + 1} / {total}</span>
        <div className="flex-1 mx-4 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <button onClick={onClose} className="text-tertiary hover:text-secondary transition-colors cursor-pointer">
          <HiXMark size={16} />
        </button>
      </div>

      {/* Sentence context */}
      <div className="rounded-xl p-6 mb-5 min-h-[120px]" style={{ background: 'var(--bg-tertiary)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={20} />
          </div>
        ) : sentence ? (
          <div>
            {!revealed ? (
              <p className="text-sm leading-relaxed text-secondary">{highlightedSentence}</p>
            ) : result === 'wrong' ? (
              <div>
                <p className="text-sm leading-relaxed text-primary">
                  {(() => {
                    const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const parts = sentence.sentence_text.split(new RegExp(`(\\b${escaped}\\b)`, 'gi'));
                    return parts.map((part, i) =>
                      part.toLowerCase() === cleanWord
                        ? <span key={i} className="text-emerald-400 font-bold">{part}</span>
                        : part
                    );
                  })()}
                </p>
                <p className="text-xs mt-2 text-emerald-400 font-semibold">✓ 正确答案：{word}</p>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-primary">{sentence.sentence_text}</p>
            )}
            <p className="text-xs text-tertiary mt-3">🎧 {sentence.lesson_title}</p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-tertiary">未找到句子上下文</p>
          </div>
        )}
      </div>

      {/* Input area */}
      {!revealed ? (
        <form onSubmit={e => { e.preventDefault(); if (input.trim()) handleCheck(); }}>
          <div className="flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder="输入单词..." autoFocus
              className="flex-1 px-4 py-3 rounded-xl text-sm bg-[var(--bg-tertiary)] border-0 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 text-primary placeholder:text-tertiary" />
            <button type="submit" disabled={!input.trim()}
              className="px-5 py-3 rounded-xl text-sm font-semibold bg-[var(--accent)] on-accent hover:opacity-90 disabled:opacity-30 transition-opacity cursor-pointer">
              确认
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className={`p-3 rounded-xl text-sm font-medium text-center ${
            result === 'correct' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
          }`}>
            {result === 'correct' ? '✅ 拼写正确！' : `❌ 正确答案：${word}`}
          </div>
          <button onClick={() => onScore(result === 'correct' ? 100 : 0)}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
            {index + 1 >= total ? '查看复习结果' : '下一词 →'}
          </button>
        </div>
      )}
    </div>
  );
}
