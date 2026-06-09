import { useEffect, useMemo, useState } from 'react';
import { HiXMark, HiPlay, HiBookmark, HiHeart, HiTag } from 'react-icons/hi2';
import type { AudioClip, ClipAnalysis } from '../types/lesson';
import { getDictationRecords, type DictRecord, type AudioGroup } from '../lib/api';
import { useClipsStore } from '../stores/clipsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useAudioStore } from '../stores/audioStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useToastStore } from '../stores/toastStore';
import { useAiStore } from '../stores/aiStore';
import ClipActions from './ClipActions';
import ClipAnalysisModal from './ClipAnalysisModal';

export type PanelTab = 'dictation' | 'clips' | 'favorites' | null;

interface Props {
  lessonId: string;
  lessonTitle: string;
  tab: PanelTab;
  onClose: () => void;
  onSeekSentence: (sentenceIndex: number) => void;
  /** Optional: highlight a specific sentence in the dictation panel */
  highlightSentence?: number;
}

function fmt(t: number) { const m = Math.floor(t / 60); return `${m}:${Math.floor(t % 60).toString().padStart(2, '0')}`; }

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }); }
  catch { return iso?.slice(0, 10) || ''; }
}

export default function LessonDetailPanel({ lessonId, lessonTitle, tab, onClose, onSeekSentence, highlightSentence }: Props) {
  const [dictGroups, setDictGroups] = useState<AudioGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const clips = useClipsStore(s => s.clips);
  const updateClip = useClipsStore(s => s.updateClip);
  const removeClip = useClipsStore(s => s.removeClip);
  const lessonClips = useMemo(
    () => clips.filter(c => c.lessonId === lessonId),
    [clips, lessonId]
  );
  const favItems = useFavoritesStore(s => s.items);
  const playClip = useAudioStore(s => s.playClip);
  const addToQueue = usePlaylistStore(s => s.addToQueue);
  const addToast = useToastStore(s => s.addToast);
  const analyzeClipFn = useAiStore(s => s.analyzeClip);

  const [clipAnalyses, setClipAnalyses] = useState<Map<string, ClipAnalysis>>(new Map());
  const [analyzingClips, setAnalyzingClips] = useState<Set<string>>(new Set());
  const [viewingAnalysis, setViewingAnalysis] = useState<ClipAnalysis | null>(null);

  const lessonFavs = favItems.filter(i =>
    i.item_type === 'word' ||
    (i.item_type === 'clip' && (() => {
      try { const d = JSON.parse(i.extra_data || '{}'); return d.lessonId === lessonId; }
      catch { return false; }
    })())
  );

  useEffect(() => {
    if (!tab) return;
    setLoading(true);
    if (tab === 'dictation') {
      getDictationRecords(200).then(d => {
        const filtered = d.audios.filter(g => g.audio_id === lessonId);
        setDictGroups(filtered);
      }).finally(() => setLoading(false));
    } else setLoading(false);
  }, [tab, lessonId]);

  if (!tab) return null;

  const handlePlayClip = (clip: AudioClip) => {
    playClip(clip);
    onClose();
  };

  const handleAnalyze = (text: string) => {
    if (clipAnalyses.has(text) || analyzingClips.has(text)) return;
    setAnalyzingClips(prev => new Set(prev).add(text));
    analyzeClipFn(text)
      .then(analysis => {
        setClipAnalyses(prev => new Map(prev).set(text, analysis));
        setAnalyzingClips(prev => { const n = new Set(prev); n.delete(text); return n; });
      })
      .catch(() => {
        setAnalyzingClips(prev => { const n = new Set(prev); n.delete(text); return n; });
        addToast('AI 分析失败', 'error');
      });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel — right side on desktop, bottom sheet on mobile */}
      <div className={`fixed z-50 bg-[var(--bg-primary)] border-[var(--border-primary)] shadow-2xl
        md:right-0 md:top-0 md:bottom-0 md:w-[380px] md:border-l
        max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:max-h-[70vh] max-md:rounded-t-2xl max-md:border-t
        animate-slide-up md:animate-fade-in`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-secondary)]">
          <div>
            <h3 className="text-sm font-bold text-primary">
              {tab === 'dictation' && '听写记录'}
              {tab === 'clips' && '片段列表'}
              {tab === 'favorites' && '收藏'}
            </h3>
            <p className="text-xs text-tertiary truncate">{lessonTitle}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
            <HiXMark size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-md:max-h-[55vh] md:h-[calc(100%-64px)]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-white/10 border-t-[var(--accent)] rounded-full" />
            </div>
          ) : (
            <>
              {/* ── Dictation ── */}
              {tab === 'dictation' && (
                <div className="divide-y divide-[var(--border-secondary)]">
                  {dictGroups.length === 0 ? (
                    <p className="text-center text-tertiary text-sm py-16">暂无听写记录</p>
                  ) : (
                    dictGroups.map(group => (
                      <div key={group.audio_id}>
                        {group.records.map((r: DictRecord) => (
                          <div key={r.id}
                            onClick={() => onSeekSentence(r.sentence_index)}
                            className={`px-5 py-3 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${highlightSentence === r.sentence_index ? 'bg-[var(--accent-soft)]' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-secondary">句子 {r.sentence_index + 1}</span>
                              <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
                                r.score >= 80 ? 'text-emerald-500 bg-emerald-500/10' :
                                r.score >= 50 ? 'text-amber-500 bg-amber-500/10' :
                                'text-red-500 bg-red-500/10'
                              }`}>{r.score}%</span>
                            </div>
                            {r.user_input && (
                              <p className="text-sm text-secondary mb-1">{r.user_input}</p>
                            )}
                            {r.expected_text && r.user_input && r.score < 100 && (
                              <p className="text-xs text-tertiary line-through">{r.expected_text}</p>
                            )}
                            <p className="text-[10px] text-tertiary mt-1">{fmtDate(r.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Clips ── */}
              {tab === 'clips' && (
                <div className="divide-y divide-[var(--border-secondary)]">
                  {lessonClips.length === 0 ? (
                    <p className="text-center text-tertiary text-sm py-16">暂无片段</p>
                  ) : (
                    lessonClips.map(clip => {
                      const d = clip.endTime - clip.startTime;
                      return (
                        <div key={clip.id}
                          onClick={() => handlePlayClip(clip)}
                          className="px-5 py-3 hover:bg-[var(--bg-hover)] transition-all cursor-pointer flex items-start gap-3 border-l-2 border-transparent hover:border-l-[var(--accent)]"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: clip.color + '30' }}>
                            <HiBookmark size={13} style={{ color: clip.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-secondary leading-relaxed line-clamp-2">"{clip.text}"</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-tertiary">{d.toFixed(1)}s</span>
                              <span className="text-xs text-tertiary">{fmt(clip.startTime)} – {fmt(clip.endTime)}</span>
                              {clip.note && <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-secondary">{clip.note}</span>}
                            </div>
                          </div>
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
                      );
                    })
                  )}
                </div>
              )}

              {/* ── Favorites ── */}
              {tab === 'favorites' && (
                <div className="divide-y divide-[var(--border-secondary)]">
                  {lessonFavs.length === 0 ? (
                    <p className="text-center text-tertiary text-sm py-16">暂无收藏</p>
                  ) : (
                    lessonFavs.map(item => (
                      <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: item.item_type === 'word'
                              ? 'var(--word-gradient)'
                              : (() => { const c = clips.find(cc => cc.id === item.item_id)?.color; return c ? c + '30' : 'var(--clip-gradient)'; })()
                          }}>
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
              )}
            </>
          )}
        </div>
      </div>

      {viewingAnalysis && (
        <ClipAnalysisModal analysis={viewingAnalysis} onClose={() => setViewingAnalysis(null)} />
      )}
    </>
  );
}
