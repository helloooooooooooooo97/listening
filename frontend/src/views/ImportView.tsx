import { useState, useRef, useCallback } from 'react';
import { HiCloudArrowUp, HiCheck, HiXMark, HiMusicalNote, HiArrowPath } from 'react-icons/hi2';
import { API_BASE } from '../lib/api';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface ImportTask {
  task_id: string;
  status: string;
  progress: number;
  error?: string;
  lesson_id?: string;
}

export default function ImportView() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [level, setLevel] = useState('A2');
  const [sourceUrl, setSourceUrl] = useState('');
  const [task, setTask] = useState<ImportTask | null>(null);
  const [polling, setPolling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validFile = (f: File) => ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', ''].includes(f.type) ||
    f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.m4a');

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && validFile(f)) setFile(f);
  }, []);

  const pollStatus = async (taskId: string) => {
    setPolling(true);
    const poll = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/lessons/import/${taskId}`);
        const data: ImportTask = await r.json();
        setTask(data);
        if (data.status === 'completed' || data.status === 'failed') {
          setPolling(false);
          return;
        }
        setTimeout(poll, 1500);
      } catch {
        setPolling(false);
      }
    };
    poll();
  };

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;
    const form = new FormData();
    form.append('file', file);
    form.append('title', title.trim());
    form.append('subtitle', subtitle.trim());
    form.append('level', level);
    form.append('source_url', sourceUrl.trim());
    try {
      const r = await fetch(`${API_BASE}/api/lessons/import`, { method: 'POST', body: form });
      const data = await r.json();
      setTask({ ...data, progress: 0 });
      pollStatus(data.task_id);
    } catch { }
  };

  const reset = () => {
    setFile(null); setTitle(''); setSubtitle(''); setLevel('A2'); setSourceUrl(''); setTask(null); setPolling(false);
  };

  const LABELS: Record<string, string> = {
    pending: '等待处理',
    transcribing: 'WhisperX 转写中...',
    aligning: '词对齐中...',
    completed: '导入完成！',
    failed: '导入失败',
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-primary tracking-tight flex items-center gap-2">
          <HiCloudArrowUp size={22} />
          导入音频
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Upload zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={`rounded-2xl p-10 text-center cursor-pointer transition-all border-2 border-dashed ${
              dragOver ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-primary)] hover:border-[var(--accent)]'
            }`}>
            <input ref={inputRef} type="file" accept=".mp3,.wav,.m4a,.ogg" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
            {file ? (
              <div className="space-y-2">
                <HiMusicalNote size={32} className="text-[var(--accent)] mx-auto" />
                <p className="text-sm text-primary font-medium">{file.name}</p>
                <p className="text-xs text-tertiary">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                <button onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="text-xs text-tertiary hover:text-secondary underline cursor-pointer">重新选择</button>
              </div>
            ) : (
              <div className="space-y-3">
                <HiCloudArrowUp size={40} className="text-tertiary mx-auto" />
                <p className="text-sm text-primary font-medium">拖拽音频文件到这里</p>
                <p className="text-xs text-tertiary">或点击选择 MP3 / WAV / M4A 文件</p>
              </div>
            )}
          </div>

          {/* Metadata form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs text-secondary font-medium block mb-1">标题 *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                placeholder="课程标题" />
            </div>
            <div>
              <label className="text-xs text-secondary font-medium block mb-1">副标题</label>
              <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                placeholder="可选" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-secondary font-medium block mb-1">难度</label>
                <select value={level} onChange={e => setLevel(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 cursor-pointer">
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex-[2]">
                <label className="text-xs text-secondary font-medium block mb-1">来源 URL</label>
                <input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  placeholder="可选" />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button onClick={handleSubmit}
            disabled={!file || !title.trim() || polling}
            className="w-full py-2.5 bg-[var(--accent)] on-accent font-semibold rounded-full text-sm transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-default hover:opacity-90">
            {polling ? '导入中...' : '开始导入'}
          </button>

          {/* Progress */}
          {task && (
            <div className="rounded-xl p-5 surface-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary font-medium">{LABELS[task.status] || task.status}</span>
                {task.status === 'completed' && <HiCheck size={20} className="text-emerald-500" />}
                {task.status === 'failed' && <HiXMark size={20} className="text-red-500" />}
                {['pending', 'transcribing', 'aligning'].includes(task.status) && (
                  <HiArrowPath size={16} className="text-tertiary" />
                )}
              </div>
              <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{
                  width: `${task.progress}%`,
                  background: task.status === 'failed' ? 'var(--accent)' :
                    'linear-gradient(90deg, var(--accent), #ff6b7f)',
                }} />
              </div>
              {task.status === 'completed' && (
                <p className="text-xs text-emerald-500">导入完成！刷新页面即可看到新课程。</p>
              )}
              {task.error && (
                <p className="text-xs text-red-400">{task.error}</p>
              )}
              {(task.status === 'completed' || task.status === 'failed') && (
                <button onClick={reset} className="text-xs text-tertiary hover:text-secondary underline cursor-pointer">重新导入</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
