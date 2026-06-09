/** Audio element singleton and lifecycle management. */
import { API_BASE } from './api';

let _audio: HTMLAudioElement | null = null;
export function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'auto';
  }
  return _audio;
}

let _currentSrc = '';

let _savedRate = 1;
export function getSavedRate() { return _savedRate; }
export function applyPlaybackRate(a: HTMLAudioElement = getAudio(), rate = _savedRate) {
  _savedRate = rate;
  if (a.defaultPlaybackRate !== rate) a.defaultPlaybackRate = rate;
  if (a.playbackRate !== rate) a.playbackRate = rate;
}
export function setSavedRate(r: number) {
  applyPlaybackRate(getAudio(), r);
}

export function switchSource(lessonId: string, onSwitch?: () => void): boolean {
  const url = `${API_BASE}/api/lessons/${lessonId}/audio`;
  if (_currentSrc === url) return false;
  onSwitch?.();
  _currentSrc = url;
  const a = getAudio();
  a.src = url;
  a.defaultPlaybackRate = _savedRate;
  a.load();
  // Chromium resets playbackRate to 1 on load(); restore it
  applyPlaybackRate(a);
  return true;
}

export function waitForReady(a: HTMLAudioElement, fn: () => void) {
  if (a.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) fn();
  else {
    const onReady = () => { a.removeEventListener('canplay', onReady); fn(); };
    a.addEventListener('canplay', onReady);
  }
}

export function findSentenceIndex(lesson: { transcript: { start: number }[] } | null, time: number): number {
  if (!lesson) return -1;
  for (let i = lesson.transcript.length - 1; i >= 0; i--) {
    if (time >= lesson.transcript[i].start - 0.05) return i;
  }
  return 0;
}

/**
 * Safely call audio.play() — Safari/WKWebView rejects the Promise when
 * auto-advancing between clips (different audio sources) without a user gesture.
 * We catch the rejection silently so the error doesn't bubble, and return
 * whether playback actually started.
 */
export function safePlay(a: HTMLAudioElement): Promise<boolean> {
  const p = a.play();
  if (p === undefined) return Promise.resolve(false);
  return p.then(() => true).catch((err: DOMException) => {
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
      // Safari: autoplay blocked on src change without user gesture.
      // Chrome/Firefox: AbortError when play() is interrupted by pause().
      // Both are expected in the clip-to-clip transition path.
      return false;
    }
    // Unexpected error — rethrow to let the error handler set the UI state
    throw err;
  });
}

// Preload pool
const _preloadPool = new Map<string, HTMLAudioElement>();
export function preloadLessonAudio(lessonIds: string[]) {
  for (const id of lessonIds) {
    if (_preloadPool.has(id)) continue;
    const el = new Audio();
    el.preload = 'auto';
    el.src = `${API_BASE}/api/lessons/${id}/audio`;
    el.load();
    el.volume = 0;
    _preloadPool.set(id, el);
  }
}
