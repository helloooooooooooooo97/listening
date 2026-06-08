import type { AudioClip } from '../types/lesson';
import type { QueueItem } from '../stores/playlistStore';

const DEFAULT_CLIP_COLOR = '#facc15';

export function queueItemToClip(item: Extract<QueueItem, { kind: 'sentence' | 'word' }>, wordOffset = 2): AudioClip {
  if (item.kind === 'sentence') {
    return {
      id: `q-s-${item.lessonId}-${item.sentenceIndex}`,
      lessonId: item.lessonId,
      lessonTitle: item.lessonTitle,
      startWordId: '',
      endWordId: '',
      startTime: item.start,
      endTime: item.end,
      text: item.text,
      note: '',
      color: DEFAULT_CLIP_COLOR,
      createdAt: '',
    };
  }

  return {
    id: `q-w-${item.lessonId}-${item.word}`,
    lessonId: item.lessonId,
    lessonTitle: item.lessonTitle,
    startWordId: '',
    endWordId: '',
    startTime: Math.max(0, item.start - wordOffset),
    endTime: item.end + wordOffset,
    text: item.word,
    note: 'word',
    color: DEFAULT_CLIP_COLOR,
    createdAt: '',
  };
}
