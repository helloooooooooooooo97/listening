import { useState, useEffect } from 'react';
import { HiXMark, HiPlay } from 'react-icons/hi2';
import { useAudioStore, getAudio } from '../../stores/audioStore';
import { safePlay } from '../../lib/audioEngine';
import Spinner from '../ui/Spinner';
import { getWordSentences, getDictionaryEntry, type WordSentence, type WordDictionary } from '../../lib/api';

interface ReviewFlashcardProps {
  word: string;
  index: number;
  total: number;
  onScore: (score: number) => void;
  onClose: () => void;
}

export default function ReviewFlashcard({ word, index, total, onScore, onClose }: ReviewFlashcardProps) {
  const viewClip = useAudioStore(s => s.viewClip);

  const [sentence, setSentence] = useState<WordSentence | null>(null);
  const [dictionary, setDictionary] = useState<WordDictionary | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setSentence(null);
    setDictionary(null);
    setRevealed(false);
    setLoading(true);
    Promise.all([
      getDictionaryEntry(word).then(setDictionary).catch(() => {}),
      getWordSentences(word).then(data => {
        if (data.sentences.length > 0) {
          const sent = data.sentences[0];
          setSentence(sent);
          const st = Math.max(0, sent.start_time);
          const et = sent.end_time + 0.5;
          viewClip({ id: '', lessonId: sent.lesson_id, lessonTitle: sent.lesson_title, startWordId: '', endWordId: '', startTime: st, endTime: et, text: sent.sentence_text, note: 'review', color: '#facc15', createdAt: '' });
          setTimeout(() => safePlay(getAudio()), 300);
        }
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [word]);

  const replay = () => {
    if (!sentence) return;
    const st = Math.max(0, sentence.start_time);
    const et = sentence.end_time + 0.5;
    viewClip({ id: '', lessonId: sentence.lesson_id, lessonTitle: sentence.lesson_title, startWordId: '', endWordId: '', startTime: st, endTime: et, text: sentence.sentence_text, note: 'review', color: '#facc15', createdAt: '' });
    setTimeout(() => safePlay(getAudio()), 100);
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

      {/* Word display */}
      <div className="rounded-xl p-8 mb-5 text-center min-h-[200px]" style={{ background: 'var(--bg-tertiary)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={24} />
          </div>
        ) : revealed ? (
          <div className="space-y-3">
            <p className="text-2xl font-bold text-primary">{word}</p>
            {dictionary ? (
              <>
                {dictionary.pronunciation && (
                  <p className="text-lg text-secondary font-mono">/{dictionary.pronunciation}/</p>
                )}
                {dictionary.tags.length > 0 && (
                  <div className="flex justify-center gap-1 flex-wrap">
                    {dictionary.tags.map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-tertiary font-medium">{t}</span>
                    ))}
                  </div>
                )}
                {(dictionary.partOfSpeech || dictionary.definition) && (
                  <p className="text-sm text-primary">
                    {dictionary.partOfSpeech && <span className="italic mr-1 text-tertiary">{dictionary.partOfSpeech}</span>}
                    {dictionary.definition}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-tertiary">暂无词典信息</p>
            )}
            {sentence && (
              <div className="mt-4 pt-3 border-t border-[var(--border-secondary)]">
                <p className="text-sm text-secondary leading-relaxed">{sentence.sentence_text}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-xs text-tertiary">🎧 {sentence.lesson_title}</span>
                  <button onClick={replay}
                    className="text-xs px-2 py-1 rounded bg-[var(--bg-hover)] text-tertiary hover:text-secondary transition-colors cursor-pointer flex items-center gap-1">
                    <HiPlay size={11} /> 重听
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Before reveal */
          <div className="py-8 cursor-pointer" onClick={() => setRevealed(true)}>
            <p className="text-3xl font-bold text-primary mb-2">{word}</p>
            <div className="flex items-center justify-center gap-1.5 mt-3 text-tertiary">
              {sentence ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
                  <span className="text-xs">正在播放原声</span>
                  <button onClick={e => { e.stopPropagation(); replay(); }}
                    className="text-xs px-2 py-0.5 rounded bg-[var(--bg-hover)] text-tertiary hover:text-secondary transition-colors cursor-pointer">
                    重播
                  </button>
                </>
              ) : (
                <span className="text-xs">加载音频中…</span>
              )}
            </div>
            <p className="text-xs text-tertiary mt-6">点击显示释义</p>
          </div>
        )}
      </div>

      {/* Self-rate buttons */}
      {revealed && (
        <div className="space-y-2">
          <p className="text-xs text-tertiary text-center mb-2">还记得这个词吗？</p>
          <div className="flex gap-2">
            <button onClick={() => onScore(0)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors cursor-pointer">
              忘了 (0分)
            </button>
            <button onClick={() => onScore(50)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer">
              模糊 (50分)
            </button>
            <button onClick={() => onScore(100)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer">
              想起 (100分)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
