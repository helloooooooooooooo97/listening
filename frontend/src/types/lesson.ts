export type LoopMode = 'all' | 'sentence' | 'clip';

export interface TranscriptWord {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface TranscriptLine {
  id: string;
  start: number;
  end: number;
  text: string;
  note: string;
}

export interface ListeningLesson {
  id: string;
  title: string;
  subtitle: string;
  level: string;
  duration: number;
  audioFileName: string;
  sourceURL: string;
  textSourceURL: string;
  transcript: TranscriptLine[];
  words: TranscriptWord[];
}

export interface AudioClip {
  id: string;
  lessonId: string;
  lessonTitle: string;
  startWordId: string;
  endWordId: string;
  startTime: number;
  endTime: number;
  text: string;
  note: string;
  color: string;
  createdAt: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  level: string;
  duration: number;
  audioFileName: string;
  sourceURL: string;
  textSourceURL: string;
  sentenceCount: number;
  wordCount: number;
}

// ── Collections ──

export interface CollectionSummary {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_dynamic: boolean;
  dynamic_type: string | null;
  item_count: number;
  sort_order: number;
  created_at: string;
  updated_at?: string;
}

export interface CollectionItem {
  id: number;
  collection_id: number;
  item_type: 'audio' | 'clip' | 'sentence' | 'word';
  item_ref: string;
  lesson_id: string;
  lesson_title: string;
  title: string;
  subtitle: string;
  start_time: number;
  end_time: number;
  extra_data: string;
  sort_order: number;
  added_at: string;
}

export interface CollectionDetail extends CollectionSummary {
  items: CollectionItem[];
}
