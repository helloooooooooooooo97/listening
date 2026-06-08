import { useState, useRef, useCallback } from 'react';
import { HiMusicalNote, HiMagnifyingGlass, HiHeart, HiCloudArrowUp, HiCheck, HiXMark, HiArrowPath } from 'react-icons/hi2';
import type { LessonSummary } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { getLessonById } from '../lib/api';

interface Props {
  lessons: LessonSummary[];
}

function fmtDuration(s: number) { const m = Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function CoursesView({ lessons }: Props) {
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [level, setLevel] = useState('A2');
  const [sourceUrl, setSourceUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importTask, setImportTask] = useState<{ status: string; progress: number; error?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const playLesson = useAudioStore(s => s.playLesson);
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);

  const q = search.toLowerCase();
  const fL = lessons.filter(l => l.title.toLowerCase().includes(q) || l.subtitle.toLowerCase().includes(q));

  const grouped = fL.reduce((acc, l) => {
    const cat = l.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(l);
    return acc;
  }, {} as Record<string, LessonSummary[]>);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.mp3')) setFile(f);
  }, []);

  const handleImport = async () => {
    if (!file || !title.trim()) return;
    setImporting(true);
    setImportTask({ status: 'uploading', progress: 0 });
    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('title', title.trim());
      formData.append('subtitle', subtitle.trim() || title.trim());
      formData.append('level', level);
      formData.append('source_url', sourceUrl);
      const r = await fetch('/api/import/upload', { method: 'POST', body: formData });
      const data = await r.json();
      if (data.task_id) {
        setImportTask({ status: 'processing', progress: 0 });
        // Poll for completion
        const poll = setInterval(async () => {
          try {
            const res = await fetch(`/api/import/status/${data.task_id}`);
            const st = await res.json();
            setImportTask(st);
            if (st.status === 'completed' || st.status === 'error') {
              clearInterval(poll);
              setImporting(false);
              if (st.status === 'completed') setTimeout(() => window.location.reload(), 1500);
            }
          } catch { clearInterval(poll); setImporting(false); }
        }, 2000);
      }
    } catch {
      setImportTask({ status: 'error', progress: 0, error: '上传失败' });
      setImporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold text-primary tracking-tight">音频</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowImport(!showImport)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-tertiary hover:text-secondary hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer">
              <HiCloudArrowUp size={13} /> 导入
            </button>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"><HiMagnifyingGlass size={13} /></span>
              <input type="text" placeholder="搜索音频" value={search} onChange={e=>setSearch(e.target.value)}
                className="w-56 pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-tertiary)] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-primary placeholder:text-tertiary"/>
            </div>
          </div>
        </div>

        {/* Import panel */}
        {showImport && (
          <div className="mb-4 p-5 rounded-xl border border-[var(--border-secondary)] animate-fade-in"
            style={{ background: 'var(--bg-tertiary)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-primary">导入音频</h3>
              <button onClick={() => { setShowImport(false); setFile(null); setImportTask(null); }}
                className="text-tertiary hover:text-secondary cursor-pointer"><HiXMark size={16} /></button>
            </div>

            {importing && importTask ? (
              <div className="text-center py-6">
                <HiArrowPath size={24} className="text-[var(--accent)] mx-auto mb-3 animate-spin" />
                <p className="text-sm text-secondary">
                  {importTask.status === 'uploading' ? '上传中...' :
                   importTask.status === 'processing' ? '转写中（约1-3分钟）...' :
                   importTask.status === 'completed' ? '✓ 导入完成！' :
                   `导入失败: ${importTask.error || '未知错误'}`}
                </p>
                {importTask.progress > 0 && (
                  <div className="w-full bg-[var(--bg-primary)] rounded-full h-1.5 mt-3">
                    <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                      style={{ width: `${importTask.progress}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div onDragOver={e=>e.preventDefault()} onDragEnter={()=>setDragOver(true)} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}
                  onClick={()=>fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border-primary)] hover:border-[var(--accent)]/50'}`}>
                  <HiCloudArrowUp size={24} className="text-tertiary mx-auto mb-2" />
                  <p className="text-xs text-tertiary">{file ? file.name : '拖拽 MP3 到此处，或点击选择文件'}</p>
                  <input ref={fileRef} type="file" accept=".mp3" className="hidden" onChange={e=>setFile(e.target.files?.[0] || null)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="标题 *" value={title} onChange={e=>setTitle(e.target.value)}
                    className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-primary outline-none focus:ring-1 focus:ring-[var(--accent)]/30 placeholder:text-tertiary" />
                  <input type="text" placeholder="副标题" value={subtitle} onChange={e=>setSubtitle(e.target.value)}
                    className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-primary outline-none focus:ring-1 focus:ring-[var(--accent)]/30 placeholder:text-tertiary" />
                </div>

                <div className="flex items-center gap-3">
                  <select value={level} onChange={e=>setLevel(e.target.value)}
                    className="text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-primary outline-none">
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <input type="url" placeholder="原文链接 (可选)" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}
                    className="flex-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-primary outline-none focus:ring-1 focus:ring-[var(--accent)]/30 placeholder:text-tertiary" />
                </div>

                <button onClick={handleImport} disabled={!file || !title.trim()}
                  className="w-full text-sm py-2 rounded-xl bg-[var(--accent)] on-accent cursor-pointer disabled:opacity-40 font-medium">
                  开始导入
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {fL.length===0 ? <p className="text-center text-tertiary py-16">{search?'无匹配音频':'暂无音频'}</p> : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-bold text-secondary uppercase tracking-wider">{category}</h2>
                <span className="text-xs text-tertiary">{items.length} 节</span>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {items.map(l=>{
                  const fav = isFav(l.id, 'audio');
                  return (
                  <div key={l.id} onClick={()=>getLessonById(l.id).then(d=>playLesson(d))}
                    className="group cursor-pointer rounded-lg p-1.5 transition-all duration-200 hover:bg-[var(--bg-tertiary)]">
                    <div className="w-full aspect-square rounded-md flex items-center justify-center mb-1 relative"
                      style={{ background: category.includes('IELTS') ? 'var(--ielts-gradient)' : 'var(--card-gradient)' }}>
                      <HiMusicalNote size={18}/>
                      <button onClick={e=>{e.stopPropagation();favToggle({item_id:l.id,item_type:'audio',title:l.title,subtitle:l.subtitle});}}
                        className={`absolute top-1.5 right-1.5 p-1 rounded-full transition-colors cursor-pointer ${fav ? 'text-[var(--accent)]' : 'text-tertiary opacity-0 group-hover:opacity-100 hover:text-secondary'}`}>
                        <HiHeart size={14} />
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-primary truncate">{l.title}</p>
                    <p className="text-xs text-tertiary truncate">{l.subtitle}</p>
                    <span className="inline-block mt-0.5 text-[8px] font-medium px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-tertiary">
                      {l.level} · {fmtDuration(l.duration)}
                    </span>
                  </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
