import { useEffect, useRef } from 'react';
import { HiArrowLeft, HiArrowRight } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { useDictationStore } from '../stores/dictationStore';
import { postDictation } from '../lib/api';
import SentenceSelector from '../components/dictation/SentenceSelector';
import TypingPhase from '../components/dictation/TypingPhase';
import FeedbackPhase from '../components/dictation/FeedbackPhase';
import CompletionScreen from '../components/dictation/CompletionScreen';

export default function DictationView() {
  const mode = useAudioStore(s => s.mode);
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

  if (!active || mode.kind !== 'lesson') return null;

  const sentences = mode.lesson.transcript;
  const currentSentence = sentences[sentenceIndex];
  if (!currentSentence) {
    return <CompletionScreen scores={scores} onReset={reset} />;
  }

  const sentenceWords = mode.lesson.words.filter(
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
        audio_id: mode.lesson!.id, audio_title: mode.lesson!.title,
        sentence_index: sentenceIndex, score: latestScore,
        user_input: userInput.trim(),
        expected_text: expectedJoined,
      }).catch(() => {});
    }, 100);
  };

  // Auto-play sentence
  useEffect(() => {
    seek(currentSentence.start);
    setTimeout(() => useAudioStore.getState().togglePlay(), 150);
  }, [sentenceIndex]);

  // Stop at sentence end
  useEffect(() => {
    if (!isPlaying || !currentSentence) return;
    if (currentTime >= currentSentence.end - 0.1) {
      useAudioStore.getState().togglePlay();
    }
  }, [currentTime, isPlaying, currentSentence]);

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-b border-[var(--border-secondary)]">
        <div>
          <h2 className="text-lg font-bold text-primary">听写模式</h2>
          <SentenceSelector
            sentences={sentences}
            sentenceIndex={sentenceIndex}
            scores={scores}
            avgScore={avgScore}
            onGoToSentence={goToSentence}
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevSentence}
            disabled={sentenceIndex <= 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--bg-active)] disabled:opacity-20 disabled:cursor-default transition-colors cursor-pointer text-secondary hover:text-secondary"
            title="上一句">
            <HiArrowLeft size={14} />
          </button>
          <button onClick={nextSentence}
            disabled={sentenceIndex >= sentences.length - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--bg-active)] disabled:opacity-20 disabled:cursor-default transition-colors cursor-pointer text-secondary hover:text-secondary"
            title="下一句">
            <HiArrowRight size={14} />
          </button>
          <button onClick={reset} className="px-3 py-1.5 text-xs text-secondary hover:text-secondary transition-colors cursor-pointer rounded-lg hover:bg-[var(--bg-tertiary)]">退出</button>
        </div>
      </div>

      {/* Phase content */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-lg space-y-6">
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
    </div>
  );
}
