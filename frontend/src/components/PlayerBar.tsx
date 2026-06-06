import { useState } from 'react';
import { HiPlay, HiPause, HiBackward, HiForward, HiBookmark, HiMusicalNote, HiArrowPath, HiChevronUp, HiChevronDown } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import type { LoopMode } from '../types/lesson';
import TranscriptView from './TranscriptView';

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
  const seekR = useAudioStore(s=>s.seekRelative);
  const prevS = useAudioStore(s=>s.jumpToPrevSentence);
  const nextS = useAudioStore(s=>s.jumpToNextSentence);
  const setRate = useAudioStore(s=>s.setRate);
  const cycleLoop = useAudioStore(s=>s.cycleLoopMode);
  const setLoopT = useAudioStore(s=>s.setLoopTarget);

  const isL = mode.kind==='lesson';
  const isC = mode.kind==='clip';
  const hasContent = mode.kind !== 'empty';
  const title = hasContent ? (isL ? mode.lesson.title : `"${mode.clip.text}"`) : '未在播放';
  const sub = hasContent ? (isL ? mode.lesson.subtitle : mode.clip.lessonTitle) : '选择课程开始练习';
  const cs = isC ? mode.clip.startTime : 0;
  const ce = isC ? mode.clip.endTime : dur;
  const cd = isC ? ce-cs : dur;
  const pct = hasContent ? (isC ? (cd>0?((cur-cs)/cd)*100:0) : (dur>0?(cur/dur)*100:0)) : 0;
  const dTime = isC ? Math.max(0,cur-cs) : cur;
  const dDur = isC ? cd : dur;
  const li = LOOP[loop];

  return (
    <>
      {/* ── Fullscreen Lyrics Overlay ── */}
      {expanded && hasContent && mode.kind==='lesson' && (
        <div className="fixed inset-0 z-50 flex flex-col animate-fade-in" style={{ background: 'linear-gradient(180deg, #1a0a14 0%, #0a0a0b 100%)' }}>
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4">
            <button onClick={()=>setExpanded(false)}
              className="text-white/50 hover:text-white/80 transition-colors cursor-pointer">
              <HiChevronDown size={24}/>
            </button>
            <div className="text-center">
              <p className="text-[13px] font-semibold text-white">{mode.lesson.title}</p>
              <p className="text-[11px] text-white/40">{mode.lesson.subtitle}</p>
            </div>
            <div className="w-6"/>
          </div>

          {/* Lyrics */}
          <div className="flex-1 overflow-y-auto px-6">
            <div className="max-w-xl mx-auto py-8">
              <TranscriptView
                lessonId={mode.lesson.id}
                lessonTitle={mode.lesson.title}
                lines={mode.lesson.transcript}
                words={mode.lesson.words}
                currentTime={cur}
                onSeek={seek}
              />
            </div>
          </div>

          {/* Mini controls at bottom of lyrics */}
          <div className="flex-shrink-0 flex items-center justify-center gap-4 px-6 py-6">
            <button onClick={prevS} className="text-white/40 hover:text-white/80 transition-colors cursor-pointer"><HiBackward size={20}/></button>
            <button onClick={()=>seekR(-5)} className="text-white/30 hover:text-white/70 transition-colors cursor-pointer text-[13px] font-medium">-5s</button>
            <button onClick={toggle}
              className="w-14 h-14 flex items-center justify-center rounded-full bg-white text-black transition-all cursor-pointer hover:scale-105 active:scale-95">
              {playing ? <HiPause size={24}/> : <HiPlay size={24}/>}
            </button>
            <button onClick={()=>seekR(5)} className="text-white/30 hover:text-white/70 transition-colors cursor-pointer text-[13px] font-medium">+5s</button>
            <button onClick={nextS} className="text-white/40 hover:text-white/80 transition-colors cursor-pointer"><HiForward size={20}/></button>
          </div>
        </div>
      )}

      {/* ── Bottom Player Bar (always visible) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'rgba(28, 28, 30, 0.95)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
        {/* Progress bar */}
        <div className={`h-0.5 bg-white/[0.06] transition-all ${hasContent ? 'cursor-pointer group/progress hover:h-[3px]' : ''}`}
          onClick={e => {
            if (!hasContent) return;
            e.stopPropagation();
            const r=e.currentTarget.getBoundingClientRect();
            seek(isC?cs+(e.clientX-r.left)/r.width*cd:(e.clientX-r.left)/r.width*dur);
          }}>
          <div className="h-full transition-all duration-75" style={{
            width: `${Math.min(100,Math.max(0,pct))}%`,
            background: hasContent ? 'linear-gradient(90deg, #fa2d48, #ff6b7f)' : 'transparent',
            boxShadow: hasContent ? '0 0 8px rgba(250,45,72,0.4)' : 'none',
          }}/>
        </div>

        <div className="flex items-center gap-3 px-4 py-2.5 max-w-screen-xl mx-auto">
          {/* Artwork + Info — click to expand lyrics */}
          <div className="w-52 min-w-0 flex items-center gap-3"
            onClick={() => { if (hasContent && isL) setExpanded(!expanded); }}
            style={{ cursor: hasContent && isL ? 'pointer' : 'default' }}>
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-lg transition-opacity ${hasContent ? 'opacity-100' : 'opacity-30'}`}
              style={{ background: isC ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #fa2d48, #c0392b)' }}>
              {isC ? <HiBookmark size={18}/> : <HiMusicalNote size={18}/>}
            </div>
            <div className="min-w-0">
              <p className={`text-[13px] font-semibold truncate ${hasContent ? 'text-white' : 'text-white/25'}`}>{title}</p>
              <p className={`text-[11px] truncate ${hasContent ? 'text-white/35' : 'text-white/15'}`}>{sub}</p>
            </div>
          </div>

          {/* Center controls */}
          <div className="flex-1 flex items-center justify-center gap-3">
            {isL && <button onClick={e=>{e.stopPropagation();prevS();}} className="text-white/40 hover:text-white/80 transition-colors cursor-pointer" title="上一句"><HiBackward size={15}/></button>}
            <button onClick={e=>{e.stopPropagation();seekR(isC?-2:-5);}} title="后退5秒"
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${hasContent ? 'text-white/40 hover:text-white/80 hover:bg-white/[0.06]' : 'text-white/10 cursor-default'}`}>
              <HiBackward size={16}/>
            </button>

            <button onClick={e=>{e.stopPropagation();toggle();}}
              disabled={!hasContent || loading}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 cursor-pointer ${
                !hasContent ? 'bg-white/[0.04] text-white/10 cursor-default' :
                loading ? 'bg-white/[0.08]' :
                'bg-white hover:scale-105 active:scale-95'
              }`}
              style={hasContent && !loading ? { boxShadow: '0 4px 20px rgba(0,0,0,0.4)' } : {}}>
              {loading
                ? <span className="animate-spin"><HiBackward size={18}/></span>
                : playing ? <span className={hasContent ? 'text-black' : 'text-white/10'}><HiPause size={20}/></span>
                : <span className={hasContent ? 'text-black' : 'text-white/10'}><HiPlay size={20}/></span>}
            </button>

            <button onClick={e=>{e.stopPropagation();seekR(isC?2:5);}} title="前进5秒"
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${hasContent ? 'text-white/40 hover:text-white/80 hover:bg-white/[0.06]' : 'text-white/10 cursor-default'}`}>
              <HiForward size={16}/>
            </button>
            {isL && <button onClick={e=>{e.stopPropagation();nextS();}} className="text-white/40 hover:text-white/80 transition-colors cursor-pointer" title="下一句"><HiForward size={15}/></button>}
          </div>

          {/* Right */}
          <div className="w-52 flex items-center justify-end gap-3 text-[11px]">
            {hasContent && (
              <>
                <button onClick={e=>{e.stopPropagation();cycleLoop();}} className="text-white/35 hover:text-white/70 transition-colors cursor-pointer" title={`循环模式: ${LOOP[loop].label}`}>{li.icon}</button>
                <span className="text-white/20">|</span>
                <span className="font-mono tabular-nums text-white/50 font-medium">{fmt(dTime)}</span>
                <span className="text-white/20">/</span>
                <span className="font-mono tabular-nums text-white/30">{fmt(dDur)}</span>
                <div className="flex items-center gap-px ml-1">
                  {[0.75,1,1.25,1.5].map(r=>(
                    <button key={r} onClick={e=>{e.stopPropagation();setRate(r);}}
                      className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-colors font-medium ${rate===r ? 'bg-white/[0.12] text-white' : 'text-white/30 hover:text-white/60'}`}>{r}x</button>
                  ))}
                </div>
                {isC && <>
                  <span className="text-white/15">|</span>
                  {[1,3,5,10].map(n=>(
                    <button key={n} onClick={e=>{e.stopPropagation();setLoopT(n);}}
                      className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-colors font-medium ${loopT===n ? 'bg-[#10b981]/30 text-[#10b981]' : 'text-white/30 hover:text-white/60'}`}>{n}x</button>
                  ))}
                </>}
              </>
            )}
            {isL && (
              <button onClick={e=>{e.stopPropagation();setExpanded(!expanded);}}
                className="ml-1 text-white/25 hover:text-white/60 transition-colors cursor-pointer">
                {expanded ? <HiChevronDown size={16}/> : <HiChevronUp size={16}/>}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
