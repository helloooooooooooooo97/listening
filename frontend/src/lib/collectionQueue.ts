import { getLessonById } from './api';
import type { AudioClip, CollectionItem, ListeningLesson } from '../types/lesson';
import type { QueueItem } from '../stores/playlistStore';

type ClipExtra = {
  lessonId?: string;
  lessonTitle?: string;
  start?: number;
  end?: number;
  text?: string;
  note?: string;
  color?: string;
};

function parseExtraData(extraData?: string): ClipExtra {
  if (!extraData) return {};
  try {
    const parsed = JSON.parse(extraData);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function numberOrFallback(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function lessonIdForItem(item: CollectionItem, extra: ClipExtra): string {
  if (item.lesson_id) return item.lesson_id;
  if (extra.lessonId) return extra.lessonId;
  return item.item_type === 'audio' ? item.item_ref : '';
}

function sentenceIndexForItem(item: CollectionItem): number {
  const tail = item.item_ref.split(':').pop();
  const index = Number.parseInt(tail || '0', 10);
  return Number.isFinite(index) ? index : 0;
}

function makeClip(item: CollectionItem, lesson: ListeningLesson | null, extra: ClipExtra): AudioClip | null {
  const lessonId = lessonIdForItem(item, extra);
  if (!lessonId) return null;

  const extraStart = numberOrFallback(extra.start, 0);
  const startTime = numberOrFallback(item.start_time, extraStart);
  const extraEnd = numberOrFallback(extra.end, 0);
  let endTime = numberOrFallback(item.end_time, extraEnd);
  if (endTime <= startTime) endTime = startTime + 10;
  if (endTime <= startTime) return null;

  return {
    id: item.item_ref || `collection-${item.id}`,
    lessonId,
    lessonTitle: item.lesson_title || extra.lessonTitle || lesson?.title || item.subtitle,
    startWordId: '',
    endWordId: '',
    startTime,
    endTime,
    text: item.title || extra.text || item.item_ref,
    note: item.subtitle || extra.note || '',
    color: extra.color || '#facc15',
    createdAt: item.added_at,
  };
}

export async function collectionItemsToQueueItems(items: CollectionItem[]): Promise<QueueItem[]> {
  const lessonCache: Record<string, ListeningLesson> = {};

  const fetchLesson = async (lessonId: string) => {
    if (!lessonCache[lessonId]) lessonCache[lessonId] = await getLessonById(lessonId);
    return lessonCache[lessonId];
  };

  const queueItems: QueueItem[] = [];
  for (const item of items) {
    const queueItem = await collectionItemToQueueItem(item, fetchLesson).catch(() => null);
    if (queueItem) queueItems.push(queueItem);
  }
  return queueItems;
}

export async function collectionItemToQueueItem(
  item: CollectionItem,
  fetchLesson: (lessonId: string) => Promise<ListeningLesson> = getLessonById,
): Promise<QueueItem | null> {
  const extra = parseExtraData(item.extra_data);
  const lessonId = lessonIdForItem(item, extra);

  if (item.item_type === 'audio') {
    if (!lessonId) return null;
    const lesson = await fetchLesson(lessonId);
    return { kind: 'lesson', lesson };
  }

  if (item.item_type === 'clip') {
    if (!lessonId) return null;
    const lesson = await fetchLesson(lessonId);
    const clip = makeClip(item, lesson, extra);
    return clip ? { kind: 'clip', clip, lesson } : null;
  }

  if (item.item_type === 'sentence') {
    if (!lessonId) return null;
    const sentenceIndex = sentenceIndexForItem(item);
    let lesson: ListeningLesson | null = null;
    let sentence = null as ListeningLesson['transcript'][number] | null;

    if (item.start_time <= 0 || item.end_time <= item.start_time || !item.title) {
      lesson = await fetchLesson(lessonId);
      sentence = lesson.transcript[sentenceIndex] || null;
    }

    const start = item.start_time > 0 ? item.start_time : sentence?.start || 0;
    let end = item.end_time > start ? item.end_time : sentence?.end || start + 5;
    if (end <= start) end = start + 5;

    return {
      kind: 'sentence',
      lessonId,
      lessonTitle: item.lesson_title || lesson?.title || item.subtitle,
      sentenceIndex,
      start,
      end,
      text: item.title || sentence?.text || '',
    };
  }

  return null;
}
