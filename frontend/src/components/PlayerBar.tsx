import { useAudioStore } from '../stores/audioStore';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const mode = useAudioStore((s) => s.mode);
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const isLoading = useAudioStore((s) => s.isLoading);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const loopTarget = useAudioStore((s) => s.loopTarget);
  const loopCount = useAudioStore((s) => s.loopCount);
  const togglePlay = useAudioStore((s) => s.togglePlay);
  const seek = useAudioStore((s) => s.seek);
  const seekRelative = useAudioStore((s) => s.seekRelative);
  const setRate = useAudioStore((s) => s.setRate);
  const setLoopTarget = useAudioStore((s) => s.setLoopTarget);

  if (mode.kind === 'empty') return null;

  const title =
    mode.kind === 'lesson'
      ? mode.lesson.title
      : `"${mode.clip.text}"`;
  const subtitle =
    mode.kind === 'lesson'
      ? mode.lesson.subtitle
      : mode.clip.lessonTitle;

  const isClip = mode.kind === 'clip';
  const clipStart = isClip ? mode.clip.startTime : 0;
  const clipEnd = isClip ? mode.clip.endTime : duration;
  const clipDuration = isClip ? clipEnd - clipStart : duration;
  const progress = isClip
    ? clipDuration > 0 ? ((currentTime - clipStart) / clipDuration) * 100 : 0
    : duration > 0 ? (currentTime / duration) * 100 : 0;
  const remaining = Math.max(0, loopTarget - loopCount);
  const displayTime = isClip
    ? Math.max(0, currentTime - clipStart)
    : currentTime;
  const displayDuration = isClip ? clipDuration : duration;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
      {/* Progress bar (thin, clickable) */}
      <div
        className="h-1 bg-gray-100 cursor-pointer group/progress"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          seek(isClip ? clipStart + ratio * clipDuration : ratio * duration);
        }}
      >
        <div
          className="h-full bg-blue-500 transition-all duration-100 group-hover/progress:bg-blue-600"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-2 max-w-screen-xl mx-auto">
        {/* Left: info */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm flex-shrink-0">
            {isClip ? '📌' : '🎧'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
            <p className="text-xs text-gray-400 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Center: controls */}
        <div className="flex items-center gap-2">
          {/* Loop count (clip only) */}
          {isClip && (
            <button
              onClick={() => { seek(clipStart); useAudioStore.setState({ loopCount: 0 }); }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"
              title="剩余循环"
            >
              {remaining}
            </button>
          )}

          <button
            onClick={() => seekRelative(isClip ? -2 : -5)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            ⏪
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading}
            className={`w-10 h-10 flex items-center justify-center rounded-full text-white text-lg transition-all cursor-pointer shadow-sm ${
              isLoading
                ? 'bg-gray-300 cursor-wait animate-pulse'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isLoading ? '⏳' : isPlaying ? '⏸' : '▶'}
          </button>

          <button
            onClick={() => seekRelative(isClip ? 2 : 5)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            ⏩
          </button>
        </div>

        {/* Right: time + speed */}
        <div className="flex-1 flex items-center justify-end gap-3 text-xs text-gray-400">
          <span className="font-mono tabular-nums">
            {formatTime(displayTime)} / {formatTime(displayDuration)}
          </span>

          {/* Speed */}
          <div className="flex items-center gap-0.5">
            {[0.5, 0.75, 1, 1.25, 1.5].map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  playbackRate === r
                    ? 'bg-blue-500 text-white text-xs'
                    : 'text-gray-400 hover:bg-gray-100'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>

          {/* Loop config (clip only) */}
          {isClip && (
            <div className="flex items-center gap-0.5 ml-1">
              <span className="text-gray-300">|</span>
              {[1, 3, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setLoopTarget(n)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    loopTarget === n
                      ? 'bg-green-500 text-white text-xs'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
