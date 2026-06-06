import { HiMinus, HiPlus, HiClock, HiSpeakerWave } from 'react-icons/hi2';
import { useSettingsStore } from '../stores/settingsStore';

export default function SettingsView() {
  const settings = useSettingsStore(s => s.settings);
  const setOffset = useSettingsStore(s => s.setWordPlayOffset);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">设置</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-lg space-y-6">

          {/* Word playback offset */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <HiClock size={16} className="text-white/30" />
              单词播放偏移
            </h3>
            <p className="text-[12px] text-white/30 mt-1 mb-4">点击单词时间戳时，前后扩展 N 秒作为播放范围</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setOffset(Math.max(0.5, settings.wordPlayOffset - 0.5))}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.06] text-white/60 hover:bg-white/[0.12] hover:text-white transition-colors cursor-pointer">
                <HiMinus size={16}/>
              </button>
              <div className="flex-1">
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-[#fa2d48] rounded-full transition-all" style={{ width: `${(settings.wordPlayOffset / 5) * 100}%` }}/>
                </div>
              </div>
              <button onClick={() => setOffset(Math.min(5, settings.wordPlayOffset + 0.5))}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.06] text-white/60 hover:bg-white/[0.12] hover:text-white transition-colors cursor-pointer">
                <HiPlus size={16}/>
              </button>
              <span className="text-lg font-bold text-white w-12 text-center tabular-nums">{settings.wordPlayOffset}s</span>
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <HiSpeakerWave size={16} className="text-white/30" />
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
                  <kbd className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[11px] text-white/50 font-mono border border-white/[0.04]">{key}</kbd>
                  <span className="text-[11px] text-white/30">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
