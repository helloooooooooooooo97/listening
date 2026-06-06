import { useEffect } from 'react';
import { useAudioStore } from '../stores/audioStore';
import { useClipsStore } from '../stores/clipsStore';
import { useToastStore } from '../stores/toastStore';

export function useKeyboardShortcuts() {
  const togglePlay = useAudioStore((s) => s.togglePlay);
  const seekRelative = useAudioStore((s) => s.seekRelative);
  const jumpToPrevSentence = useAudioStore((s) => s.jumpToPrevSentence);
  const jumpToNextSentence = useAudioStore((s) => s.jumpToNextSentence);
  const cycleLoopMode = useAudioStore((s) => s.cycleLoopMode);
  const setRate = useAudioStore((s) => s.setRate);
  const addToast = useToastStore((s) => s.addToast);
  const addClip = useClipsStore((s) => s.addClip);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

      // Space = play/pause
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
        return;
      }

      const { mode: currentMode } = useAudioStore.getState();

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) seekRelative(-5);
          else jumpToPrevSentence();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) seekRelative(5);
          else jumpToNextSentence();
          break;
        case 'ArrowUp':
          e.preventDefault();
          jumpToPrevSentence();
          break;
        case 'ArrowDown':
          e.preventDefault();
          jumpToNextSentence();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          cycleLoopMode();
          break;
        case '1': setRate(0.5); break;
        case '2': setRate(0.75); break;
        case '3': setRate(1); break;
        case '4': setRate(1.25); break;
        case '5': setRate(1.5); break;
        case 's':
        case 'S':
          e.preventDefault();
          // Save current sentence as clip (in lesson mode)
          if (currentMode.kind === 'lesson') {
            const sentences = currentMode.lesson.transcript;
            const time = useAudioStore.getState().currentTime;
            const idx = sentences.findIndex(
              (s, i) =>
                time >= s.start - 0.05 &&
                (i === sentences.length - 1 || time < sentences[i + 1].start - 0.05)
            );
            const targetIdx = idx >= 0 ? idx : 0;
            const sent = sentences[targetIdx];
            const words = currentMode.lesson.words.filter(
              (w) => w.start >= sent.start - 0.05 && w.end <= sent.end + 0.05
            );
            if (words.length > 0) {
              addClip({
                lessonId: currentMode.lesson.id,
                lessonTitle: currentMode.lesson.title,
                startWordId: words[0].id,
                endWordId: words[words.length - 1].id,
                startTime: sent.start,
                endTime: sent.end,
                text: words.map((w) => w.text).join(' '),
                note: '',
              });
              addToast('已保存当前句子为片段', 'success');
            }
          }
          break;
        case 'Escape':
          // Clear any text selection
          window.getSelection()?.removeAllRanges();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, seekRelative, jumpToPrevSentence, jumpToNextSentence, cycleLoopMode, setRate, addToast, addClip]);
}
