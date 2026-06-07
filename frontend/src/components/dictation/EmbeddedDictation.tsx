import { useEffect, useRef } from 'react';
import { useAudioStore } from '../../stores/audioStore';
import { useDictationStore } from '../../stores/dictationStore';
import { postDictation } from '../../lib/api';
import type { ListeningLesson } from '../../types/lesson';
import SentenceSelector from './SentenceSelector';
import TypingPhase from './TypingPhase';
import FeedbackPhase from './FeedbackPhase';
import CompletionScreen from './CompletionScreen';

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
  const goToSentence = useDictationStore(s => s.goToSentence);
  const skip = useDictationStore(s => s.skip);
  const reset = useDictationStore(s => s.reset);

  if (!active) return null;

  const sentences = lesson.transcript;
  const currentSentence = sentences[sentenceIndex];
  if (!currentSentence) {
    return <CompletionScreen scores={scores} onReset={reset} />;
  }

  const sentenceWords = lesson.words.filter(
    w => w.start >= currentSentence.start - 0.05 && w.end <= currentSentence.end + 0.05
  );
  const expectedWords = sentenceWords.map(w => w.text);

  const handlePlaySentence = () => {
    seek(currentSentence.start);
    setTimeout(() => useAudioStore.getState().togglePlay(), 150);
  };

  const handleSubmit = () => {
    if (!userInput.trim()) return;
    submit(expectedWords);
    setTimeout(() => {
      const state = useDictationStore.getState();
      postDictation({
        audio_id: lesson.id, audio_title: lesson.title,
        sentence_index: sentenceIndex, score: state.scores[state.scores.length - 1] || 0,
        user_input: userInput.trim(),
        expected_text: expectedWords.join(' '),
      }).catch(() => {});
    }, 100);
  };

  useEffect(() => {
    seek(currentSentence.start);
    setTimeout(() => useAudioStore.getState().togglePlay(), 150);
  }, [sentenceIndex]);

  useEffect(() => {
    if (!isPlaying || !currentSentence) return;
    if (currentTime >= currentSentence.end - 0.1) {
      useAudioStore.getState().togglePlay();
    }
  }, [currentTime, isPlaying, currentSentence]);

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        {/* Sentence counter — large, clear */}
        <div className="text-center">
          <span className="text-4xl font-bold text-primary tabular-nums">{sentenceIndex + 1}</span>
          <span className="text-lg text-tertiary"> / {sentences.length}</span>
          {avgScore !== null && (
            <p className="text-xs text-tertiary mt-0.5">均分 {avgScore}%</p>
          )}
        </div>

        {/* Phase */}
        {phase === 'typing' && (
          <TypingPhase
            inputRef={inputRef}
            userInput={userInput}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            onSkip={skip}
            onPlaySentence={handlePlaySentence}
          />
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

        {/* Sentence dots at bottom */}
        <SentenceSelector
          sentences={sentences}
          sentenceIndex={sentenceIndex}
          scores={scores}
          avgScore={avgScore}
          onGoToSentence={goToSentence}
        />
      </div>
    </div>
  );
}
