/** Centralized API client — all fetch calls in one place with typed responses. */

import type { AudioClip, LessonSummary, ListeningLesson, CollectionSummary, CollectionItem, CollectionDetail } from '../types/lesson';

// ── Helpers ──

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

async function del(url: string): Promise<void> {
  const r = await fetch(url, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
}

// ── Lessons ──

export function getLessons(): Promise<LessonSummary[]> {
  return get<LessonSummary[]>('/api/lessons/');
}

export function getLessonById(id: string): Promise<ListeningLesson> {
  return get<ListeningLesson>(`/api/lessons/${id}`);
}

export function getLessonStats(): Promise<{ lessonCount: number; totalSentences: number; uniqueWords: number }> {
  return get('/api/lessons/stats');
}

// ── Clips ──

export function getClips(): Promise<AudioClip[]> {
  return get<AudioClip[]>('/api/clips/');
}

export function createClip(clip: {
  audio_id: string;
  audio_title: string;
  start_time: number;
  end_time: number;
  text: string;
  note: string;
  color?: string;
}): Promise<AudioClip> {
  return post<AudioClip>('/api/clips/', clip);
}

export function deleteClip(id: string): Promise<void> {
  return del(`/api/clips/${id}`);
}

// ── Progress ──

export function postDictation(data: {
  audio_id: string;
  audio_title: string;
  sentence_index: number;
  score: number;
  user_input: string;
  expected_text: string;
}): Promise<{ ok: boolean }> {
  return post('/api/progress/dictation', data);
}

export function postPlayHistory(data: {
  audio_id: string;
  audio_title: string;
  duration_seconds: number;
}): Promise<{ ok: boolean }> {
  return post('/api/progress/play-history', data);
}

export function getKnownWords(): Promise<string[]> {
  return get<string[]>('/api/progress/words');
}

export function setWordKnown(word: string, known: boolean): Promise<{ ok: boolean }> {
  return post('/api/progress/words', { word, known });
}

// ── Stats ──

export interface Overview {
  total_listening_seconds: number;
  completed_audios: number;
  total_audios: number;
  avg_dictation_score: number;
  dictation_total_sentences: number;
  words_mastered: number;
  total_words: number;
  clips_count: number;
  streak_days: number;
  today_seconds: number;
  yesterday_seconds: number;
}

export function getOverview(): Promise<Overview> {
  return get<Overview>('/api/stats/overview');
}

// ── Audio Detail Stats ──

export interface AudioDetailStats {
  audio_id: string;
  title: string;
  total_words: number;
  total_sentences: number;
  duration_seconds: number;
  known_words: number;
  listening_seconds: number;
  dictation_avg_score: number;
  dictation_count: number;
  completed: boolean;
  clips_count: number;
  last_position: number;
  last_practiced: string;
}

export function getAudioDetailStats(audioId: string): Promise<AudioDetailStats> {
  return get<AudioDetailStats>(`/api/stats/audio-detail/${encodeURIComponent(audioId)}`);
}

export interface DailyDay { date: string; seconds: number; }

export function getDailyTime(days: number): Promise<{ days: DailyDay[] }> {
  return get(`/api/stats/daily-time?days=${days}`);
}

export interface DictationScore { date: string; audio: string; score: number; }

export function getDictationTrend(limit = 20): Promise<{ scores: DictationScore[] }> {
  return get(`/api/stats/dictation-trend?limit=${limit}`);
}

export interface DictRecord {
  id: number;
  sentence_index: number;
  score: number;
  user_input: string;
  expected_text: string;
  created_at: string;
}

export interface AudioGroup {
  audio_id: string;
  audio_title: string;
  avg_score: number;
  total_sentences: number;
  last_practiced: string;
  records: DictRecord[];
}

export function getDictationRecords(limit = 500): Promise<{ audios: AudioGroup[] }> {
  return get(`/api/stats/dictation-records?limit=${limit}`);
}

export interface AudioProgress {
  id: string;
  title: string;
  completed: boolean;
  last_position: number;
  total_seconds: number;
  dictation_score: number | null;
}

export function getAudioProgress(): Promise<{ audios: AudioProgress[] }> {
  return get('/api/stats/audio-progress');
}

export interface Activity {
  type: string;
  time: string;
  detail: string;
}

export function getRecentActivity(limit = 15): Promise<{ activities: Activity[] }> {
  return get(`/api/stats/recent-activity?limit=${limit}`);
}

// ── Words ──

export interface WordItem {
  word: string;
  count: number;
  lessons: { id: string; title: string; occurrences: number[] }[];
}

// ── Favorites ──

export interface FavoriteItem {
  id: number;
  item_id: string;
  item_type: 'audio' | 'clip' | 'word';
  title: string;
  subtitle: string;
  extra_data: string;
  created_at: string;
}

export function getFavorites(): Promise<FavoriteItem[]> {
  return get<FavoriteItem[]>('/api/favorites/');
}

export function addFavorite(data: {
  item_id: string;
  item_type: string;
  title: string;
  subtitle?: string;
  extra_data?: string;
}): Promise<FavoriteItem | { ok: false; error: string }> {
  return post('/api/favorites/', data);
}

export function removeFavorite(id: number): Promise<{ ok: boolean }> {
  return fetch(`/api/favorites/${id}`, { method: 'DELETE' }).then(r => r.json());
}

export function removeFavoriteByItem(item_type: string, item_id: string): Promise<{ ok: boolean }> {
  return fetch(`/api/favorites/by-item/${item_type}/${encodeURIComponent(item_id)}`, { method: 'DELETE' }).then(r => r.json());
}

// ── Dictation Sentences ──

export interface SentenceDictation {
  index: number;
  avg_score: number;
  count: number;
  last_score: number;
  wrong_indices: number[];
}

export function getDictationSentences(audioId: string): Promise<{ sentences: SentenceDictation[] }> {
  return get(`/api/stats/dictation-sentences/${encodeURIComponent(audioId)}`);
}

export function getWords(params: {
  q?: string;
  sort?: string;
  order?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ total: number; words: WordItem[] }> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.sort) sp.set('sort', params.sort);
  if (params.order) sp.set('order', params.order);
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.offset) sp.set('offset', String(params.offset));
  const qs = sp.toString();
  return get(`/api/words${qs ? `?${qs}` : ''}`);
}

