import { getLessonById, getWordSentencesBatch } from './api';
import type { AudioClip, CollectionItem, ListeningLesson } from '../types/lesson';
import type { QueueItem } from '../stores/playlistStore';

type WordSentenceHit = {
  lesson_id: string;
  lesson_title: string;
  start_time: number;
  end_time: number;
};

type WordSentenceCache = Record<string, WordSentenceHit[] | { sentences: WordSentenceHit[] }>;

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
  // Promise-based cache: store the promise, not the result.
  // Multiple callers sharing the same lessonId get the same promise.
  const lessonCache: Record<string, Promise<ListeningLesson>> = {};

  const fetchLesson = (lessonId: string): Promise<ListeningLesson> => {
    if (!lessonCache[lessonId]) lessonCache[lessonId] = getLessonById(lessonId);
    return lessonCache[lessonId];
  };

  // Pre-fetch slow-path words in a single batch request
  const slowWords = [...new Set(
    items
      .filter(i => i.item_type === 'word' && !i.lesson_id)
      .map(i => i.title || i.item_ref)
      .filter(Boolean),
  )];
  let wordSentenceCache: WordSentenceCache = {};
  if (slowWords.length > 0) {
    const batchResult = await getWordSentencesBatch(slowWords, 'favorites,recent_plays');
    wordSentenceCache = batchResult.results;
  }

  const results = await Promise.all(
    items.map(item =>
      collectionItemToQueueItem(item, fetchLesson, wordSentenceCache).catch(() => null),
    ),
  );
  return results.filter((r): r is QueueItem => r !== null);
}

export async function collectionItemToQueueItem(
  item: CollectionItem,
  fetchLesson: (lessonId: string) => Promise<ListeningLesson> = getLessonById,
  wordSentenceCache?: WordSentenceCache,
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

  if (item.item_type === 'word') {
    const word = item.title || item.item_ref;
    if (!word) return null;

    // Fast path: collection item already has lesson_id — no API calls needed.
    // playQueueItem will add padding via queueItemToClip, preserving the
    // user click gesture for Safari autoplay (no async gap).
    if (item.lesson_id) {
      return {
        kind: 'word',
        lessonId: item.lesson_id,
        lessonTitle: item.lesson_title || item.subtitle || '',
        word,
        start: item.start_time || 0,
        end: item.end_time || (item.start_time || 0) + 5,
      };
    }

    // Slow path: use batch cache (single API call for all words) or fallback.
    let cached = wordSentenceCache?.[word];
    if (!cached && wordSentenceCache) {
      cached = wordSentenceCache[word.toLowerCase()];
    }
    const sentences = Array.isArray(cached) ? cached : cached?.sentences;
    if (!sentences?.length) return null;
    const sent = sentences[0];
    return {
      kind: 'word',
      lessonId: sent.lesson_id,
      lessonTitle: sent.lesson_title || item.lesson_title || item.subtitle || '',
      word,
      start: sent.start_time,
      end: sent.end_time,
    };
  }

  return null;
}
