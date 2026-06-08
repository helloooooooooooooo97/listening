/** Audio element singleton and lifecycle management. */

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
export function setSavedRate(r: number) { _savedRate = r; }

export function switchSource(lessonId: string, onSwitch?: () => void): boolean {
  const url = `/api/lessons/${lessonId}/audio`;
  if (_currentSrc === url) return false;
  onSwitch?.();
  _currentSrc = url;
  const a = getAudio();
  a.src = url;
  a.load();
  // Chromium resets playbackRate to 1 on load(); restore it
  a.playbackRate = _savedRate;
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

// Preload pool
const _preloadPool = new Map<string, HTMLAudioElement>();
export function preloadLessonAudio(lessonIds: string[]) {
  for (const id of lessonIds) {
    if (_preloadPool.has(id)) continue;
    const el = new Audio();
    el.preload = 'auto';
    el.src = `/api/lessons/${id}/audio`;
    el.load();
    el.volume = 0;
    _preloadPool.set(id, el);
  }
}
