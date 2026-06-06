import { HiMinus, HiPlus } from 'react-icons/hi2';
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
            <h3 className="text-sm font-semibold text-white mb-1">单词播放偏移</h3>
            <p className="text-[12px] text-white/30 mb-4">点击单词时间戳时，从时间点前后各扩展 N 秒播放</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setOffset(Math.max(0.5, settings.wordPlayOffset - 0.5))}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.06] text-white/60 hover:bg-white/[0.12] hover:text-white transition-colors cursor-pointer">
                <HiMinus size={16}/>
              </button>
              <div className="flex-1">
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-[#fa2d48] rounded-full transition-all" style={{ width: `${(settings.wordPlayOffset / 5) * 100}%` }}/>
                </div>
                <div className="flex justify-between text-[10px] text-white/20 mt-1">
                  <span>0.5s</span><span>5s</span>
                </div>
              </div>
              <button
                onClick={() => setOffset(Math.min(5, settings.wordPlayOffset + 0.5))}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.06] text-white/60 hover:bg-white/[0.12] hover:text-white transition-colors cursor-pointer">
                <HiPlus size={16}/>
              </button>
              <span className="text-lg font-bold text-white w-12 text-center tabular-nums">{settings.wordPlayOffset}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