// ── Collections ──

export function getCollections(): Promise<CollectionSummary[]> {
  return get<CollectionSummary[]>('/api/collections/');
}

export function getCollection(id: number): Promise<CollectionDetail> {
  return get<CollectionDetail>(`/api/collections/${id}`);
}

export function createCollection(data: { name: string; icon?: string; color?: string }): Promise<CollectionSummary> {
  return post<CollectionSummary>('/api/collections/', data);
}

export function updateCollection(id: number, data: { name?: string; icon?: string; color?: string }): Promise<CollectionSummary> {
  return fetch(`/api/collections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json());
}

export function deleteCollection(id: number): Promise<{ ok: boolean }> {
  return del(`/api/collections/${id}`).then(() => ({ ok: true }));
}

export function refreshCollection(id: number): Promise<{ items: CollectionItem[]; item_count: number }> {
  return post(`/api/collections/${id}/refresh`, {});
}

export function addCollectionItem(collectionId: number, data: {
  item_type: string;
  item_ref: string;
  lesson_id?: string;
  lesson_title?: string;
  title?: string;
  subtitle?: string;
  start_time?: number;
  end_time?: number;
  extra_data?: string;
}): Promise<CollectionItem> {
  return post<CollectionItem>(`/api/collections/${collectionId}/items`, data);
}

export function removeCollectionItem(collectionId: number, itemId: number): Promise<{ ok: boolean }> {
  return del(`/api/collections/${collectionId}/items/${itemId}`).then(() => ({ ok: true }));
}

export function reorderCollectionItems(collectionId: number, itemIds: number[]): Promise<{ ok: boolean }> {
  return fetch(`/api/collections/${collectionId}/items/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_ids: itemIds }),
  }).then(r => r.json());
}

export function clearCollectionItems(collectionId: number): Promise<{ ok: boolean }> {
  return del(`/api/collections/${collectionId}/items`).then(() => ({ ok: true }));
}

// ── Translation Cache ──

export interface TranslationCacheEntry {
  id: number;
  source_text: string;
  translated_text: string;
  source_type: string;
  extra_data: string | null;
}

export function getCachedTranslation(sourceType: string, text: string): Promise<TranslationCacheEntry | null> {
  return get<TranslationCacheEntry | null>(`/api/translations/${sourceType}/${encodeURIComponent(text)}`);
}

export function saveTranslation(data: {
  source_text: string;
  translated_text: string;
  source_type: string;
  extra_data?: string;
}): Promise<TranslationCacheEntry> {
  return post<TranslationCacheEntry>('/api/translations', data);
}
