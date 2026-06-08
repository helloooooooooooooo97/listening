import { useState, useEffect } from 'react';
import { HiPlay, HiPause, HiBackward, HiForward, HiBookmark, HiMusicalNote, HiArrowPath, HiChevronDown, HiPencil, HiTag, HiPlusCircle, HiChevronRight, HiQueueList, HiChevronLeft, HiSpeakerWave } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { findSentenceIndex } from '../lib/audioEngine';
import { useDictationStore } from '../stores/dictationStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useClipsStore } from '../stores/clipsStore';
import { useToastStore } from '../stores/toastStore';
import type { LoopMode } from '../types/lesson';
import { getLessonById } from '../lib/api';
import Waveform from './Waveform';
import HeartButton from './HeartButton';
import EmbeddedDictation from './dictation/EmbeddedDictation';
import PlaybackDetailTabs from './PlaybackDetailTabs';

function fmt(t: number) { const m=Math.floor(t/60); return `${m}:${Math.floor(t%60).toString().padStart(2,'0')}`; }

interface Props {
  onQueueToggle?: () => void;
}

const LOOP: Record<LoopMode,{icon:React.ReactNode;label:string}> = {
  all: { icon: <HiArrowPath size={13}/>, label: '全部' },
  sentence: { icon: <span className="relative"><HiArrowPath size={13}/><span className="absolute -top-0.5 -right-1 text-[7px] font-bold">1</span></span>, label: '单句循环' },
  clip: { icon: <HiBookmark size={13}/>, label: '片段循环' },
};

