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
    const expectedJoined = expectedWords.join(' ');
    setTimeout(() => {
      const state = useDictationStore.getState();
      const latestScore = state.scores[state.scores.length - 1] || 0;
      postDictation({
        audio_id: lesson.id, audio_title: lesson.title,
        sentence_index: sentenceIndex, score: latestScore,
        user_input: userInput.trim(),
        expected_text: expectedJoined,
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
    <div className="h-full flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-lg flex flex-col items-center gap-4">
        {/* Sentence indicator — centered */}
        <div className="text-center">
          <SentenceSelector
            sentences={sentences}
            sentenceIndex={sentenceIndex}
            scores={scores}
            avgScore={avgScore}
            onGoToSentence={goToSentence}
          />
          <p className="text-xs text-tertiary mt-1">句子 {sentenceIndex + 1} / {sentences.length}</p>
        </div>

        {/* Phase content */}
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
      </div>
    </div>
  );
}
