/** Centralized API client — all fetch calls in one place with typed responses. */

import type { AudioClip, LessonSummary, ListeningLesson, CollectionSummary, CollectionItem, CollectionDetail } from '../types/lesson';

// ── API Base URL (absolute URL for Tauri desktop mode) ──
export const API_BASE = 'http://127.0.0.1:8000';

// ── Helpers ──

async function get<T>(url: string): Promise<T> {
  url = API_BASE + url;
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

async function post<T>(url: string, body: unknown): Promise<T> {
  url = API_BASE + url;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

async function put<T>(url: string, body: unknown): Promise<T> {
  url = API_BASE + url;
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return r.json();
}

async function del(url: string): Promise<void> {
  url = API_BASE + url;
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

export function updateClip(id: string, data: { note?: string; color?: string; text?: string }): Promise<AudioClip> {
  return put<AudioClip>(`/api/clips/${id}`, data);
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
  due_words: number;
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
  last_practiced: number;
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
  created_at: number;
}

export interface AudioGroup {
  audio_id: string;
  audio_title: string;
  avg_score: number;
  total_sentences: number;
  last_practiced: number;
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
  time: number;
  detail: string;
}

export function getRecentActivity(limit = 15): Promise<{ activities: Activity[] }> {
  return get(`/api/stats/recent-activity?limit=${limit}`);
}

// ── Words ──

/** Lightweight word summary returned by list endpoint (no timestamps). */
export interface WordSummary {
  word: string;
  count: number;
  tags?: string[];
}

/** Full word detail with audio timestamps, fetched on demand. */
export interface WordDetail {
  word: string;
  count: number;
  lessons: { id: string; title: string; occurrences: number[] }[];
  tags?: string[];
}

/** Dictionary entry imported from exam word lists. */
export interface WordDictionary {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  tags: string[];
}

// ── Favorites ──

export interface FavoriteItem {
  id: number;
  item_id: string;
  item_type: 'audio' | 'clip' | 'word';
  title: string;
  subtitle: string;
  extra_data: string;
  created_at: number;
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
  return fetch(`${API_BASE}/api/favorites/${id}`, { method: 'DELETE' }).then(r => r.json());
}

export function removeFavoriteByItem(item_type: string, item_id: string): Promise<{ ok: boolean }> {
  return fetch(`${API_BASE}/api/favorites/by-item/${item_type}/${encodeURIComponent(item_id)}`, { method: 'DELETE' }).then(r => r.json());
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
  return get<{ sentences: SentenceDictation[] }>(`/api/stats/dictation-sentences/${encodeURIComponent(audioId)}`);
}

export function getWords(params: {
  q?: string;
  sort?: string;
  order?: string;
  limit?: number;
  offset?: number;
  category?: string;
  collection?: string;
  exam?: string;
} = {}): Promise<{ total: number; words: WordSummary[] }> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.sort) sp.set('sort', params.sort);
  if (params.order) sp.set('order', params.order);
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.offset) sp.set('offset', String(params.offset));
  if (params.category) sp.set('category', params.category);
  if (params.collection) sp.set('collection', params.collection);
  if (params.exam) sp.set('exam', params.exam);
  const qs = sp.toString();
  return get(`/api/words${qs ? `?${qs}` : ''}`);
}

/** Fetch full word detail with lesson occurrences (audio timestamps). */
export function getWordDetail(word: string): Promise<WordDetail> {
  return get<WordDetail>(`/api/words/${encodeURIComponent(word)}`);
}

/** Fetch dictionary entry: pronunciation, part of speech, definition, tags. */
export function getDictionaryEntry(word: string): Promise<WordDictionary> {
  return get<WordDictionary>(`/api/dictionary/${encodeURIComponent(word)}`);
}

// ── Review System ──

export interface DueWord {
  word: string;
  reviewed_count: number;
  last_score: number | null;
  reviewed_at: string;
}

export function getDueWords(limit = 20): Promise<{ words: DueWord[] }> {
  return get(`/api/progress/words/due?limit=${limit}`);
}

export function getDueWordsCount(): Promise<{ count: number }> {
  return get('/api/progress/words/due-count');
}

export function submitWordReview(word: string, score: number): Promise<{ ok: boolean }> {
  return post('/api/progress/words/review', { word, score });
}

// ── Batch Review ──

export interface BatchReviewResult {
  reviewed: number;
  correct: number;
}

export function submitBatchReview(sessionId: string, source: string, mode: string, results: { word: string; correct: boolean; score: number; session_index: number }[]): Promise<BatchReviewResult> {
  return post('/api/progress/review/batch', { session_id: sessionId, source, mode, results });
}

export function getReviewHistory(limit = 50): Promise<{ sessions: any[] }> {
  return get(`/api/progress/review/history?limit=${limit}`);
}

export function getReviewStats(): Promise<{ today_reviewed: number; today_correct: number; streak: number }> {
  return get('/api/progress/review/stats');
}

// ── Word Sentences (for fill-in-the-blank review) ──

