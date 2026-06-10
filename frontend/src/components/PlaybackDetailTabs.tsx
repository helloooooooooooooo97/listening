import { useEffect, useMemo, useState } from 'react';
import { HiBookmark, HiHeart, HiPencil, HiTag, HiChevronLeft, HiChevronRight, HiTrash, HiArrowDownTray, HiPlay, HiSparkles, HiBookOpen } from 'react-icons/hi2';
import type { AudioClip, ListeningLesson } from '../types/lesson';
import { getDictationRecords, getKnownWords, setWordKnown, type AudioGroup, type DictRecord } from '../lib/api';
import { alignDictation } from '../lib/dictationAligner';
import { useAudioStore } from '../stores/audioStore';
import { useClipsStore } from '../stores/clipsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useToastStore } from '../stores/toastStore';
import ReviewModal from './words/ReviewModal';
import { useSettingsStore } from '../stores/settingsStore';
import type { WordResult } from '../stores/dictationStore';
import { useClipAnalysis } from '../hooks/useClipAnalysis';
import WordBadges from './dictation/WordBadges';
import TranscriptView from './TranscriptView';
import ClipActions from './ClipActions';
import ClipAnalysisModal from './ClipAnalysisModal';

type SideTab = 'clips' | 'dictation' | 'favorites' | 'words';

