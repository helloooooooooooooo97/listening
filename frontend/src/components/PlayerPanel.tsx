import { useAudioStore } from '../stores/audioStore';
import { useClipsStore } from '../stores/clipsStore';
import TranscriptView from './TranscriptView';

export default function PlayerPanel() {
  const mode = useAudioStore((s) => s.mode);
  const currentTime = useAudioStore((s) => s.currentTime);
  const seek = useAudioStore((s) => s.seek);
  const updateClip = useClipsStore((s) => s.updateClip);

  // ═══════════ Empty ═══════════
  if (mode.kind === 'empty') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <p className="text-6xl mb-4">🎧</p>
          <p className="text-gray-400 text-lg font-medium">英语听力练习</p>
          <p className="text-gray-300 text-sm mt-1">从左侧选择课程或片段开始</p>
          <p className="text-gray-300 text-xs mt-2">底部播放栏统一控制播放</p>
        </div>
      </div>
    );
  }

  // ═══════════ Lesson ═══════════
  if (mode.kind === 'lesson') {
    const { lesson } = mode;
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">{lesson.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">{lesson.subtitle}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{lesson.level}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-5 space-y-5">
            <TranscriptView
              lessonId={lesson.id}
              lessonTitle={lesson.title}
              lines={lesson.transcript}
              words={lesson.words}
              currentTime={currentTime}
              onSeek={seek}
            />

            <div className="text-center text-xs text-gray-300 space-y-0.5 pb-4">
              {lesson.sourceURL && <p>🎧 <a href={lesson.sourceURL} target="_blank" rel="noopener noreferrer" className="hover:underline">{lesson.sourceURL}</a></p>}
              {lesson.textSourceURL && <p>📄 <a href={lesson.textSourceURL} target="_blank" rel="noopener noreferrer" className="hover:underline">{lesson.textSourceURL}</a></p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════ Clip ═══════════
  const { clip, lesson } = mode;
  const cStart = clip.startTime;
  const cEnd = clip.endTime;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">🔁 片段复习</h1>
        <p className="text-sm text-gray-500 mt-0.5">{clip.lessonTitle}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-6 py-5 space-y-5">
          {/* Clip card */}
          <div className="bg-white rounded-xl border-2 border-blue-200 p-6 shadow-sm">
            <p className="text-xl leading-relaxed text-gray-800 font-medium text-center select-none">"{clip.text}"</p>
            <div className="flex items-center justify-center gap-3 mt-3 text-xs text-gray-400">
              <span>⏱ {cStart.toFixed(1)}s — {cEnd.toFixed(1)}s</span>
              {clip.note && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{clip.note}</span>}
            </div>
            <input type="text" placeholder="添加标签..." defaultValue={clip.note}
              onBlur={(e) => { if (e.target.value.trim() !== clip.note) updateClip(clip.id, { note: e.target.value.trim() }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { updateClip(clip.id, { note: (e.target as HTMLInputElement).value.trim() }); (e.target as HTMLInputElement).blur(); } }}
              className="mt-3 w-full text-xs text-gray-400 text-center border-none bg-transparent focus:outline-none focus:text-gray-600" />
          </div>

          {/* Context */}
          {lesson && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">📖 上下文</h3>
              {lesson.transcript.filter((l) => l.end >= cStart - 1 && l.start <= cEnd + 1).map((l) => (
                <p key={l.id} className="text-sm text-gray-600 leading-relaxed mb-1">{l.text}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
