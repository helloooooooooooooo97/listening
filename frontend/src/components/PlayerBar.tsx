import { useState } from 'react';
import { HiPlay, HiPause, HiBackward, HiForward, HiBookmark, HiMusicalNote, HiArrowPath, HiChevronDown, HiChevronUp, HiPencil, HiTag, HiHeart } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { useDictationStore } from '../stores/dictationStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import type { LoopMode } from '../types/lesson';
import { getLessonById } from '../lib/api';
import TranscriptView from './TranscriptView';
import Waveform from './Waveform';

function fmt(t: number) { const m=Math.floor(t/60); return `${m}:${Math.floor(t%60).toString().padStart(2,'0')}`; }

const LOOP: Record<LoopMode,{icon:React.ReactNode;label:string}> = {
  all: { icon: <HiArrowPath size={13}/>, label: '全部' },
  sentence: { icon: <span className="relative"><HiArrowPath size={13}/><span className="absolute -top-0.5 -right-1 text-[7px] font-bold">1</span></span>, label: '单句循环' },
  clip: { icon: <HiBookmark size={13}/>, label: '片段循环' },
};

export default function PlayerBar() {
  const [expanded, setExpanded] = useState(false);
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

  const favId = isL ? mode.lesson.id : isC ? mode.clip.id : '';
  const favType = isL ? 'audio' : isC ? 'clip' : null;
  const favTitle = mode.kind === 'empty' ? '' : title;
  const favSub = mode.kind === 'empty' ? '' : sub;

  return (
    <>
      {/* ── Fullscreen Reading View ── */}
      {expanded && hasContent && (mode.kind==='lesson' || (mode.kind==='clip' && mode.lesson)) && (() => {
        const lesson = mode.kind==='lesson' ? mode.lesson : mode.kind==='clip' ? mode.lesson! : null;
        if (!lesson) return null;
        return (
        <div className="fixed inset-0 z-30 flex flex-col bg-[var(--bg-primary)]" style={{ paddingBottom: '72px' }}>
          {/* ── Header ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-[var(--border-secondary)]">
            <button onClick={()=>setExpanded(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
              <HiChevronDown size={20}/>
            </button>
            <div className="flex-1 text-center min-w-0 px-4">
              <p className="text-sm font-semibold text-primary truncate">{lesson.title}</p>
              <p className="text-xs text-tertiary truncate">{lesson.subtitle}</p>
            </div>
            <div className="w-8"/>
          </div>

          {/* ── Transcript Content ── */}
          <div className="flex-1 overflow-y-auto px-8">
            <div className="max-w-4xl mx-auto py-6">
              <TranscriptView
                lessonId={lesson.id}
                lessonTitle={lesson.title}
                lines={lesson.transcript}
                words={lesson.words}
                currentTime={cur}
                onSeek={seek}
              />
            </div>
          </div>

          {/* ── Spacer for bottom bar ── */}
        </div>
        );
      })()}

      {/* ── Bottom Player Bar (always visible) ── */}
      <div className={`fixed bottom-0 right-0 z-40 transition-all duration-300 ${expanded ? 'left-0' : 'left-56'}`}
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderTop: '1px solid var(--border-primary)',
        }}>
        <div className="px-4 pt-0.5">
          {hasContent && (isL || isC) && (
            <Waveform
              lessonId={isL ? mode.lesson.id : mode.clip.lessonId}
              currentTime={cur}
              duration={dur}
              onSeek={seek}
              height={20}
              selectionRange={isC ? { start: mode.clip.startTime, end: mode.clip.endTime } : null}
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2.5 max-w-screen-xl mx-auto">
          {/* Artwork + Info */}
          <div className="w-52 min-w-0 flex items-center gap-3"
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
              <p className={`text-xs truncate ${hasContent ? 'text-tertiary' : 'text-tertiary'}`}>{sub}</p>
            </div>
          </div>

          {/* Center controls */}
          <div className="flex-1 flex items-center justify-center gap-3">
            {(isL || isC) && <button onClick={e=>{e.stopPropagation();prevS();}} className="text-secondary hover:text-primary transition-colors cursor-pointer" title="上一句"><HiBackward size={15}/></button>}

            <button onClick={e=>{e.stopPropagation();toggle();}}
              disabled={!hasContent || loading}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 cursor-pointer ${
                !hasContent ? 'bg-[var(--bg-tertiary)] text-tertiary cursor-default' :
                loading ? 'bg-[var(--bg-active)]' :
                'bg-white hover:scale-105 active:scale-95'
              }`}
              style={hasContent && !loading ? { boxShadow: '0 4px 20px rgba(0,0,0,0.4)' } : {}}>
              {loading
                ? <span className="animate-spin"><HiBackward size={18}/></span>
                : playing ? <span className={hasContent ? 'text-black' : 'text-tertiary'}><HiPause size={20}/></span>
                : <span className={hasContent ? 'text-black' : 'text-tertiary'}><HiPlay size={20}/></span>}
            </button>

            {(isL || isC) && <button onClick={e=>{e.stopPropagation();nextS();}} className="text-secondary hover:text-primary transition-colors cursor-pointer" title="下一句"><HiForward size={15}/></button>}
          </div>

          {/* Right */}
          <div className="w-52 flex items-center justify-end gap-3 text-xs">
            {hasContent && favType && favId && (
              <button onClick={e=>{e.stopPropagation();favToggle({item_id:favId,item_type:favType,title:favTitle,subtitle:favSub,extra_data:favType==='clip'?JSON.stringify({lessonId:mode.clip.lessonId,start:mode.clip.startTime,end:mode.clip.endTime}):'{}'});}}
                className={`transition-colors cursor-pointer ${isFav(favId,favType) ? 'text-[var(--accent)]' : 'text-tertiary hover:text-secondary'}`}
                title="收藏">
                <HiHeart size={14} />
              </button>
            )}
            {hasContent && (
              <>
                {isL && (
                  <button onClick={e=>{e.stopPropagation();isDictating?dictation.reset():dictation.start();}}
                    className={`transition-colors cursor-pointer ${isDictating ? 'text-[var(--accent)]' : 'text-tertiary hover:text-secondary'}`}
                    title={isDictating ? '退出听写' : '听写模式'}>
                    <HiPencil size={14}/>
                  </button>
                )}
                <button onClick={e=>{e.stopPropagation();cycleLoop();}} className="text-tertiary hover:text-secondary transition-colors cursor-pointer" title={`循环模式: ${LOOP[loop].label}`}>{li.icon}</button>
                <span className="text-tertiary">|</span>
                <span className="font-mono tabular-nums text-secondary font-medium">{fmt(dTime)}</span>
                <span className="text-tertiary">/</span>
                <span className="font-mono tabular-nums text-tertiary">{fmt(dDur)}</span>
                <div className="flex items-center gap-px ml-1">
                  {[0.75,1,1.25,1.5].map(r=>(
                    <button key={r} onClick={e=>{e.stopPropagation();setRate(r);}}
                      className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-colors font-medium ${rate===r ? 'bg-[var(--bg-active)] text-primary' : 'text-tertiary hover:text-secondary'}`}>{r}x</button>
                  ))}
                </div>
                {isC && <>
                  <span className="text-tertiary">|</span>
                  {[1,3,5,10].map(n=>(
                    <button key={n} onClick={e=>{e.stopPropagation();setLoopT(n);}}
                      className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-colors font-medium ${loopT===n ? 'bg-emerald-500/20 text-emerald-600' : 'text-tertiary hover:text-secondary'}`}>{n}x</button>
                  ))}
                </>}
              </>
            )}
            {(isL || isC) && (
              <button onClick={e=>{e.stopPropagation();setExpanded(!expanded);}}
                className="ml-1 text-tertiary hover:text-secondary transition-colors cursor-pointer">
                {expanded ? <HiChevronDown size={16}/> : <HiChevronUp size={16}/>}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
