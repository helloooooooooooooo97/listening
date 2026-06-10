import { useState, useCallback, useRef } from 'react';
import { useAudioStore, getAudio } from '../stores/audioStore';
import { safePlay } from '../lib/audioEngine';
import { useSettingsStore } from '../stores/settingsStore';
import { getWordSentences, getLessonById } from '../lib/api';

export interface WordAudioOptions {
  /**
   * Extra seconds of context around the word's exact timestamp.
   * Falls back to the global `wordPlayOffset` setting if omitted.
   * - `padding: 0` → exact word boundaries only.
   * - `padding: 2` → 2s before word start, 2s after word end.
   */
  padding?: number;
}

// Strip leading/trailing punctuation + lowercase (matches backend clean_word)
function cleanWord(s: string): string {
  return s.replace(/^[.,!?;:\-"'`]+|[.,!?;:\-"'`]+$/g, '').toLowerCase();
}

// Simple in-memory cache: lessonId → lesson words
const lessonWordCache = new Map<string, { words: { text: string; start: number; end: number }[] }>();

function findWordTimestamp(
  lessonId: string,
  word: string,
): { start: number; end: number } | null {
  const cached = lessonWordCache.get(lessonId);
  if (!cached) return null;
  const cleaned = cleanWord(word);
  const entry = cached.words.find(
    w => cleanWord(w.text) === cleaned,
  );
  return entry ? { start: entry.start, end: entry.end } : null;
}

/**
 * Reusable hook to look up a word's audio position and play around it.
 * Finds the word's exact timestamp from the lesson transcript, then plays
 * with ±padding (defaults to the global `wordPlayOffset` setting).
 *
 * Usage:
 *   const { playWordAudio, loading } = useWordAudio();
 *   playWordAudio('apple');                     // word ± global wordPlayOffset
 *   playWordAudio('apple', { padding: 0 });     // exact word boundaries
 *   playWordAudio('apple', { padding: 3 });     // ±3s around the word
 */
export function useWordAudio() {
  const viewClip = useAudioStore(s => s.viewClip);
  const wordPlayOffset = useSettingsStore(s => s.settings.wordPlayOffset);
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);
  const lastWordRef = useRef('');

  const playWordAudio = useCallback(async (word: string, opts?: WordAudioOptions) => {
    if (busyRef.current && lastWordRef.current === word) return;
    lastWordRef.current = word;
    busyRef.current = true;
    setLoading(true);
    try {
      const data = await getWordSentences(word, 'favorites,recent_plays');
      if (data.sentences.length === 0) return;
      const sent = data.sentences[0];

      // Try to find the word's exact timestamp from the lesson
      let wStart = sent.start_time;
      let wEnd = sent.end_time;
      let wText = sent.sentence_text;

      // Fetch lesson if not cached
      if (!lessonWordCache.has(sent.lesson_id)) {
        try {
          const lesson = await getLessonById(sent.lesson_id);
          if (lesson.words && lesson.words.length > 0) {
            lessonWordCache.set(sent.lesson_id, { words: lesson.words });
          }
        } catch {
          // Fall through to sentence-level timestamps
        }
      }

      const ts = findWordTimestamp(sent.lesson_id, word);
      if (ts) {
        wStart = ts.start;
        wEnd = ts.end;
      }

      const pad = opts?.padding ?? wordPlayOffset;
      const st = Math.max(0, wStart - pad);
      const et = wEnd + pad;

      viewClip({
        id: '',
        lessonId: sent.lesson_id,
        lessonTitle: sent.lesson_title,
        startWordId: '',
        endWordId: '',
        startTime: st,
        endTime: et,
        text: wText,
        note: 'word-audio',
        color: '#facc15',
        createdAt: '',
      });
      setTimeout(() => {
        const a = getAudio();
        if (a.paused) safePlay(a);
      }, 200);
    } catch {
      // Silently fail — audio is non-critical
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [viewClip, wordPlayOffset]);

  return { playWordAudio, loading };
}
