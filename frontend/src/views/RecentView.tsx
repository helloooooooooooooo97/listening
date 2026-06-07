import { HiMusicalNote, HiClock } from 'react-icons/hi2';
import type { LessonSummary } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';
import { getLessonById } from '../lib/api';

interface Props {
  lessons: LessonSummary[];
}

function fmtDuration(s: number) { const m = Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

export default function RecentView({ lessons }: Props) {
  const playLesson = useAudioStore(s => s.playLesson);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-primary tracking-tight">最近播放</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {lessons.length===0 ? (
          <div className="text-center py-16">
            <HiClock size={40} className="text-tertiary mx-auto mb-4"/>
            <p className="text-tertiary text-sm">还没有播放记录</p>
            <p className="text-tertiary text-xs mt-1">选择音频开始播放后会自动记录</p>
          </div>
        ) : (
          <div className="space-y-1">
            {lessons.slice(0,20).map((l,i)=>(
              <div key={l.id} onClick={()=>getLessonById(l.id).then(d=>playLesson(d))}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors group">
                <span className="text-xs text-tertiary tabular-nums w-5">{i+1}</span>
                <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{background:'linear-gradient(135deg,var(--bg-secondary),var(--bg-primary))'}}>
                  <HiMusicalNote size={13} className="text-tertiary"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-secondary truncate">{l.title}</p>
                  <p className="text-xs text-tertiary truncate">{l.subtitle} · {l.level}</p>
                </div>
                <span className="text-xs text-tertiary">{fmtDuration(l.duration)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