export default function PlayerBar({ onQueueToggle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [speedPop, setSpeedPop] = useState<number | null>(null);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [loopOpen, setLoopOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const mode = useAudioStore(s=>s.mode);
  const cur = useAudioStore(s=>s.currentTime);
  const dur = useAudioStore(s=>s.duration);
  const playing = useAudioStore(s=>s.isPlaying);
  const loading = useAudioStore(s=>s.isLoading);
  const rate = useAudioStore(s=>s.playbackRate);
  const loop = useAudioStore(s=>s.loopMode);
  const loopT = useAudioStore(s=>s.loopTarget);
  const toggle = useAudioStore(s=>s.togglePlay);
  const seek = useAudioStore(s=>s.seek);
  const prevS = useAudioStore(s=>s.jumpToPrevSentence);
  const nextS = useAudioStore(s=>s.jumpToNextSentence);
  const setRate = useAudioStore(s=>s.setRate);
  const cycleLoop = useAudioStore(s=>s.cycleLoopMode);
  const setLoopT = useAudioStore(s=>s.setLoopTarget);
  const playPrev = usePlaylistStore(s=>s.playPrev);
  const playNext = usePlaylistStore(s=>s.playNext);
  const queueLen = usePlaylistStore(s => s.queue.length);

  const isL = mode.kind==='lesson';
  const isC = mode.kind==='clip';
  const hasContent = mode.kind !== 'empty';
  const isWord = isC && mode.clip.note === 'word';
  const title = hasContent ? (isL ? mode.lesson.title : isWord ? mode.clip.text : `"${mode.clip.text}"`) : '未在播放';
  const sub = hasContent ? (isL ? mode.lesson.subtitle : mode.clip.lessonTitle) : '选择音频开始练习';
  const dTime = cur;
  const dDur = dur;
  const li = LOOP[loop];
  const dictation = useDictationStore();
  const isDictating = dictation.active;
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const addToast = useToastStore(s => s.addToast);

  const handlePlayPrev = () => {
    const prev = playPrev();
    if (!prev) return;
    const store = useAudioStore.getState();
    if (prev.kind === 'lesson') store.playLesson(prev.lesson);
    else if (prev.kind === 'clip') store.playClip(prev.clip, prev.lesson ?? null);
    else if (prev.kind === 'sentence') {
      const clip: import('../types/lesson').AudioClip = {
        id: `q-${prev.lessonId}-s${prev.sentenceIndex}`, lessonId: prev.lessonId,
        lessonTitle: prev.lessonTitle, startWordId: '', endWordId: '',
        startTime: prev.start, endTime: prev.end, text: prev.text, note: '', color: '#facc15', createdAt: '',
      };
      store.playClip(clip);
    } else if (prev.kind === 'word') {
      const o = 2;
      const clip: import('../types/lesson').AudioClip = {
        id: `q-${prev.lessonId}-w${prev.word}`, lessonId: prev.lessonId,
        lessonTitle: prev.lessonTitle, startWordId: '', endWordId: '',
        startTime: Math.max(0, prev.start - o), endTime: prev.end + o, text: prev.word, note: 'word', color: '#facc15', createdAt: '',
      };
      store.playClip(clip);
    }
  };

  const handlePlayNext = () => {
    const next = playNext();
    if (!next) return;
    const store = useAudioStore.getState();
    if (next.kind === 'lesson') store.playLesson(next.lesson);
    else if (next.kind === 'clip') store.playClip(next.clip, next.lesson ?? null);
    else if (next.kind === 'sentence') {
      const clip: import('../types/lesson').AudioClip = {
        id: `q-${next.lessonId}-s${next.sentenceIndex}`, lessonId: next.lessonId,
        lessonTitle: next.lessonTitle, startWordId: '', endWordId: '',
        startTime: next.start, endTime: next.end, text: next.text, note: '', color: '#facc15', createdAt: '',
      };
      store.playClip(clip);
    } else if (next.kind === 'word') {
      const o = 2;
      const clip: import('../types/lesson').AudioClip = {
        id: `q-${next.lessonId}-w${next.word}`, lessonId: next.lessonId,
        lessonTitle: next.lessonTitle, startWordId: '', endWordId: '',
        startTime: Math.max(0, next.start - o), endTime: next.end + o, text: next.word, note: 'word', color: '#facc15', createdAt: '',
      };
      store.playClip(clip);
    }
  };

  const favId = isL ? mode.lesson.id : isC ? mode.clip.id : '';
  const favType = isL ? 'audio' : isC ? 'clip' : null;
  const favTitle = mode.kind === 'empty' ? '' : title;
  const favSub = mode.kind === 'empty' ? '' : sub;
  const favExtraData = isC
    ? JSON.stringify({ lessonId: mode.clip.lessonId, start: mode.clip.startTime, end: mode.clip.endTime })
    : '{}';

  // Close dropdowns on outside click
  useEffect(() => {
    if (!speedOpen && !loopOpen && !volumeOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.speed-dropdown') && !target.closest('.loop-dropdown') && !target.closest('.volume-dropdown')) {
        setSpeedOpen(false);
        setLoopOpen(false);
        setVolumeOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [speedOpen, loopOpen, volumeOpen]);

  return (
    <>
      {/* ── Fullscreen Reading View ── */}
      {expanded && hasContent && (mode.kind==='lesson' || (mode.kind==='clip' && mode.lesson)) && (() => {
        const lesson = mode.kind==='lesson' ? mode.lesson : mode.kind==='clip' ? mode.lesson! : null;
        if (!lesson) return null;
        return (
        <div className="fixed inset-0 z-30 flex flex-col bg-[var(--bg-primary)]" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
          {/* ── Header ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-secondary)]">
            <button onClick={()=>setExpanded(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
              <HiChevronDown size={20}/>
            </button>
            <div className="flex-1 text-center min-w-0 px-4">
              <p className="text-sm font-semibold text-primary truncate">{lesson.title}</p>
              <p className="text-xs text-tertiary truncate">{lesson.subtitle}</p>
            </div>
            {/* Quick actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={e=>{e.stopPropagation();isDictating ? dictation.reset() : dictation.startFrom(Math.max(0, findSentenceIndex(mode.lesson, cur)));}}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${isDictating ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'}`}
                title={isDictating ? '退出听写' : '听写模式'}>
                <HiPencil size={13} />
              </button>
              <button onClick={e=>{e.stopPropagation();
                const allClips = useClipsStore.getState().getClipsByLesson(lesson.id).map(c => ({ kind: 'clip' as const, clip: c, lesson }));
                const q = usePlaylistStore.getState();
                q.addAllToQueue(allClips);
                addToast(`已添加 ${allClips.length} 个片段到队列`, 'success');
              }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                title="全部片段加入队列">
                <HiPlusCircle size={13} />
              </button>
              <button onClick={e=>{e.stopPropagation();
                const q = usePlaylistStore.getState();
                q.cycleRepeatMode();
                const labels: Record<string,string> = { sequential:'顺序', 'repeat-all':'全部循环', shuffle:'随机', 'repeat-one':'单曲循环' };
                addToast(labels[q.repeatMode] || q.repeatMode, 'info');
              }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                title="切换播放模式">
                <HiArrowPath size={13} />
              </button>
              {isC && (
                <button onClick={e=>{e.stopPropagation();
                  const q = usePlaylistStore.getState();
                  q.playNow({ kind: 'clip', clip: mode.clip, lesson: mode.lesson });
                  addToast('已加入队列', 'success');
                }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                  title="加入队列">
                  <HiQueueList size={13} />
                </button>
              )}
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto px-4">
            {isDictating ? (
              <div className="max-w-7xl mx-auto py-4 h-full">
                <EmbeddedDictation lesson={lesson} />
              </div>
            ) : (
              <div className="max-w-7xl mx-auto py-6">
                <PlaybackDetailTabs
                  lesson={lesson}
                  currentTime={cur}
                  onSeek={seek}
                  onOpenDictation={() => {}}
                />
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* ── Bottom Player Bar (always visible) ── */}
      <div className={`fixed bottom-0 right-0 z-40 transition-all duration-300 ${expanded ? 'left-0' : 'left-0 md:left-56'}`}
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderTop: '1px solid var(--border-primary)',
        }}>
        <div className="px-4 pt-1.5 pb-0.5">
          {hasContent && (isL || isC) && (
            <Waveform
              lessonId={isL ? mode.lesson.id : mode.clip.lessonId}
              currentTime={cur}
              duration={dur}
              onSeek={seek}
              height={28}
              selectionRange={isC ? { start: mode.clip.startTime, end: mode.clip.endTime } : null}
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-4 pt-0 pb-2.5 max-w-screen-xl mx-auto">
          {/* Artwork + Info */}
          <div className="w-36 md:w-52 min-w-0 flex items-center gap-3"
            onClick={() => {
              if (isL) { setExpanded(!expanded); }
              else if (isC) {
                if (!mode.lesson) {
                  getLessonById(mode.clip.lessonId).then(l => {
                    useAudioStore.getState().setContextLesson(l);
                    setExpanded(true);
                  });
                } else {
                  setExpanded(!expanded);
                }
              }
            }}
            style={{ cursor: (isL || isC) ? 'pointer' : 'default' }}>
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-primary flex-shrink-0 shadow-lg transition-opacity ${hasContent ? 'opacity-100' : 'opacity-30'}`}
              style={{ background: isWord ? 'var(--word-gradient)' : isC ? 'var(--clip-accent-gradient)' : 'var(--accent-gradient)' }}>
              {isWord ? <HiTag size={18}/> : isC ? <HiBookmark size={18}/> : <HiMusicalNote size={18}/>}
            </div>
            <div className="min-w-0">
              <p className={`text-[14px] font-semibold truncate ${hasContent ? 'text-primary' : 'text-tertiary'}`}>{title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {hasContent && favType && favId && (
                  <HeartButton
                    active={isFav(favId, favType)}
                    onToggle={() => favToggle({item_id:favId,item_type:favType,title:favTitle,subtitle:favSub,extra_data:favExtraData})}
                    size={16}
                  />
                )}
                <p className={`text-xs truncate ${hasContent ? 'text-tertiary' : 'text-tertiary'}`}>{sub}</p>
              </div>
            </div>
          </div>

          {/* Center controls */}
          <div className="flex-1 flex items-center justify-center gap-1.5 md:gap-3">
            {(isL || isC) && <>
              <button onClick={e=>{e.stopPropagation();cycleLoop();}} className="text-tertiary hover:text-secondary transition-colors cursor-pointer" title={`循环模式: ${LOOP[loop].label}`}>{li.icon}</button>
              <button onClick={e=>{e.stopPropagation();handlePlayPrev();}} className="text-secondary hover:text-primary transition-colors cursor-pointer" title="上一首"><HiBackward size={15}/></button>
            </>}

            <button
              onPointerDown={e=>{e.stopPropagation();e.preventDefault();if(hasContent&&!loading){setPressing(true);toggle();}}}
              onPointerUp={()=>setPressing(false)}
              onPointerLeave={()=>setPressing(false)}
              disabled={!hasContent || loading}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer select-none ${
                !hasContent ? 'bg-[var(--bg-tertiary)] text-tertiary cursor-default' :
                loading ? 'bg-[var(--bg-active)] animate-pulse' :
                pressing ? 'bg-white scale-90' :
                'bg-white hover:scale-105'
              }`}
              style={hasContent && !loading ? { boxShadow: '0 4px 20px rgba(0,0,0,0.4)' } : {}}>
              {loading
                ? <span className="animate-spin"><HiBackward size={18}/></span>
                : playing ? <span className={hasContent ? 'text-black' : 'text-tertiary'}><HiPause size={20}/></span>
                : <span className={hasContent ? 'text-black' : 'text-tertiary'}><HiPlay size={20}/></span>}
            </button>

            {(isL || isC) && <>
              <button onClick={e=>{e.stopPropagation();handlePlayNext();}} className="text-secondary hover:text-primary transition-colors cursor-pointer" title="下一首"><HiForward size={15}/></button>
              <div className="relative volume-dropdown">
                <button onClick={e => { e.stopPropagation(); setVolumeOpen(!volumeOpen); setSpeedOpen(false); setLoopOpen(false); }}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
                  title="音量">
                  <HiSpeakerWave size={16} />
                </button>
                {volumeOpen && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 py-3 px-2 rounded-xl shadow-xl border border-[var(--border-primary)] flex flex-col items-center gap-2"
                    style={{ background: "var(--glass-bg)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
                    <input type="range" min="0" max="1" step="0.05" defaultValue="1"
                      onChange={e => { const a = document.querySelector("audio"); if (a) { a.volume = parseFloat(e.target.value); localStorage.setItem("app-volume", e.target.value); }}}
                      className="h-20 w-1 accent-[var(--accent)] cursor-pointer"
                      style={{ writingMode: "vertical-lr" }} />
                  </div>
                )}
              </div>
              <div className="relative speed-dropdown">
                <button
                  onPointerDown={e=>{e.stopPropagation();setSpeedOpen(!speedOpen);setLoopOpen(false);}}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-mono font-medium cursor-pointer transition-colors hover:bg-[var(--bg-active)] text-tertiary hover:text-secondary"
                  title="播放速度">
                  {rate}x <HiChevronRight size={10} className={`transition-transform duration-150 ${speedOpen ? 'rotate-90' : ''}`} />
                </button>
                {speedOpen && (
                  <div className="absolute bottom-full left-0 mb-1 rounded-lg shadow-xl border border-[var(--border-primary)] overflow-hidden z-50"
                    style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2.0].map(r => (
                      <button key={r}
                        onPointerDown={e=>{e.stopPropagation();setRate(r);setSpeedPop(r);setTimeout(()=>setSpeedPop(null),300);setSpeedOpen(false);}}
                        className={`block w-full text-left px-3 py-1.5 text-xs font-mono cursor-pointer transition-colors ${
                          rate===r ? 'bg-[var(--bg-active)] text-primary font-semibold' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                        } ${speedPop===r ? 'animate-speed-pop' : ''}`}>
                        {r}x {rate===r && '✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isC && (
                <div className="relative loop-dropdown">
                  <button
                    onPointerDown={e=>{e.stopPropagation();setLoopOpen(!loopOpen);setSpeedOpen(false);}}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-mono font-medium cursor-pointer transition-colors hover:bg-[var(--bg-active)] text-emerald-500/70 hover:text-emerald-500"
                    title="重复次数">
                    ×{loopT} <HiChevronRight size={10} className={`transition-transform duration-150 ${loopOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {loopOpen && (
                    <div className="absolute bottom-full left-0 mb-1 rounded-lg shadow-xl border border-[var(--border-primary)] overflow-hidden z-50"
                      style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                      {[1, 2, 3, 5, 10, 20].map(n => (
                        <button key={n}
                          onPointerDown={e=>{e.stopPropagation();setLoopT(n);setLoopOpen(false);}}
                          className={`block w-full text-left px-3 py-1.5 text-xs font-mono cursor-pointer transition-colors ${
                            loopT===n ? 'bg-emerald-500/15 text-emerald-500 font-semibold' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                          }`}>
                          ×{n} {loopT===n && '✓'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>}
          </div>

          {/* Right */}
          <div className="w-auto md:w-52 flex items-center justify-end gap-2 md:gap-3 text-xs">

            {/* ── Queue toggle button (far right) ── */}
            <button onClick={e => { e.stopPropagation(); onQueueToggle?.(); }}
              className="relative flex items-center justify-center w-8 h-8 rounded-lg text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
              title="播放队列 (Q)">
              <HiQueueList size={16} />
              {queueLen > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--accent)] text-[8px] font-bold flex items-center justify-center on-accent">
                  {queueLen > 99 ? '99+' : queueLen}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
