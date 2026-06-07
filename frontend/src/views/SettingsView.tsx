import { HiMinus, HiPlus, HiClock, HiSpeakerWave, HiPlay, HiArrowPath, HiSun, HiMoon } from 'react-icons/hi2';
import { useSettingsStore } from '../stores/settingsStore';
import { useThemeStore } from '../stores/themeStore';
import { useAudioStore } from '../stores/audioStore';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2.0];
const LOOP_COUNTS = [1, 2, 3, 5, 8, 10];

export default function SettingsView() {
  const settings = useSettingsStore(s => s.settings);
  const setOffset = useSettingsStore(s => s.setWordPlayOffset);
  const setSpeed = useSettingsStore(s => s.setDefaultSpeed);
  const setLoopCount = useSettingsStore(s => s.setDefaultLoopCount);
  const setDailyGoal = useSettingsStore(s => s.setDailyGoalMinutes);
  const setCurrentRate = useAudioStore(s => s.setRate);
  const themeMode = useThemeStore(s => s.mode);
  const toggleTheme = useThemeStore(s => s.toggle);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-primary tracking-tight">设置</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-lg mx-auto space-y-6">

          {/* Default playback speed */}
          <div className="rounded-xl p-5 surface-card">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <HiPlay size={16} className="text-tertiary" />
              默认播放速度
            </h3>
            <p className="text-xs text-tertiary mt-1 mb-4">播放片段、单词和听写句子时的默认速度</p>
            <div className="flex items-center gap-1 flex-wrap">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setSpeed(s);
                    setCurrentRate(s);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    settings.defaultSpeed === s
                      ? 'bg-[#fa2d48]/20 text-[var(--accent)]'
                      : 'text-secondary hover:bg-[var(--bg-tertiary)] hover:text-secondary'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Default loop count */}
          <div className="rounded-xl p-5 surface-card">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <HiArrowPath size={16} className="text-tertiary" />
              默认重复次数
            </h3>
            <p className="text-xs text-tertiary mt-1 mb-4">播放片段、单词和听写句子时的默认循环次数</p>
            <div className="flex items-center gap-1 flex-wrap">
              {LOOP_COUNTS.map(n => (
                <button
                  key={n}
                  onClick={() => setLoopCount(n)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    settings.defaultLoopCount === n
                      ? 'bg-[#fa2d48]/20 text-[var(--accent)]'
                      : 'text-secondary hover:bg-[var(--bg-tertiary)] hover:text-secondary'
                  }`}
                >
                  {n}次
                </button>
              ))}
            </div>
          </div>

          {/* Theme toggle */}
          <div className="rounded-xl p-5 surface-card">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              {themeMode === 'dark' ? <HiMoon size={16} className="text-tertiary" /> : <HiSun size={16} className="text-amber-400" />}
              主题
            </h3>
            <p className="text-xs text-tertiary mt-1 mb-3">切换深色/浅色模式</p>
            <button onClick={toggleTheme}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors cursor-pointer w-full surface-hover">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: themeMode === 'dark' ? '#191919' : '#f0f0f0' }}>
                {themeMode === 'dark' ? <HiMoon size={16} className="text-secondary" /> : <HiSun size={16} className="text-amber-500" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-primary">{themeMode === 'dark' ? '深色模式' : '浅色模式'}</p>
                <p className="text-xs text-tertiary">点击切换到 {themeMode === 'dark' ? '浅色' : '深色'} 模式</p>
              </div>
            </button>
          </div>

          {/* Daily goal */}
          <div className="rounded-xl p-5 surface-card">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <HiPlay size={16} className="text-tertiary" />
              每日学习目标
            </h3>
            <p className="text-xs text-tertiary mt-1 mb-3">设置每日听力时长目标，达到目标后会收到通知提醒</p>
            <div className="flex items-center gap-3">
              {[0, 5, 10, 15, 30, 60].map(m => (
                <button key={m} onClick={() => setDailyGoal(m)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    settings.dailyGoalMinutes === m
                      ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                      : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-tertiary)]'
                  }`}>
                  {m === 0 ? '关闭' : `${m}分`}
                </button>
              ))}
            </div>
            {settings.dailyGoalMinutes > 0 && (
              <p className="text-xs text-tertiary mt-2">每天学习 {settings.dailyGoalMinutes} 分钟</p>
            )}
          </div>

          {/* Word playback offset */}
          <div className="rounded-xl p-5 surface-card">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <HiClock size={16} className="text-tertiary" />
              单词播放偏移
            </h3>
            <p className="text-xs text-tertiary mt-1 mb-4">点击单词时间戳时，前后扩展 N 秒作为播放范围</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setOffset(Math.max(0.5, settings.wordPlayOffset - 0.5))}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-hover)] text-secondary hover:bg-[var(--bg-active)] hover:text-white transition-colors cursor-pointer">
                <HiMinus size={16}/>
              </button>
              <div className="flex-1">
                <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${(settings.wordPlayOffset / 5) * 100}%` }}/>
                </div>
              </div>
              <button onClick={() => setOffset(Math.min(5, settings.wordPlayOffset + 0.5))}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-hover)] text-secondary hover:bg-[var(--bg-active)] hover:text-white transition-colors cursor-pointer">
                <HiPlus size={16}/>
              </button>
              <span className="text-lg font-bold text-primary w-12 text-center tabular-nums">{settings.wordPlayOffset}s</span>
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="rounded-xl p-5 surface-card">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <HiSpeakerWave size={16} className="text-tertiary" />
              快捷键
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ['Space', '播放/暂停'],
                ['← →', '上/下一句'],
                ['Shift ← →', '前进/后退 5 秒'],
                ['↑ ↓', '上/下一句'],
                ['R', '切换循环模式'],
                ['1-5', '切换速度'],
                ['S', '保存当前句为片段'],
                ['Esc', '取消选中'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd className="px-2 py-0.5 rounded-md bg-[var(--bg-hover)] text-xs text-secondary font-mono border border-[var(--border-secondary)]">{key}</kbd>
                  <span className="text-xs text-tertiary">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
