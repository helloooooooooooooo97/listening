import { HiMinus, HiPlus, HiClock, HiSpeakerWave, HiPlay, HiArrowPath, HiSun, HiMoon, HiSparkles, HiEye, HiEyeSlash, HiCheck, HiXMark } from 'react-icons/hi2';
import { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useThemeStore } from '../stores/themeStore';
import { useAudioStore } from '../stores/audioStore';
import { useAiStore } from '../stores/aiStore';
import type { AiProviderId } from '../types/lesson';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2.0];
const LOOP_COUNTS = [1, 2, 3, 5, 8, 10];

const PROVIDER_OPTIONS: { id: AiProviderId; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'custom', label: '自定义' },
];

const PROVIDER_PRESETS: Record<AiProviderId, { apiBase: string; model: string }> = {
  openai:     { apiBase: 'https://api.openai.com/v1',            model: 'gpt-4o-mini' },
  deepseek:   { apiBase: 'https://api.deepseek.com/v1',           model: 'deepseek-chat' },
  anthropic:  { apiBase: 'https://api.anthropic.com/v1',          model: 'claude-3-haiku-20240307' },
  custom:     { apiBase: '',                                       model: '' },
};

export default function SettingsView() {
  const settings = useSettingsStore(s => s.settings);
  const setOffset = useSettingsStore(s => s.setWordPlayOffset);
  const setSpeed = useSettingsStore(s => s.setDefaultSpeed);
  const setLoopCount = useSettingsStore(s => s.setDefaultLoopCount);
  const setDailyGoal = useSettingsStore(s => s.setDailyGoalMinutes);
  const setCurrentRate = useAudioStore(s => s.setRate);
  const themeMode = useThemeStore(s => s.mode);
  const toggleTheme = useThemeStore(s => s.toggle);

  // AI config state
  const providers = useAiStore(s => s.providers);
  const saveProvider = useAiStore(s => s.saveProvider);
  const removeProvider = useAiStore(s => s.removeProvider);
  const setDefaultProvider = useAiStore(s => s.setDefaultProvider);
  const testConnection = useAiStore(s => s.testConnection);

  const [selectedId, setSelectedId] = useState<AiProviderId>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState(PROVIDER_PRESETS.openai.apiBase);
  const [model, setModel] = useState(PROVIDER_PRESETS.openai.model);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [saving, setSaving] = useState(false);

  // Load existing config when selecting a provider
  const handleSelectProvider = (id: AiProviderId) => {
    setSelectedId(id);
    const existing = providers.find(p => p.id === id);
    if (existing) {
      setApiKey(existing.apiKey);
      setApiBase(existing.apiBase);
      setModel(existing.model);
    } else {
      const preset = PROVIDER_PRESETS[id];
      setApiKey('');
      setApiBase(preset.apiBase);
      setModel(preset.model);
    }
    setTestResult('idle');
  };

  const handleSave = () => {
    setSaving(true);
    saveProvider({
      id: selectedId,
      name: PROVIDER_OPTIONS.find(o => o.id === selectedId)?.label || selectedId,
      apiBase,
      apiKey: apiKey.trim(),
      model: model.trim() || PROVIDER_PRESETS[selectedId].model,
      isDefault: providers.length === 0 ? true : (providers.find(p => p.id === selectedId)?.isDefault ?? false),
    });
    setTimeout(() => setSaving(false), 800);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('idle');
    const ok = await testConnection({
      id: selectedId,
      name: '',
      apiBase,
      apiKey: apiKey.trim(),
      model: model.trim() || PROVIDER_PRESETS[selectedId].model,
      isDefault: false,
    });
    setTestResult(ok ? 'ok' : 'fail');
    setTesting(false);
  };

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

          {/* AI 翻译配置 */}
          <div className="rounded-xl p-5 surface-card">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <HiSparkles size={16} className="text-[var(--accent)]" />
              AI 翻译
            </h3>
            <p className="text-xs text-tertiary mt-1 mb-4">
              配置 AI 厂商 Token 后，可在播放详情中一键翻译句子。Token 仅存储在本地浏览器中，不会上传到任何服务器。
            </p>

            {/* Provider selector */}
            <div className="flex items-center gap-1 mb-4 flex-wrap">
              {PROVIDER_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => handleSelectProvider(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    selectedId === opt.id
                      ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                      : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-tertiary)]'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* API Key input */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-secondary block mb-1">API Key</label>
                <div className="relative">
                  <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 pr-8 text-primary outline-none focus:ring-1 focus:ring-[var(--accent)]/30 placeholder:text-tertiary font-mono" />
                  <button onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-secondary cursor-pointer">
                    {showKey ? <HiEyeSlash size={14} /> : <HiEye size={14} />}
                  </button>
                </div>
              </div>

              {/* API Base (only editable for custom) */}
              {selectedId === 'custom' && (
                <div>
                  <label className="text-xs text-secondary block mb-1">API 地址</label>
                  <input type="url" value={apiBase} onChange={e => setApiBase(e.target.value)}
                    placeholder="https://..."
                    className="w-full text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-primary outline-none focus:ring-1 focus:ring-[var(--accent)]/30 placeholder:text-tertiary" />
                </div>
              )}

              {/* Model */}
              <div>
                <label className="text-xs text-secondary block mb-1">
                  模型 {selectedId === 'custom' ? '(必填)' : '(可选，留空用默认值)'}
                </label>
                <input type="text" value={model} onChange={e => setModel(e.target.value)}
                  placeholder={PROVIDER_PRESETS[selectedId]?.model || 'gpt-4o-mini'}
                  className="w-full text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-primary outline-none focus:ring-1 focus:ring-[var(--accent)]/30 placeholder:text-tertiary" />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handleSave} disabled={!apiKey.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent)] on-accent hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors cursor-pointer">
                  <HiCheck size={13} />
                  {saving ? '已保存' : '保存'}
                </button>
                <button onClick={handleTest} disabled={!apiKey.trim() || testing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-[var(--border-primary)] text-secondary hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors cursor-pointer">
                  {testing ? <HiArrowPath size={13} /> : testResult === 'ok' ? <HiCheck size={13} className="text-emerald-500" /> : testResult === 'fail' ? <HiXMark size={13} className="text-red-500" /> : null}
                  {testing ? '测试中...' : testResult === 'ok' ? '连接成功' : testResult === 'fail' ? '连接失败' : '测试连接'}
                </button>
                {providers.find(p => p.id === selectedId) && (
                  <button onClick={() => { removeProvider(selectedId); handleSelectProvider(selectedId); }}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-tertiary hover:text-red-400 transition-colors cursor-pointer">
                    清除
                  </button>
                )}
              </div>

              {/* Configured providers list */}
              {providers.length > 0 && (
                <div className="pt-3 border-t border-[var(--border-secondary)]">
                  <p className="text-xs text-tertiary mb-2">已配置的厂商：</p>
                  <div className="space-y-1.5">
                    {providers.map(p => (
                      <div key={p.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-primary)]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-primary">{p.name}</span>
                          <span className="text-[10px] text-tertiary font-mono">{p.model}</span>
                          {p.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">默认</span>}
                        </div>
                        {!p.isDefault && (
                          <button onClick={() => setDefaultProvider(p.id)}
                            className="text-[10px] text-tertiary hover:text-secondary transition-colors cursor-pointer">
                            设为默认
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
