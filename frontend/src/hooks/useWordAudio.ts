// ─── Word Audio — plays word clips through the bottom player bar ───
// Shared by 听了个听, 德州听词, WordsView, and other game views.

import { useCallback, useRef } from 'react';
import { getWordSentences, getLessonById } from '../lib/api';
import { useSettingsStore } from '../stores/settingsStore';
import { useAudioStore } from '../stores/audioStore';
import type { AudioClip } from '../types/lesson';
import {
  getAudio,
  preloadLessonAudioAndWait,
  safePlay,
  switchSource,
  waitForReady,
} from '../lib/audioEngine';

// ── Shared AudioContext (used by useSoundEffect for game SFX) ──
let _audioCtx: AudioContext | null = null;
let _ctxUnlocked = false;

function getCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}

/** Shared AudioContext for game SFX. */
export function getSharedAudioContext(): AudioContext {
  return getCtx();
}

/** Unlock Web Audio during a user click/tap — required on Safari/iOS for SFX. */
export function primeWordAudioContext() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') void ctx.resume();
  if (_ctxUnlocked && ctx.state === 'running') return;
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    _ctxUnlocked = true;
  } catch {
    // Non-fatal — desktop Safari may not need this
  }
}

/** Unlock HTML audio element inside a user gesture (Safari). */
export function primeHtmlAudio() {
  const a = getAudio();
  if (!a.src) return;
  const wasPaused = a.paused;
  const time = a.currentTime;
  void safePlay(a).then(started => {
    if (started && wasPaused) {
      a.pause();
      a.currentTime = time;
    }
  });
}

interface WordEntry { text: string; start: number; end: number; }
const lessonWordCache = new Map<string, WordEntry[]>();
const wordClipCache = new Map<string, AudioClip | null>();
const warmInFlight = new Map<string, Promise<void>>();

function cleanWord(s: string): string {
  return s.replace(/^[.,!?;:\-"'`]+|[.,!?;:\-"'`]+$/g, '').toLowerCase();
}

function findWord(words: WordEntry[], word: string): { start: number; end: number } | null {
  const cleaned = cleanWord(word);
  const entry = words.find(w => cleanWord(w.text) === cleaned);
  return entry ? { start: entry.start, end: entry.end } : null;
}

async function ensureLessonWords(lessonId: string): Promise<WordEntry[] | null> {
  if (lessonWordCache.has(lessonId)) return lessonWordCache.get(lessonId)!;
  try {
    const lesson = await getLessonById(lessonId);
    if (lesson.words && lesson.words.length > 0) {
      const entries = lesson.words.map(w => ({ text: w.text, start: w.start, end: w.end }));
      lessonWordCache.set(lessonId, entries);
      return entries;
    }
  } catch {
    // Fall through to sentence-level timestamps
  }
  return null;
}

async function buildWordClip(word: string, padding?: number): Promise<AudioClip | null> {
  const data = await getWordSentences(word, 'favorites,recent_plays');
  if (!data.sentences.length) return null;

  const sent = data.sentences[0];
  let startTime = sent.start_time;
  let endTime = sent.end_time;

  const words = await ensureLessonWords(sent.lesson_id);
  if (words) {
    const ts = findWord(words, word);
    if (ts) {
      startTime = ts.start;
      endTime = ts.end;
    }
  }

  const pad = padding ?? useSettingsStore.getState().settings.wordPlayOffset;
  return {
    id: '',
    lessonId: sent.lesson_id,
    lessonTitle: sent.lesson_title,
    startWordId: '',
    endWordId: '',
    startTime: Math.max(0, startTime - pad),
    endTime: endTime + pad,
    text: sent.sentence_text,
    note: 'word-audio',
    color: '#10b981',
    createdAt: '',
  };
}

export async function ensureWordClipCached(word: string, padding?: number): Promise<AudioClip | null> {
  const key = cleanWord(word);
  const cached = wordClipCache.get(key);
  if (cached !== undefined) return cached;

  const clip = await buildWordClip(word, padding).catch(() => null);
  wordClipCache.set(key, clip);
  return clip;
}

/** Load lesson audio onto the main player element (call on pointerdown before click). */
export async function warmWordAudio(word: string): Promise<void> {
  const key = cleanWord(word);
  const pending = warmInFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const clip = await ensureWordClipCached(word);
    if (!clip) return;
    switchSource(clip.lessonId);
    await new Promise<void>(resolve => waitForReady(getAudio(), resolve));
  })().finally(() => warmInFlight.delete(key));

  warmInFlight.set(key, task);
  return task;
}

/**
 * Replay a cached word clip through the main player.
 * Returns true when the clip was cached and handed to audioStore.playClip.
 */
export function playWordClipInGesture(word: string): boolean {
  const clip = wordClipCache.get(cleanWord(word));
  if (!clip) return false;

  useAudioStore.getState().playClipInGesture(clip);
  return true;
}

/** Preload clip metadata + lesson audio for a list of words (call before game start). */
export async function preloadWordsAudio(
  words: string[],
  onProgress?: (progress: { done: number; total: number; phase: 'metadata' | 'audio' }) => void,
): Promise<void> {
  const unique = Array.from(new Set(words));
  const lessonIds = new Set<string>();
  const pad = useSettingsStore.getState().settings.wordPlayOffset;
  let done = 0;

  await Promise.all(unique.map(async (word) => {
    const clip = await ensureWordClipCached(word, pad);
    if (clip) lessonIds.add(clip.lessonId);
    done += 1;
    onProgress?.({ done, total: unique.length, phase: 'metadata' });
  }));

  if (lessonIds.size === 0) return;

  const ids = Array.from(lessonIds);
  onProgress?.({ done: 0, total: ids.length, phase: 'audio' });
  await preloadLessonAudioAndWait(ids);
  // Warm main player for each lesson so switchSource hits cache more often on click.
  for (const id of ids) {
    switchSource(id);
    await new Promise<void>(resolve => waitForReady(getAudio(), resolve));
  }
  onProgress?.({ done: ids.length, total: ids.length, phase: 'audio' });
}

export interface PlayWordAudioOptions {
  padding?: number;
}

/** Async fallback — drives the bottom player bar via playClip. */
export async function playWordAudioCore(word: string, opts?: PlayWordAudioOptions): Promise<void> {
  const clip = await ensureWordClipCached(word, opts?.padding);
  if (!clip) return;
  useAudioStore.getState().playClip(clip);
}

/** Standard click/tap handler for game word playback (Safari-safe). */
export function playWordOnClickImpl(
  word: string,
  playWordAudio: (w: string) => Promise<void>,
) {
  primeWordAudioContext();
  primeHtmlAudio();
  if (playWordClipInGesture(word)) return;
  void warmWordAudio(word).then(() => playWordAudio(word));
}

export function useWordAudio() {
  const busyRef = useRef(false);
  const wordPlayOffset = useSettingsStore(s => s.settings.wordPlayOffset);

  const playWordAudio = useCallback(async (word: string, opts?: PlayWordAudioOptions) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await playWordAudioCore(word, { padding: opts?.padding ?? wordPlayOffset });
    } finally {
      busyRef.current = false;
    }
  }, [wordPlayOffset]);

  const playWordOnClick = useCallback((word: string) => {
    playWordOnClickImpl(word, playWordAudio);
  }, [playWordAudio]);

  return { playWordAudio, playWordOnClick, warmWordAudio };
}
