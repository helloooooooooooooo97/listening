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
  createdAt: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  subtitle: string;
  level: string;
  duration: number;
  audioFileName: string;
  sourceURL: string;
  textSourceURL: string;
  sentenceCount: number;
  wordCount: number;
}
