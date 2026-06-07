import { useEffect, useMemo, useState } from 'react';
import { HiBookmark, HiHeart, HiPencil, HiTag, HiChevronLeft, HiChevronRight, HiTrash, HiArrowDownTray, HiPlusCircle } from 'react-icons/hi2';
import type { AudioClip, ListeningLesson } from '../types/lesson';
import { getDictationRecords, type AudioGroup, type DictRecord } from '../lib/api';
import { useAudioStore } from '../stores/audioStore';
import { useClipsStore } from '../stores/clipsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useToastStore } from '../stores/toastStore';
import type { WordResult } from '../stores/dictationStore';
import WordBadges from './dictation/WordBadges';
import TranscriptView from './TranscriptView';

type SideTab = 'clips' | 'dictation' | 'favorites';

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
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [expandedSentences, setExpandedSentences] = useState<Set<number>>(new Set());
  const clips = useClipsStore(s => s.clips);
  const removeClip = useClipsStore(s => s.removeClip);
  const updateClip = useClipsStore(s => s.updateClip);
  const favItems = useFavoritesStore(s => s.items);
  const playClip = useAudioStore(s => s.playClip);
  const audioMode = useAudioStore(s => s.mode);
  const addToast = useToastStore(s => s.addToast);
  const addToQueue = usePlaylistStore(s => s.addToQueue);
  const addAllToQueue = usePlaylistStore(s => s.addAllToQueue);
  const playNow = usePlaylistStore(s => s.playNow);
  const activeClipId = audioMode.kind === 'clip' ? audioMode.clip.id : null;

  const lessonClips = useMemo(() => {
    const filtered = clips.filter(c => c.lessonId === lesson.id);
    if (clipSort === 'date') return [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return [...filtered].sort((a, b) => a.startTime - b.startTime);
  }, [clips, lesson.id, clipSort]);

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

  const dictationRecords = useMemo(
    () => dictGroups.flatMap(group => group.records),
    [dictGroups]
  );

  // Group dictation by sentence for overview display
  function computeWordResults(expected: string, actual: string): WordResult[] {
    const expLower = expected.toLowerCase().split(/\s+/);
    const actLower = actual.toLowerCase().split(/\s+/);
    const m = expLower.length, n = actLower.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      dp[i][j] = expLower[i - 1] === actLower[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
    const results: WordResult[] = [];
    let ei = m, aj = n;
    const matchedE = new Set<number>(), matchedA = new Set<number>();
    while (ei > 0 && aj > 0) {
      if (expLower[ei - 1] === actLower[aj - 1]) { matchedE.add(ei - 1); matchedA.add(aj - 1); ei--; aj--; }
      else if (dp[ei - 1][aj] >= dp[ei][aj - 1]) ei--;
      else aj--;
    }
    for (let i = 0; i < m; i++) {
      if (matchedE.has(i)) results.push({ expected: expected.split(/\s+/)[i], actual: expected.split(/\s+/)[i], status: 'correct' });
      else results.push({ expected: expected.split(/\s+/)[i], actual: null, status: 'missing' });
    }
    for (let j = 0; j < n; j++) {
      if (!matchedA.has(j)) results.push({ expected: '', actual: actual.split(/\s+/)[j], status: 'extra' });
    }
    return results;
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
    <div className={`grid gap-6 ${collapsed ? 'lg:grid-cols-[minmax(0,1fr)_48px]' : 'lg:grid-cols-[minmax(0,1fr)_360px]'} transition-all duration-300`}>
      <section className="min-w-0">
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
          </div>
        ) : (
          /* Expanded: full sidebar */
          <div className="rounded-xl border border-[var(--border-secondary)] overflow-hidden bg-[var(--bg-primary)]">
            <div className="flex border-b border-[var(--border-secondary)] p-1">
              <SideTabButton active={sideTab === 'clips'} icon={<HiBookmark size={13} />} label="片段" count={lessonClips.length} onClick={() => setSideTab('clips')} />
              <SideTabButton active={sideTab === 'dictation'} icon={<HiPencil size={13} />} label="听写" count={dictationRecords.length} onClick={() => setSideTab('dictation')} />
              <SideTabButton active={sideTab === 'favorites'} icon={<HiHeart size={13} />} label="收藏" count={lessonFavs.length} onClick={() => setSideTab('favorites')} />
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
                      const items = lessonClips.map(c => ({ kind: 'clip' as const, clip: c, lesson }));
                      addAllToQueue(items);
                      addToast(`已添加 ${items.length} 个片段到队列`, 'success');
                    }}
                      className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer px-2 py-1 flex items-center gap-1">
                      <HiPlusCircle size={11} /> 全部入队
                    </button>
                    <button onClick={handleExportClips}
                      className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer px-2 py-1 flex items-center gap-1">
                      <HiArrowDownTray size={11} /> 导出
                    </button>
                  </div>

                  {lessonClips.map((clip: AudioClip) => {
                    const d = clip.endTime - clip.startTime;
                    const isActive = activeClipId === clip.id;
                    const isHovered = hoveredClipId === clip.id;
                    const isEditing = editingClipId === clip.id;
                    return (
                  <div key={clip.id}
                    className={`transition-colors ${isActive ? 'bg-[var(--accent-soft)]' : isHovered ? 'bg-[var(--bg-hover)]' : ''}`}>
                    <div className="flex items-start gap-3 px-5 py-3">
                      <button
                        onClick={() => { onSeek(clip.startTime); playNow({ kind: 'clip', clip, lesson }); setTimeout(() => playClip(clip, lesson), 0); }}
                        onMouseEnter={() => setHoveredClipId(clip.id)}
                        onMouseLeave={() => setHoveredClipId(null)}
                        className="flex-1 text-left min-w-0 flex items-start gap-3 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: clip.color + '20', border: `1px solid ${clip.color}40` }}>
                          <HiBookmark size={13} style={{ color: clip.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input type="text" value={editNote}
                              onChange={e => setEditNote(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { updateClip(clip.id, { note: editNote }); setEditingClipId(null); }
                                if (e.key === 'Escape') setEditingClipId(null);
                              }}
                              onBlur={() => { if (editNote !== clip.note) updateClip(clip.id, { note: editNote }); setEditingClipId(null); }}
                              className="w-full text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded px-2 py-1 text-secondary outline-none"
                              autoFocus
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <p className="text-sm text-secondary leading-relaxed line-clamp-2">"{clip.text}"</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-tertiary">{d.toFixed(1)}s</span>
                                <span className="text-xs text-tertiary">{fmt(clip.startTime)} - {fmt(clip.endTime)}</span>
                                {clip.note && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-secondary">{clip.note}</span>}
                              </div>
                            </>
                          )}
                        </div>
                      </button>
                      {/* More actions */}
                      <div className="relative flex-shrink-0 flex items-center gap-1">
                        <button onClick={e => { e.stopPropagation(); addToQueue({ kind: 'clip', clip, lesson }); addToast('已加入队列', 'success'); }}
                          className="text-tertiary hover:text-blue-400 transition-colors cursor-pointer p-1" title="加入队列">
                          <HiPlusCircle size={11} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setEditingClipId(clip.id); setEditNote(clip.note || ''); }}
                          className="text-tertiary hover:text-secondary transition-colors cursor-pointer p-1">
                          <HiPencil size={11} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); removeClip(clip.id); addToast('片段已删除', 'info'); }}
                          className="text-tertiary hover:text-[var(--accent)] transition-colors cursor-pointer p-1">
                          <HiTrash size={11} />
                        </button>
                      </div>
                    </div>
                    {/* Color picker row */}
                    <div className="flex items-center gap-1 px-5 pb-2 pl-16">
                      {['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7'].map(c => (
                        <button key={c} onClick={e => { e.stopPropagation(); updateClip(clip.id, { color: c }); }}
                          className={`w-3.5 h-3.5 rounded-full border transition-transform cursor-pointer hover:scale-125 ${clip.color === c ? 'ring-1 ring-offset-1 ring-[var(--text-primary)]' : ''}`}
                          style={{ backgroundColor: c }} />
                      ))}
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
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: item.item_type === 'word' ? 'var(--word-gradient)' : 'var(--clip-gradient)' }}>
                    {item.item_type === 'word' ? <HiTag size={13} className="text-primary" /> : <HiBookmark size={13} className="text-tertiary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">{item.title}</p>
                    <p className="text-xs text-tertiary">{item.subtitle}</p>
                  </div>
                  <HiHeart size={13} className="text-[var(--accent)] flex-shrink-0" />
                </div>
              )))}
          </div>
          </div>
        )}
      </aside>
    </div>
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