export interface WordSentence {
  lesson_id: string;
  lesson_title: string;
  sentence_text: string;
  start_time: number;
  end_time: number;
}

export function getWordSentences(word: string, prioritize?: string): Promise<{ sentences: WordSentence[] }> {
  let url = `/api/words/${encodeURIComponent(word)}/sentences`;
  if (prioritize) url += `?prioritize=${encodeURIComponent(prioritize)}`;
  return get(url);
}

// ── Daily Words ──

export interface TodayWord {
  word: string;
  audio_count: number;
  audio_titles: string;
  known: number;
  last_score: number | null;
  reviewed_at: string | null;
}

export interface TodayStats {
  total_words: number;
  audio_count: number;
  reviewed_count: number;
}

export function getTodayWords(): Promise<{ words: TodayWord[] }> {
  return get('/api/progress/daily-words/today');
}

export function getTodayStats(): Promise<TodayStats> {
  return get('/api/progress/daily-words/stats');
}

export function recordListenedWords(data: {
  words: string[];
  audio_id: string;
  audio_title: string;
}): Promise<{ ok: boolean }> {
  return post('/api/progress/listened-words', data);
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
  return fetch(`${API_BASE}/api/collections/${id}`, {
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
  return fetch(`${API_BASE}/api/collections/${collectionId}/items/reorder`, {
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

// ── Card system types ──

export interface CardMeta {
  id: string;
  name: string;
  title: string;
  motto: string;
  rarity: string;
  png: string;
  keywords: string[];
  vocab_signature: string[];
  obtained: boolean;
  season: number;
}

export interface DeckMeta {
  season: number;
  title: string;
  subtitle?: string;
  theme?: string;
}

export interface CardListResponse {
  deck: DeckMeta;
  cards: CardMeta[];
  total: number;
  obtained: number;
}

export interface DrawStatusResponse {
  can_draw: boolean;
  can_afford: boolean;
  balance: number;
  draw_cost: number;
  new_words_since_last_draw: number;
  min_new_words: number;
  qualified_candidates: number;
  min_qualified_cards: number;
  candidates: DrawCandidate[];
}

export interface DrawCandidate {
  card_id: string;
  name: string;
  match_score: number;
  hits: number;
  total: number;
  title?: string;
  motto?: string;
  rarity?: string;
  png?: string;
}

export interface DrawWord {
  word: string;
  deck: string;
}

export interface DrawResponse {
  draw_id: string;
  words: DrawWord[];
  new_words_since_last_draw: number;
  balance: number;
  draw_cost: number;
}

export interface CurrencyBalance {
  balance: number;
  earned: number;
  spent: number;
}

export interface CurrencyTransaction {
  id: number;
  amount: number;
  balance_after: number;
  source: string;
  ref_id: string;
  ref_summary: string;
  created_at: number;
}

export interface EarningSource {
  source: string;
  total: number;
  count: number;
}

export interface SyncResponse {
  settled: number;
  balance: number;
}

export interface DrawPickResponse {
  success: boolean;
  card: {
    id: string;
    name: string;
    title: string;
    motto: string;
    rarity: string;
    png: string;
    keywords: string[];
    match_score: number;
  };
}

export interface UnlockResponse {
  success: boolean;
  card_id: string;
  match_score: number;
}

// ── Card system API ──

const CARD_IMG = API_BASE + '/api/cards/image';

export function cardImageUrl(filename: string): string {
  return `${CARD_IMG}/${filename}.png`;
}

export function getCardList(): Promise<CardListResponse> {
  return get<CardListResponse>('/api/cards/list');
}

export function getDrawStatus(): Promise<DrawStatusResponse> {
  return get<DrawStatusResponse>('/api/cards/draw/status');
}

export function performDraw(): Promise<DrawResponse> {
  return post<DrawResponse>('/api/cards/draw', {});
}

export function pickDrawWord(drawId: string, word: string): Promise<DrawPickResponse> {
  return post<DrawPickResponse>('/api/cards/draw/pick', { draw_id: drawId, word });
}

export function unlockCard(cardId: string, obtainedBy = 'draw'): Promise<UnlockResponse> {
  return post<UnlockResponse>(`/api/cards/collection/${cardId}`, { obtained_by: obtainedBy });
}

// ── Currency API ──

export function getCurrencyBalance(): Promise<CurrencyBalance> {
  return get<CurrencyBalance>('/api/currency/balance');
}

export function getCurrencyTransactions(source?: string): Promise<{ transactions: CurrencyTransaction[]; total: number }> {
  const params = source ? `?source=${source}` : '';
  return get<{ transactions: CurrencyTransaction[]; total: number }>(`/api/currency/transactions${params}`);
}

export function getEarningToday(): Promise<{ date: string; sources: EarningSource[] }> {
  return get<{ date: string; sources: EarningSource[] }>('/api/currency/earning-today');
}

export function syncCurrency(): Promise<SyncResponse> {
  return post<SyncResponse>('/api/currency/sync', {});
}
