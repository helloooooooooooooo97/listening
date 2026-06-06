/** Automatic play duration tracking. */

import { postPlayHistory } from './api';

let _trackStart = 0;

let _getLessonInfo: () => { id: string; title: string } | null = () => null;

export function setLessonInfoProvider(fn: () => { id: string; title: string } | null) {
  _getLessonInfo = fn;
}

export function trackPlay() {
  _trackStart = Date.now();
}

export function flushTrack() {
  if (_trackStart === 0) return;
  const elapsed = Math.round((Date.now() - _trackStart) / 1000);
  _trackStart = 0;
  if (elapsed < 1) return;
  const info = _getLessonInfo();
  if (info) {
    postPlayHistory({
      audio_id: info.id,
      audio_title: info.title,
      duration_seconds: elapsed,
    }).catch(() => {});
  }
}
