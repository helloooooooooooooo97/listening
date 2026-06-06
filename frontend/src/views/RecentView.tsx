import { HiMusicalNote, HiClock } from 'react-icons/hi2';
import type { LessonSummary, ListeningLesson } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';

interface Props {
  lessons: LessonSummary[];
}

function fmtDuration(s: number) { const m = Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

export default function RecentView({ lessons }: Props) {
  const playLesson = useAudioStore(s => s.playLesson);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">最近播放</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {lessons.length===0 ? (
          <div className="text-center py-16">
            <HiClock size={40} className="text-white/10 mx-auto mb-4"/>
            <p className="text-white/20 text-sm">还没有播放记录</p>
            <p className="text-white/10 text-xs mt-1">选择音频开始播放后会自动记录</p>
          </div>
        ) : (
          <div className="space-y-1">
            {lessons.slice(0,20).map((l,i)=>(
              <div key={l.id} onClick={()=>fetch(`/api/lessons/${l.id}`).then(r=>r.json()).then((d:ListeningLesson)=>playLesson(d))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/[0.03] transition-colors group">
                <span className="text-[12px] text-white/15 tabular-nums w-5">{i+1}</span>
                <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{background:'linear-gradient(135deg,#1a0a14,#0a0a0b)'}}>
                  <HiMusicalNote size={13} className="text-white/30"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white/70 truncate">{l.title}</p>
                  <p className="text-[11px] text-white/25 truncate">{l.subtitle} · {l.level}</p>
                </div>
                <span className="text-[11px] text-white/20">{fmtDuration(l.duration)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
