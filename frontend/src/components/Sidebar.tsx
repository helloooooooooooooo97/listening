import { useState } from 'react';
import type { AudioClip, LessonSummary } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';

type Tab = 'lessons' | 'clips';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  lessons: LessonSummary[];
  selectedLessonId: string | null;
  onSelectLesson: (id: string) => void;
  onPlayLesson: (id: string) => void;
  clips: AudioClip[];
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onPlayClip: (id: string) => void;
  onDeleteClip: (id: string) => void;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ── Level color ── */
function levelColor(level: string) {
  const map: Record<string, string> = {
    'A1': 'bg-emerald-50 text-emerald-700',
    'A2': 'bg-green-50 text-green-700',
    'B1': 'bg-amber-50 text-amber-700',
    'B2': 'bg-orange-50 text-orange-700',
    'C1': 'bg-red-50 text-red-700',
  };
  return map[level] || 'bg-gray-50 text-gray-600';
}

export default function Sidebar({
  activeTab,
  onTabChange,
  lessons,
  selectedLessonId,
  onSelectLesson,
  onPlayLesson,
  clips,
  selectedClipId,
  onSelectClip,
  onPlayClip,
  onDeleteClip,
}: Props) {
  const [search, setSearch] = useState('');

  // ── Global audio state ──
  const storeMode = useAudioStore((s) => s.mode);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const togglePlay = useAudioStore((s) => s.togglePlay);

  // Determine if a specific lesson/clip is the one currently loaded in the player
  const isLessonActive = (id: string) =>
    storeMode.kind === 'lesson' && storeMode.lesson.id === id;
  const isClipActive = (id: string) =>
    storeMode.kind === 'clip' && storeMode.clip.id === id;

  const filteredLessons = lessons.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  const filteredClips = clips.filter(
    (c) =>
      c.text.toLowerCase().includes(search.toLowerCase()) ||
      c.note.toLowerCase().includes(search.toLowerCase()) ||
      c.lessonTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="flex-1 flex flex-col min-w-0 bg-[#fbfbfa] border-r border-gray-200/80 h-full">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
            英语听力
          </h2>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => onTabChange('lessons')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'lessons'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              📚 课程
            </button>
            <button
              onClick={() => onTabChange('clips')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                activeTab === 'clips'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              📌 片段
              {clips.length > 0 && (
                <span className="ml-1 text-gray-400">· {clips.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder={activeTab === 'lessons' ? '搜索课程...' : '搜索片段...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-shadow placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {activeTab === 'lessons' ? (
          /* ═══════════ LESSONS ═══════════ */
          filteredLessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-5xl mb-4">🎧</p>
              <p className="text-gray-400 text-sm font-medium">
                {search ? '没有匹配的课程' : '暂无课程'}
              </p>
              <p className="text-gray-300 text-xs mt-1">
                {search ? '换个关键词试试' : '添加课程 JSON 到 data/lessons/'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLessons.map((lesson) => {
                const isSelected = selectedLessonId === lesson.id;
                return (
                  <div
                    key={lesson.id}
                    onClick={() => onSelectLesson(lesson.id)}
                    className={`group bg-white rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-300 shadow-md ring-1 ring-blue-100'
                        : 'border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md'
                    }`}
                  >
                    {/* Card body */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-semibold text-gray-800 leading-snug truncate">
                            {lesson.title}
                          </h3>
                          <p className="text-[13px] text-gray-400 mt-0.5 truncate">
                            {lesson.subtitle}
                          </p>
                        </div>
                        {/* Play/Pause button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isLessonActive(lesson.id)) {
                              togglePlay();
                            } else {
                              onPlayLesson(lesson.id);
                            }
                          }}
                          className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer group-hover:scale-105 ${
                            isLessonActive(lesson.id) && isPlaying
                              ? 'bg-blue-500 text-white shadow-md'
                              : 'bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white'
                          }`}
                          title={isLessonActive(lesson.id) && isPlaying ? '暂停' : '播放'}
                        >
                          {isLessonActive(lesson.id) && isPlaying ? '⏸' : '▶'}
                        </button>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${levelColor(lesson.level)}`}
                        >
                          {lesson.level}
                        </span>
                        <span className="text-[12px] text-gray-400 flex items-center gap-1">
                          <span>⏱</span> {formatDuration(lesson.duration)}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="text-[12px] text-gray-400">
                          {lesson.sentenceCount} 句
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="text-[12px] text-gray-400">
                          {lesson.wordCount} 词
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isLessonActive(lesson.id)) {
                              togglePlay();
                            } else {
                              onPlayLesson(lesson.id);
                            }
                          }}
                          className={`text-[12px] font-medium flex items-center gap-1 cursor-pointer ${
                            isLessonActive(lesson.id) && isPlaying
                              ? 'text-blue-700'
                              : 'text-blue-600 hover:text-blue-700'
                          }`}
                        >
                          {isLessonActive(lesson.id) && isPlaying ? '⏸ 暂停' : '▶ 播放'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLesson(lesson.id);
                          }}
                          className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1 cursor-pointer"
                        >
                          📖 查看详情
                        </button>
                        <div className="flex-1" />
                        {lesson.sourceURL && (
                          <a
                            href={lesson.sourceURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[12px] text-gray-300 hover:text-blue-400 cursor-pointer"
                            title="音频来源"
                          >
                            🔗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Count footer */}
              <p className="text-center text-[11px] text-gray-300 pt-2">
                共 {filteredLessons.length} 节课程
              </p>
            </div>
          )
        ) : (
          /* ═══════════ CLIPS ═══════════ */
          filteredClips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-5xl mb-4">📌</p>
              <p className="text-gray-400 text-sm font-medium">
                {search ? '没有匹配的片段' : '暂无收藏片段'}
              </p>
              <p className="text-gray-300 text-xs mt-1 max-w-xs">
                {search
                  ? '换个关键词试试'
                  : '在课程文本中拖拽选中连续词语，点击「保存」创建片段'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group by lesson */}
              {(() => {
                const grouped = new Map<string, AudioClip[]>();
                for (const c of filteredClips) {
                  const key = c.lessonId;
                  if (!grouped.has(key)) grouped.set(key, []);
                  grouped.get(key)!.push(c);
                }
                return [...grouped.entries()].map(([lessonId, group]) => (
                  <div key={lessonId}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        📖 {group[0].lessonTitle}
                      </span>
                      <span className="text-[11px] text-gray-300">
                        {group.length} 个片段
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.map((clip) => {
                        const isSelected = selectedClipId === clip.id;
                        const clipDur = clip.endTime - clip.startTime;
                        return (
                          <div
                            key={clip.id}
                            onClick={() => onSelectClip(clip.id)}
                            className={`group bg-white rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-blue-300 shadow-md ring-1 ring-blue-100'
                                : 'border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md'
                            }`}
                          >
                            <div className="p-4">
                              {/* Text preview + play/pause */}
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isClipActive(clip.id)) {
                                      togglePlay();
                                    } else {
                                      onPlayClip(clip.id);
                                    }
                                  }}
                                  className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer group-hover:scale-105 ${
                                    isClipActive(clip.id) && isPlaying
                                      ? 'bg-green-500 text-white shadow-md'
                                      : 'bg-green-50 text-green-500 hover:bg-green-500 hover:text-white'
                                  }`}
                                  title={isClipActive(clip.id) && isPlaying ? '暂停' : '播放片段'}
                                >
                                  {isClipActive(clip.id) && isPlaying ? '⏸' : '▶'}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14px] text-gray-700 leading-relaxed line-clamp-3 font-medium">
                                    "{clip.text}"
                                  </p>
                                </div>
                              </div>

                              {/* Meta */}
                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                  ⏱ {clip.startTime.toFixed(1)}s — {clip.endTime.toFixed(1)}s
                                </span>
                                <span className="text-gray-300">·</span>
                                <span className="text-[11px] text-gray-400">
                                  {clipDur.toFixed(1)}s
                                </span>
                                {clip.note && (
                                  <>
                                    <span className="text-gray-300">·</span>
                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                      {clip.note}
                                    </span>
                                  </>
                                )}
                                <span className="flex-1" />
                                <span className="text-[10px] text-gray-300">
                                  {formatDate(clip.createdAt)}
                                </span>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isClipActive(clip.id)) {
                                      togglePlay();
                                    } else {
                                      onPlayClip(clip.id);
                                    }
                                  }}
                                  className={`text-[12px] font-medium flex items-center gap-1 cursor-pointer ${
                                    isClipActive(clip.id) && isPlaying
                                      ? 'text-green-700'
                                      : 'text-green-600 hover:text-green-700'
                                  }`}
                                >
                                  {isClipActive(clip.id) && isPlaying ? '⏸ 暂停' : '▶ 播放'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectClip(clip.id);
                                  }}
                                  className="text-[12px] text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                  🔍 查看
                                </button>
                                <div className="flex-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteClip(clip.id);
                                  }}
                                  className="text-[12px] text-gray-300 hover:text-red-400 transition-colors cursor-pointer"
                                  title="删除"
                                >
                                  🗑
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}

              <p className="text-center text-[11px] text-gray-300 pt-2">
                共 {filteredClips.length} 个片段
              </p>
            </div>
          )
        )}
      </div>
    </aside>
  );
}
