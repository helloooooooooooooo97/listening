import { useState, useEffect, useRef } from 'react';
import { HiPencilSquare, HiPlay, HiChevronDown, HiChevronUp } from 'react-icons/hi2';
import type { ListeningLesson, AudioClip } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';
import { getDictationRecords, getLessonById, type AudioGroup } from '../lib/api';

export default function DictationHistoryView() {
  const [groups, setGroups] = useState<AudioGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAudios, setExpandedAudios] = useState<Set<string>>(new Set());
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);
  const setLoopTarget = useAudioStore(s => s.setLoopTarget);
  const audioCache = useRef<Record<string, ListeningLesson>>({});

  const playSentence = async (audioId: string, sentenceIndex: number) => {
    let lesson = audioCache.current[audioId];
    if (!lesson) {
      lesson = await getLessonById(audioId);
      audioCache.current[audioId] = lesson;
    }
    const transcript = lesson.transcript;
    if (!transcript || !transcript[sentenceIndex]) return;
    const sentence = transcript[sentenceIndex];

    // Create a clip from this sentence — plays once, auto-stops at sentence end
    const sentenceClip: AudioClip = {
      id: `sent-${audioId}-${sentenceIndex}`,
      lessonId: audioId,
      lessonTitle: lesson.title,
      startTime: sentence.start,
      endTime: sentence.end,
      text: sentence.text,
      note: '',
      startWordId: '',
      endWordId: '',
      createdAt: '',
    };
    setLoopTarget(1);
    playClip(sentenceClip, lesson);
  };

  useEffect(() => {
    getDictationRecords(500)
      .then(data => {
        setGroups(data.audios || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleExpand = (audioId: string) => {
    setExpandedAudios(prev => {
      const next = new Set(prev);
      if (next.has(audioId)) next.delete(audioId);
      else next.add(audioId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0b]">
        <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">听写记录</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {groups.length === 0 ? (
          <div className="text-center py-16">
            <HiPencilSquare size={40} className="text-white/10 mx-auto mb-4" />
            <p className="text-white/20 text-sm">还没有听写记录</p>
            <p className="text-white/10 text-xs mt-1">在音频中进入听写模式开始练习</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {groups.map((g) => {
              const isExpanded = expandedAudios.has(g.audio_id);
              return (
                <div key={g.audio_id} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {/* Audio header */}
                  <div
                    onClick={() => toggleExpand(g.audio_id)}
                    className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Score circle */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background:
                          g.avg_score >= 80
                            ? 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(52,211,153,0.15))'
                            : g.avg_score >= 50
                            ? 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(251,191,36,0.15))'
                            : 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(248,113,113,0.15))',
                      }}
                    >
                      <span
                        className="text-sm font-bold"
                        style={{
                          color:
                            g.avg_score >= 80 ? '#34d399' : g.avg_score >= 50 ? '#fbbf24' : '#f87171',
                        }}
                      >
                        {g.avg_score}%
                      </span>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-bold text-white/80">{g.audio_title}</h2>
                      <p className="text-[11px] text-white/25 mt-0.5">
                        {g.total_sentences} 个句子 · 最近练习 {g.last_practiced?.slice(0, 10)}
                      </p>
                    </div>
                    {/* Play */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        getLessonById(g.audio_id)
                          .then((l) => playLesson(l));
                      }}
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-colors cursor-pointer flex-shrink-0"
                      title="播放此音频"
                    >
                      <HiPlay size={14} />
                    </button>
                    {/* Expand toggle */}
                    <div className="text-white/15 flex-shrink-0">
                      {isExpanded ? <HiChevronUp size={16} /> : <HiChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded: sentence details */}
                  {isExpanded && (
                    <div className="px-6 pb-5 space-y-3 border-t border-white/[0.03] pt-4">
                      {g.records.map((r, i) => {
                        const isPerfect = r.score >= 100;
                        const hasDetail = r.user_input || r.expected_text;
                        return (
                          <div
                            key={i}
                            className="flex gap-4 py-3 border-b border-white/[0.02] last:border-0"
                          >
                            {/* Left: score + index */}
                            <div className="flex-shrink-0 w-16 text-center">
                              <span
                                className={`inline-block text-lg font-bold font-mono ${
                                  r.score >= 80
                                    ? 'text-emerald-400'
                                    : r.score >= 50
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {r.score}%
                              </span>
                              <p className="text-[10px] text-white/15 mt-0.5">
                                第{r.sentence_index + 1}句
                              </p>
                            </div>
                            {/* Middle: content */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Expected text */}
                              {r.expected_text && (
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] text-emerald-400/50 flex-shrink-0 mt-0.5">正确</span>
                                  <p className="text-[13px] text-emerald-300/70 leading-relaxed break-all">
                                    {r.expected_text}
                                  </p>
                                </div>
                              )}
                              {/* User input (if different) */}
                              {hasDetail && !isPerfect && r.user_input && (
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] text-red-400/50 flex-shrink-0 mt-0.5">你的</span>
                                  <p className="text-[13px] text-red-300/50 leading-relaxed break-all line-through">
                                    {r.user_input || <span className="italic text-white/10">(未输入)</span>}
                                  </p>
                                </div>
                              )}
                              {r.score === 0 && !r.user_input && (
                                <div className="flex items-start gap-2">
                                  <span className="text-[10px] text-white/15 flex-shrink-0 mt-0.5">跳过</span>
                                  <p className="text-[12px] text-white/10 italic">已跳过此句</p>
                                </div>
                              )}
                              {/* Date */}
                              <p className="text-[10px] text-white/10">{r.created_at?.slice(0, 16)}</p>
                            </div>
                            {/* Right: play sentence */}
                            <button
                              onClick={() => playSentence(g.audio_id, r.sentence_index)}
                              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] text-white/20 hover:text-white/50 transition-colors cursor-pointer flex-shrink-0 self-center"
                              title="播放此句"
                            >
                              <HiPlay size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
