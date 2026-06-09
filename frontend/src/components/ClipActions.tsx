import { useState } from 'react';
import { HiSparkles, HiPencil, HiTrash, HiPlusCircle } from 'react-icons/hi2';
import type { AudioClip, ClipAnalysis } from '../types/lesson';
import EditClipModal from './EditClipModal';

interface ClipActionsProps {
  clip: AudioClip;
  /** Override the clip's edit handler (default: internal EditClipModal) */
  onEdit?: (id: string, data: { note: string; color: string }) => void;
  onDelete?: (id: string) => void;
  onAddToQueue?: (clip: AudioClip) => void;

  /** AI analysis — supply to enable the AI sparkle button */
  analysis?: ClipAnalysis | null;
  isAnalyzing?: boolean;
  onAnalyze?: (text: string) => void;
  onViewAnalysis?: (analysis: ClipAnalysis) => void;

  /** Visual size */
  size?: 'sm' | 'md';
}

export default function ClipActions({
  clip,
  onEdit,
  onDelete,
  onAddToQueue,
  analysis,
  isAnalyzing,
  onAnalyze,
  onViewAnalysis,
  size = 'sm',
}: ClipActionsProps) {
  const [editing, setEditing] = useState(false);

  const btnClass = size === 'sm'
    ? 'p-1 text-tertiary hover:text-secondary transition-colors cursor-pointer'
    : 'p-1.5 text-tertiary hover:text-secondary transition-colors cursor-pointer';

  const iconSize = size === 'sm' ? 11 : 13;

  return (
    <>
      <div className="relative flex-shrink-0 flex items-center gap-0.5">
        {/* AI Analysis */}
        {analysis ? (
          <button
            onClick={e => { e.stopPropagation(); onViewAnalysis?.(analysis); }}
            className={`${btnClass} text-amber-400/70 hover:text-amber-400`}
            title="查看解析"
          >
            <HiSparkles size={iconSize} />
          </button>
        ) : isAnalyzing ? (
          <span className={`${btnClass} text-tertiary/50`} title="解析中...">
            <HiSparkles size={iconSize} className="animate-pulse" />
          </span>
        ) : onAnalyze ? (
          <button
            onClick={e => { e.stopPropagation(); onAnalyze(clip.text); }}
            className={btnClass}
            title="AI 解析"
          >
            <HiSparkles size={iconSize} />
          </button>
        ) : null}

        {/* Edit (pencil) */}
        {(onEdit || true) && (
          <button
            onClick={e => { e.stopPropagation(); setEditing(true); }}
            className={btnClass}
            title="编辑"
          >
            <HiPencil size={iconSize} />
          </button>
        )}

        {/* Add to queue */}
        {onAddToQueue && (
          <button
            onClick={e => { e.stopPropagation(); onAddToQueue(clip); }}
            className={`${btnClass} hover:text-blue-400`}
            title="加入队列"
          >
            <HiPlusCircle size={iconSize} />
          </button>
        )}

        {/* Delete */}
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(clip.id); }}
            className={`${btnClass} hover:text-[var(--accent)]`}
            title="删除"
          >
            <HiTrash size={iconSize} />
          </button>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <EditClipModal
          clip={clip}
          onSave={(id, data) => {
            if (onEdit) onEdit(id, data);
            else {
              // Default: use the store's updateClip — the parent should provide onEdit
            }
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