interface Props {
  lesson: ListeningLesson;
  currentTime: number;
  onSeek: (time: number) => void;
  onOpenDictation: (sentenceIndex: number) => void;
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  return `${m}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
}

export default function PlaybackDetailTabs({
  lesson,
  currentTime,
  onSeek,
  onOpenDictation,
}: Props) {
  const [sideTab, setSideTab] = useState<SideTab>('clips');
  const [dictGroups, setDictGroups] = useState<AudioGroup[]>([]);
  const [loadingDictation, setLoadingDictation] = useState(false);
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [clipSort, setClipSort] = useState<'time' | 'date'>('time');
  const [expandedSentences, setExpandedSentences] = useState<Set<number>>(new Set());
  const [wordSearch, setWordSearch] = useState('');
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [wordsReviewOpen, setWordsReviewOpen] = useState(false);
  const clips = useClipsStore(s => s.clips);
  const removeClip = useClipsStore(s => s.removeClip);
  const updateClip = useClipsStore(s => s.updateClip);
  const favItems = useFavoritesStore(s => s.items);
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const playClip = useAudioStore(s => s.playClip);
  const audioMode = useAudioStore(s => s.mode);
  const addToast = useToastStore(s => s.addToast);
  const addToQueue = usePlaylistStore(s => s.addToQueue);
  const playClipsFrom = usePlaylistStore(s => s.playClipsFrom);
  const activeClipId = audioMode.kind === 'clip' ? audioMode.clip.id : null;

  const lessonClips = useMemo(() => {
    const filtered = clips.filter(c => c.lessonId === lesson.id);
    if (clipSort === 'date') return [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return [...filtered].sort((a, b) => a.startTime - b.startTime);
  }, [clips, lesson.id, clipSort]);

  const { clipAnalyses, analyzingClips, viewingAnalysis, setViewingAnalysis, handleAnalyze } = useClipAnalysis(lessonClips);
  const lyricDisplayMode = useSettingsStore(s => s.settings.lyricDisplayMode);
  const translationEnabled = useSettingsStore(s => s.settings.translationEnabled);
  const setTranslationEnabled = useSettingsStore(s => s.setTranslationEnabled);

  const handleExportClips = () => {
    const text = lessonClips.map(c =>
      `[${fmt(c.startTime)}-${fmt(c.endTime)}] ${c.text}${c.note ? ' (' + c.note + ')' : ''}`
    ).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      addToast(`已复制 ${lessonClips.length} 个片段`, 'success');
    }).catch(() => {});
  };


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

  // Load known words
  useEffect(() => {
    getKnownWords().then(words => setKnownWords(new Set(words))).catch(() => {});
  }, []);

  // Compute lesson words (deduplicated with timestamps)
  const lessonWords = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const w of lesson.words) {
      const existing = map.get(w.text) || [];
      existing.push(w.start);
      map.set(w.text, existing);
    }
    const filtered = wordSearch
      ? Array.from(map.entries()).filter(([word]) => word.toLowerCase().includes(wordSearch.toLowerCase()))
      : Array.from(map.entries());
    return filtered.map(([word, times]) => ({ word, times }));
  }, [lesson.words, wordSearch]);

  const dictationRecords = useMemo(
    () => dictGroups.flatMap(group => group.records),
    [dictGroups]
  );

  // Group dictation by sentence for overview display
  function computeWordResults(expected: string, actual: string): WordResult[] {
    return alignDictation(expected.split(/\s+/), actual.split(/\s+/));
  }

  const dictationBySentence = useMemo(() => {
    const bySentence = new Map<number, { best: DictRecord; records: DictRecord[] }>();
    for (const r of dictationRecords) {
      const existing = bySentence.get(r.sentence_index);
      if (!existing) {
        bySentence.set(r.sentence_index, { best: r, records: [r] });
      } else {
        if (r.score > existing.best.score) existing.best = r;
        existing.records.push(r);
      }
    }
    return lesson.transcript.map((sent, idx) => {
      const data = bySentence.get(idx);
      const best = data?.best;
      const wordResults = best?.user_input && best?.expected_text
        ? computeWordResults(best.expected_text, best.user_input)
        : null;
      return { idx, text: sent.text, bestScore: best?.score, recordCount: data?.records.length ?? 0, wordResults };
    });
  }, [dictationRecords, lesson.transcript]);

  return (
    <><div className={`grid gap-6 ${collapsed ? 'lg:grid-cols-[minmax(0,1fr)_48px]' : 'lg:grid-cols-[minmax(0,1fr)_360px]'} transition-all duration-300`}>
      <section className="min-w-0">
        {/* Lyric display mode toggle */}
        <div className="flex items-center gap-0.5 px-1 py-1.5 mb-1 border-b border-[var(--border-secondary)]">
          <button onClick={() => setTranslationEnabled(!translationEnabled)}
            className={`text-[11px] px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
              translationEnabled ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-medium' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
            }`}
            title="AI 翻译">
            <HiSparkles size={11} />
            <span>译</span>
          </button>
          <span className="w-px h-4 bg-[var(--border-secondary)] mx-1" />
          {([
            { mode: 'bilingual' as const, label: '中英', tip: '中英对照' },
            { mode: 'english-only' as const, label: '仅英文', tip: '仅显示英文' },
            { mode: 'chinese-only' as const, label: '仅中文', tip: '仅显示中文' },
            { mode: 'hover-reveal' as const, label: '悬浮', tip: '悬浮显示翻译' },
          ] as const).map(({ mode, label, tip }) => (
            <button key={mode} onClick={() => { const s = useSettingsStore.getState(); s.setLyricDisplayMode(mode); }}
              className={`text-[11px] px-2 py-1 rounded-md transition-colors cursor-pointer ${
                lyricDisplayMode === mode
                  ? 'bg-[var(--bg-active)] text-primary font-medium'
                  : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
              }`}
              title={tip}>
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-[10px] text-tertiary">
            {lyricDisplayMode === 'bilingual' ? '中英对照' :
             lyricDisplayMode === 'english-only' ? '仅英文' :
             lyricDisplayMode === 'chinese-only' ? '仅中文' : '悬浮显示'}
          </span>
        </div>
        <TranscriptView
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          lines={lesson.transcript}
          words={lesson.words}
          currentTime={currentTime}
          onSeek={onSeek}
          onOpenDictation={onOpenDictation}
          hoveredClipId={hoveredClipId}
          activeClipId={activeClipId}
          activeTab={sideTab}
          dictationWordResults={dictationBySentence.map(s => s.wordResults)}
          lyricDisplayMode={lyricDisplayMode}
          translationEnabled={translationEnabled}
        />
      </section>

      <aside className={`min-w-0 lg:sticky lg:top-4 lg:self-start transition-all duration-300 ${collapsed ? 'max-lg:hidden' : ''}`}>
        {collapsed ? (
          /* Collapsed: icon-only tabs */
          <div className="rounded-xl border border-[var(--border-secondary)] overflow-hidden bg-[var(--bg-primary)]">
            <button onClick={() => setCollapsed(false)}
              className="w-full p-1.5 flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-b border-[var(--border-secondary)]">
              <HiChevronLeft size={14} />
            </button>
            <SideTabIcon active={sideTab === 'clips'} icon={<HiBookmark size={14} />} onClick={() => setSideTab('clips')} />
            <SideTabIcon active={sideTab === 'dictation'} icon={<HiPencil size={14} />} onClick={() => setSideTab('dictation')} />
            <SideTabIcon active={sideTab === 'favorites'} icon={<HiHeart size={14} />} onClick={() => setSideTab('favorites')} />
            <SideTabIcon active={sideTab === 'words'} icon={<HiBookOpen size={14} />} onClick={() => setSideTab('words')} />
          </div>
        ) : (
          /* Expanded: full sidebar */
          <div className="rounded-xl border border-[var(--border-secondary)] overflow-hidden bg-[var(--bg-primary)]">
            <div className="flex border-b border-[var(--border-secondary)] p-1">
              <SideTabButton active={sideTab === 'clips'} icon={<HiBookmark size={13} />} label="片段" count={lessonClips.length} onClick={() => setSideTab('clips')} />
              <SideTabButton active={sideTab === 'dictation'} icon={<HiPencil size={13} />} label="听写" count={dictationRecords.length} onClick={() => setSideTab('dictation')} />
              <SideTabButton active={sideTab === 'favorites'} icon={<HiHeart size={13} />} label="收藏" count={lessonFavs.length} onClick={() => setSideTab('favorites')} />
              <SideTabButton active={sideTab === 'words'} icon={<HiBookOpen size={13} />} label="单词" count={lessonWords.length} onClick={() => setSideTab('words')} />
              <button onClick={() => setCollapsed(true)}
                className="px-1.5 text-tertiary hover:text-secondary transition-colors cursor-pointer flex-shrink-0">
                <HiChevronRight size={13} />
              </button>
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
                dictationBySentence.map(({ idx, text, bestScore, recordCount, wordResults }) => {
                  if (recordCount === 0) {
                    return (
                      <div key={idx} className="px-5 py-2.5 flex items-start gap-3 opacity-30">
                        <span className="text-xs text-tertiary w-5 text-right flex-shrink-0 pt-0.5">{idx + 1}</span>
                        <p className="text-sm text-secondary leading-relaxed line-clamp-2 flex-1">{text}</p>
                        <span className="text-[10px] text-tertiary flex-shrink-0">未练</span>
                      </div>
                    );
                  }
                  const s = bestScore ?? 0;
                  const scoreCls = s >= 80 ? 'text-emerald-500 bg-emerald-500/10' : s >= 50 ? 'text-amber-500 bg-amber-500/10' : 'text-red-500 bg-red-500/10';
                  const isExpanded = expandedSentences.has(idx);
                  return (
                    <div key={idx}>
                      <div
                        onClick={() => {
                          const sent = lesson.transcript[idx]; if (sent) onSeek(sent.start);
                          setExpandedSentences(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
                        }}
                        className="px-5 py-2.5 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-start gap-3 group"
                      >
                        <span className="text-xs text-tertiary w-5 text-right flex-shrink-0 pt-0.5">{idx + 1}</span>
                        <p className="text-sm text-secondary leading-relaxed line-clamp-2 flex-1">{text}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${scoreCls}`}>{s}%</span>
                          <span onClick={e => { e.stopPropagation();
                            const sent = lesson.transcript[idx];
                            if (sent) addToQueue({ kind: 'sentence', lessonId: lesson.id, lessonTitle: lesson.title, sentenceIndex: idx, start: sent.start, end: sent.end, text: sent.text });
                            addToast('句子已加入队列', 'success');
                          }} className="text-[10px] text-blue-400 hover:underline cursor-pointer opacity-0 group-hover:opacity-100">➕</span>
                          {s < 80 && (
                            <span onClick={e => { e.stopPropagation(); onOpenDictation(idx); }}
                              className="text-[10px] text-[var(--accent)] hover:underline cursor-pointer opacity-0 group-hover:opacity-100">复练</span>
                          )}
                        </div>
                      </div>
                      {isExpanded && wordResults && (
                        <div className="ml-9 mb-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]">
                          <WordBadges results={wordResults} />
                        </div>
                      )}
                    </div>
                  );
                })
              ))}
            {sideTab === 'clips' && (
              lessonClips.length === 0 ? (
                <p className="text-center text-tertiary text-sm py-16">暂无片段</p>
              ) : (
                <>
                  {/* Toolbar: sort, add all to queue, export */}
                  <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-secondary)]">
                    <button onClick={() => setClipSort(s => s === 'time' ? 'date' : 'time')}
                      className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer px-2 py-1">
                      {clipSort === 'time' ? '按时间' : '按日期'}
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => {
                      if (lessonClips.length === 0) return;
                      playClipsFrom(lessonClips, lesson, 0);
                      setTimeout(() => playClip(lessonClips[0], lesson), 50);
                      addToast(`即将播放 ${lessonClips.length} 个片段`, 'success');
                    }}
                      className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer px-2 py-1 flex items-center gap-1">
                      <HiPlay size={11} />
                    </button>
                    <button onClick={handleExportClips}
                      className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer px-2 py-1 flex items-center gap-1">
                      <HiArrowDownTray size={11} />
                    </button>
                  </div>

                  {lessonClips.map((clip: AudioClip) => {
                    const d = clip.endTime - clip.startTime;
                    const isActive = activeClipId === clip.id;
                    const isHovered = hoveredClipId === clip.id;
                    return (
                  <div key={clip.id}
                    className={`transition-all border-l-2 ${isActive ? 'bg-[var(--accent-soft)] border-l-[var(--accent)]' : isHovered ? 'bg-[var(--bg-hover)] border-l-transparent' : 'border-l-transparent'}`}>
                    <div className="px-5 py-3">
                      {/* Row 1: icon + text + actions */}
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => {
                            const idx = lessonClips.findIndex(c => c.id === clip.id);
                            if (idx >= 0) { playClipsFrom(lessonClips, lesson, idx); }
                            onSeek(clip.startTime);
                            setTimeout(() => playClip(clip, lesson), 0);
                          }}
                          onMouseEnter={() => setHoveredClipId(clip.id)}
                          onMouseLeave={() => setHoveredClipId(null)}
                          className="flex-1 text-left min-w-0 flex items-start gap-3 cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: clip.color + '30' }}>
                            <HiBookmark size={13} style={{ color: clip.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-secondary leading-relaxed line-clamp-2">"{clip.text}"</p>
                            <div className="flex items-center gap-2 mt-1">
                              {clip.note && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-secondary">{clip.note}</span>}
                              <span className="text-xs text-tertiary">{fmt(clip.startTime)} - {fmt(clip.endTime)} · {d.toFixed(1)}s</span>
                            </div>
                          </div>
                        </button>
                        <ClipActions
                          clip={clip}
                          size="sm"
                          analysis={clipAnalyses.get(clip.text) ?? null}
                          isAnalyzing={analyzingClips.has(clip.text)}
                          onAnalyze={handleAnalyze}
                          onViewAnalysis={setViewingAnalysis}
                          onEdit={(id, data) => updateClip(id, data)}
                          onDelete={id => removeClip(id)}
                          onAddToQueue={c => { addToQueue({ kind: 'clip', clip: c }); addToast('已加入队列', 'success'); }}
                        />
                      </div>
                    </div>
                  </div>
                  );})}
</>
              )
            )}

            {sideTab === 'favorites' && (
              lessonFavs.length === 0 ? (
                <p className="text-center text-tertiary text-sm py-16">暂无收藏</p>
              ) : lessonFavs.map(item => (
                <div key={item.id}
                  onClick={() => {
                    if (item.item_type === 'word') {
                      const w = lesson.words.find(w => w.text.toLowerCase() === item.item_id.toLowerCase());
                      if (w) onSeek(w.start);
                    } else if (item.item_type === 'clip') {
                      try {
                        const d = JSON.parse(item.extra_data || '{}');
                        if (d.lessonId === lesson.id) onSeek(d.start || 0);
                      } catch {}
                    }
                  }}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: item.item_type === 'word'
                        ? 'var(--word-gradient)'
                        : (() => { const c = clips.find(cc => cc.id === item.item_id)?.color; return c ? c + '30' : 'var(--clip-gradient)'; })()
                    }}>
                    {item.item_type === 'word' ? <HiTag size={13} className="text-primary" /> : <HiBookmark size={13} style={{ color: clips.find(cc => cc.id === item.item_id)?.color || undefined }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">{item.title}</p>
                    <p className="text-xs text-tertiary">{item.subtitle}</p>
                  </div>
                  <HiHeart size={13} className="text-[var(--accent)] flex-shrink-0" />
                </div>
              )))}

            {sideTab === 'words' && (
              lessonWords.length === 0 ? (
                <p className="text-center text-tertiary text-sm py-16">
                  {wordSearch ? '未找到匹配单词' : '本课暂无单词'}
                </p>
              ) : (
                <>
                  {/* Search */}
                  <div className="px-4 py-2 border-b border-[var(--border-secondary)]">
                    <input type="text" placeholder="搜索本课单词…" value={wordSearch} onChange={e => setWordSearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-[var(--bg-tertiary)] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-primary placeholder:text-tertiary" />
                  </div>
                  {/* Word list */}
                  <div className="divide-y divide-[var(--border-secondary)]">
                    {lessonWords.map(({ word, times }) => (
                      <div key={word}
                        className="px-5 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-hover)] transition-colors">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-primary font-medium">{word}</span>
                          {knownWords.has(word) && (
                            <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400">✓</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {times.slice(0, 4).map((t, i) => (
                            <button key={i} onClick={() => onSeek(t)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors font-mono cursor-pointer">
                              {Math.floor(t / 60)}:{Math.floor(t % 60).toString().padStart(2, '0')}
                            </button>
                          ))}
                          {times.length > 4 && (
                            <span className="text-[10px] text-tertiary">+{times.length - 4}</span>
                          )}
                        </div>
                        <button onClick={e => { e.stopPropagation(); favToggle({ item_id: word, item_type: 'word', title: word, subtitle: lesson.title }); }}
                          className={`transition-colors cursor-pointer ${isFav(word, 'word') ? 'text-[var(--accent)]' : 'text-tertiary opacity-0 group-hover:opacity-100 hover:text-tertiary'}`}>
                          <HiHeart size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Review button */}
                  <div className="p-3 border-t border-[var(--border-secondary)]">
                    <button onClick={() => setWordsReviewOpen(true)}
                      className="w-full py-2 rounded-lg text-xs font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5">
                      🧠 复习本课单词 ({lessonWords.length})
                    </button>
                  </div>
                </>
              )
            )}
          </div>
          </div>
        )}
      </aside>
    </div>

    {viewingAnalysis && (
      <ClipAnalysisModal analysis={viewingAnalysis} onClose={() => setViewingAnalysis(null)} />
    )}

    <ReviewModal
      open={wordsReviewOpen}
      onClose={() => setWordsReviewOpen(false)}
      words={lessonWords.map(w => ({ word: w.word, source: lesson.title }))}
      mode="fill-in"
    />

</>
  );
}

function SideTabIcon({ active, icon, onClick }: { active: boolean; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full p-2.5 flex items-center justify-center transition-colors cursor-pointer ${
        active ? 'bg-[var(--bg-active)] text-primary' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
      }`}>
      {icon}
    </button>
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
