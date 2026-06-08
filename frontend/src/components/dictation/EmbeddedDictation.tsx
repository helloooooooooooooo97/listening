import { useEffect, useRef } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { useAudioStore } from '../../stores/audioStore';
import { useDictationStore } from '../../stores/dictationStore';
import { postDictation } from '../../lib/api';
import type { ListeningLesson } from '../../types/lesson';
import TypingPhase from './TypingPhase';
import FeedbackPhase from './FeedbackPhase';

interface Props {
  lesson: ListeningLesson;
}

export default function EmbeddedDictation({ lesson }: Props) {
  const seek = useAudioStore(s => s.seek);
  const isPlaying = useAudioStore(s => s.isPlaying);
  const currentTime = useAudioStore(s => s.currentTime);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = useDictationStore(s => s.active);
  const sentenceIndex = useDictationStore(s => s.sentenceIndex);
  const userInput = useDictationStore(s => s.userInput);
  const results = useDictationStore(s => s.results);
  const scores = useDictationStore(s => s.scores);
  const phase = useDictationStore(s => s.phase);
  const setInput = useDictationStore(s => s.setInput);
  const submit = useDictationStore(s => s.submit);
  const nextSentence = useDictationStore(s => s.nextSentence);
  const prevSentence = useDictationStore(s => s.prevSentence);
  const reset = useDictationStore(s => s.reset);

  const sentences = lesson.transcript;
  const currentSentence = sentences[sentenceIndex];
  const sentenceWords = currentSentence
    ? lesson.words.filter(w => w.start >= currentSentence.start - 0.05 && w.end <= currentSentence.end + 0.05)
    : [];
  const expectedWords = sentenceWords.map(w => w.text);

  const handlePlaySentence = () => {
    if (!currentSentence) return;
    seek(currentSentence.start);
    setTimeout(() => useAudioStore.getState().togglePlay(), 150);
  };

  const handleSubmit = () => {
    if (!userInput.trim()) return;
    submit(expectedWords);
  };

  // Save dictation result when feedback is shown
  const lastScoreRef = useRef(scores.length);
  useEffect(() => {
    if (scores.length > lastScoreRef.current && currentSentence) {
      lastScoreRef.current = scores.length;
      const lastScore = scores[scores.length - 1];
      if (lastScore != null) {
        postDictation({
          audio_id: lesson.id,
          audio_title: lesson.title,
          sentence_index: sentenceIndex,
          score: lastScore,
          user_input: userInput,
          expected_text: currentSentence.text,
        }).catch(() => {});
      }
    }
  }, [scores.length, scores, sentenceIndex, userInput, currentSentence, lesson]);

  if (!currentSentence) {
    return <div className="text-tertiary text-sm text-center py-16">没有可用的句子</div>;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 px-4">
      {/* Phase */}
      {phase === 'typing' && (
        <div className="w-full max-w-lg flex flex-col items-center gap-6">
          {/* Play row: prev | current/total | next */}
          <div className="w-full flex items-center justify-center gap-4">
            <button onClick={prevSentence} disabled={sentenceIndex <= 0}
              className="w-10 h-10 rounded-full flex items-center justify-center text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer disabled:opacity-30">
              <HiChevronLeft size={20} />
            </button>
            <span className="text-lg font-bold text-secondary font-mono min-w-[2ch] text-right tabular-nums">{sentenceIndex + 1}</span>
            <span className="text-sm text-tertiary">/ {sentences.length}</span>
            <button onClick={nextSentence} disabled={sentenceIndex >= sentences.length - 1}
              className="w-10 h-10 rounded-full flex items-center justify-center text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer disabled:opacity-30">
              <HiChevronRight size={20} />
            </button>
          </div>

          <TypingPhase
            inputRef={inputRef}
            userInput={userInput}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            onPlaySentence={handlePlaySentence}
          />
        </div>
      )}
      {phase === 'feedback' && (
        <FeedbackPhase
          score={scores[scores.length - 1] ?? 0}
          results={results}
          onPrev={prevSentence}
          onNext={nextSentence}
          onReplay={handlePlaySentence}
          canGoPrev={sentenceIndex > 0}
          canGoNext={sentenceIndex < sentences.length - 1}
        />
      )}
    </div>
  );
}
