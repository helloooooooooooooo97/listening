import { useEffect, useMemo, useState } from 'react';
import { HiBookmark, HiHeart, HiPencil, HiPlay, HiTag } from 'react-icons/hi2';
import type { AudioClip, ListeningLesson } from '../types/lesson';
import { getDictationRecords, type AudioGroup, type DictRecord } from '../lib/api';
import { useAudioStore } from '../stores/audioStore';
import { useClipsStore } from '../stores/clipsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import TranscriptView from './TranscriptView';

type SideTab = 'clips' | 'dictation' | 'favorites';

interface Props {
  lesson: ListeningLesson;
  currentTime: number;
  highlightSentence?: number;
  onSeek: (time: number) => void;
  onOpenDictation: (sentenceIndex: number) => void;
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  return `${m}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  } catch {
    return iso?.slice(0, 10) || '';
  }
}

export default function PlaybackDetailTabs({
  lesson,
  currentTime,
  highlightSentence,
  onSeek,
  onOpenDictation,
}: Props) {
  const [sideTab, setSideTab] = useState<SideTab>('clips');
  const [dictGroups, setDictGroups] = useState<AudioGroup[]>([]);
  const [loadingDictation, setLoadingDictation] = useState(false);
  const clips = useClipsStore(s => s.clips);
  const favItems = useFavoritesStore(s => s.items);
  const playClip = useAudioStore(s => s.playClip);

  const lessonClips = useMemo(
    () => clips.filter(c => c.lessonId === lesson.id),
    [clips, lesson.id]
  );

  const lessonFavs = useMemo(() => favItems.filter(i =>
    i.item_type === 'word' ||
    (i.item_type === 'clip' && (() => {
      try {
        const d = JSON.parse(i.extra_data || '{}');
        return d.lessonId === lesson.id;
      } catch {
        return false;
      }
    })())
  ), [favItems, lesson.id]);

  useEffect(() => {
    let cancelled = false;
    setLoadingDictation(true);
    getDictationRecords(200)
      .then(d => {
        if (!cancelled) setDictGroups(d.audios.filter(g => g.audio_id === lesson.id));
      })
      .catch(() => {
        if (!cancelled) setDictGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDictation(false);
      });
    return () => { cancelled = true; };
  }, [lesson.id]);

  const dictationRecords = useMemo(
    () => dictGroups.flatMap(group => group.records),
    [dictGroups]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        <TranscriptView
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          lines={lesson.transcript}
          words={lesson.words}
          currentTime={currentTime}
          onSeek={onSeek}
          onOpenDictation={onOpenDictation}
        />
      </section>

      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-[var(--border-secondary)] overflow-hidden bg-[var(--bg-primary)]">
          <div className="flex border-b border-[var(--border-secondary)] p-1">
            <SideTabButton active={sideTab === 'clips'} icon={<HiBookmark size={13} />} label="片段" count={lessonClips.length} onClick={() => setSideTab('clips')} />
            <SideTabButton active={sideTab === 'dictation'} icon={<HiPencil size={13} />} label="听写" count={dictationRecords.length} onClick={() => setSideTab('dictation')} />
            <SideTabButton active={sideTab === 'favorites'} icon={<HiHeart size={13} />} label="收藏" count={lessonFavs.length} onClick={() => setSideTab('favorites')} />
          </div>

          <div className="max-h-[calc(100vh-220px)] overflow-y-auto divide-y divide-[var(--border-secondary)]">
            {sideTab === 'dictation' && (
              loadingDictation ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-[var(--accent)] rounded-full animate-spin" />
                </div>
              ) : dictationRecords.length === 0 ? (
                <p className="text-center text-tertiary text-sm py-16">暂无听写记录</p>
              ) : (
                dictationRecords.map((r: DictRecord) => (
                  <button
                    key={r.id}
                    onClick={() => onOpenDictation(r.sentence_index)}
                    className={`w-full text-left px-5 py-3 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${highlightSentence === r.sentence_index ? 'bg-[var(--accent-soft)]' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-secondary">句子 {r.sentence_index + 1}</span>
                      <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
                        r.score >= 80 ? 'text-emerald-500 bg-emerald-500/10' :
                        r.score >= 50 ? 'text-amber-500 bg-amber-500/10' :
                        'text-red-500 bg-red-500/10'
                      }`}>{r.score}%</span>
                    </div>
                    {r.user_input && <p className="text-sm text-secondary mb-1">{r.user_input}</p>}
                    {r.expected_text && r.user_input && r.score < 100 && (
                      <p className="text-xs text-tertiary line-through">{r.expected_text}</p>
                    )}
                    <p className="text-[10px] text-tertiary mt-1">{fmtDate(r.created_at)}</p>
                  </button>
                ))
              )
            )}

            {sideTab === 'clips' && (
              lessonClips.length === 0 ? (
                <p className="text-center text-tertiary text-sm py-16">暂无片段</p>
              ) : lessonClips.map((clip: AudioClip) => {
                const d = clip.endTime - clip.startTime;
                return (
                  <button
                    key={clip.id}
                    onClick={() => playClip(clip, lesson)}
                    className="w-full text-left px-5 py-3 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--clip-gradient)' }}>
                      <HiBookmark size={13} className="text-tertiary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-secondary leading-relaxed line-clamp-2">"{clip.text}"</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-tertiary">{d.toFixed(1)}s</span>
                        <span className="text-xs text-tertiary">{fmt(clip.startTime)} - {fmt(clip.endTime)}</span>
                        {clip.note && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-secondary">{clip.note}</span>}
                      </div>
                    </div>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-tertiary bg-[var(--bg-tertiary)]">
                      <HiPlay size={12} />
                    </span>
                  </button>
                );
              })
            )}

            {sideTab === 'favorites' && (
              lessonFavs.length === 0 ? (
                <p className="text-center text-tertiary text-sm py-16">暂无收藏</p>
              ) : lessonFavs.map(item => (
                <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: item.item_type === 'word' ? 'var(--word-gradient)' : 'var(--clip-gradient)' }}>
                    {item.item_type === 'word' ? <HiTag size={13} className="text-primary" /> : <HiBookmark size={13} className="text-tertiary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">{item.title}</p>
                    <p className="text-xs text-tertiary">{item.subtitle}</p>
                  </div>
                  <HiHeart size={13} className="text-[var(--accent)] flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SideTabButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
        active ? 'bg-[var(--bg-active)] text-primary' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count > 0 && <span className="text-[10px] opacity-70">{count}</span>}
    </button>
  );
}

