import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranscriptLine, TranscriptWord } from '../types/lesson';
import { useClipsStore } from '../stores/clipsStore';

interface Props {
  lessonId: string;
  lessonTitle: string;
  lines: TranscriptLine[];
  words: TranscriptWord[];
  currentTime: number;
  onSeek: (time: number) => void;
}

interface WordSelection {
  startWord: TranscriptWord;
  endWord: TranscriptWord;
}

export default function TranscriptView({
  lessonId,
  lessonTitle,
  lines,
  words,
  currentTime,
  onSeek,
}: Props) {
  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addClip = useClipsStore((s) => s.addClip);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState<WordSelection | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<TranscriptWord | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [clipNote, setClipNote] = useState('');

  // Find active sentence
  let activeLineIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (currentTime >= lines[i].start - 0.1) {
      activeLineIndex = i;
      break;
    }
  }

  // Find active word
  let activeWordId: string | null = null;
  for (let i = words.length - 1; i >= 0; i--) {
    if (currentTime >= words[i].start && currentTime < words[i].end) {
      activeWordId = words[i].id;
      break;
    }
  }

  // Auto-scroll
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  // --- Drag selection handlers ---
  const getWordIndex = (wordId: string) =>
    words.findIndex((w) => w.id === wordId);

  const handleWordMouseDown = useCallback(
    (word: TranscriptWord, e: React.MouseEvent) => {
      e.preventDefault();
      setPendingAnchor(word);
      setIsDragging(true);
      setSelection({ startWord: word, endWord: word });
      setShowToolbar(false);
    },
    []
  );

  const handleWordMouseEnter = useCallback(
    (word: TranscriptWord) => {
      if (!isDragging || !pendingAnchor) return;
      const anchorIdx = getWordIndex(pendingAnchor.id);
      const hoverIdx = getWordIndex(word.id);
      if (anchorIdx === -1 || hoverIdx === -1) return;

      const startWord = words[Math.min(anchorIdx, hoverIdx)];
      const endWord = words[Math.max(anchorIdx, hoverIdx)];
      setSelection({ startWord, endWord });
    },
    [isDragging, pendingAnchor, words]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setPendingAnchor(null);
    if (selection && selection.startWord.id !== selection.endWord.id) {
      setShowToolbar(true);
    }
  }, [selection]);

  // Click outside to dismiss
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelection(null);
        setShowToolbar(false);
        setClipNote('');
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Save clip
  const handleSaveClip = () => {
    if (!selection) return;
    const startIdx = getWordIndex(selection.startWord.id);
    const endIdx = getWordIndex(selection.endWord.id);
    if (startIdx === -1 || endIdx === -1) return;

    const selectedWords = words.slice(startIdx, endIdx + 1);
    addClip({
      lessonId,
      lessonTitle,
      startWordId: selection.startWord.id,
      endWordId: selection.endWord.id,
      startTime: selection.startWord.start,
      endTime: selection.endWord.end,
      text: selectedWords.map((w) => w.text).join(' '),
      note: clipNote.trim(),
    });

    setSelection(null);
    setShowToolbar(false);
    setClipNote('');
  };

  const handleCancelSelection = () => {
    setSelection(null);
    setShowToolbar(false);
    setClipNote('');
  };

  // Check if a word is in the selection range
  const isWordSelected = (wordId: string) => {
    if (!selection) return false;
    const selStartIdx = getWordIndex(selection.startWord.id);
    const selEndIdx = getWordIndex(selection.endWord.id);
    const wordIdx = getWordIndex(wordId);
    return wordIdx >= selStartIdx && wordIdx <= selEndIdx;
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Floating Clip Toolbar */}
      {showToolbar && selection && (
        <div className="sticky top-0 z-20 bg-white border-2 border-blue-400 rounded-xl shadow-lg p-4 mb-4 animate-in">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-700 mb-1">
                📌 保存片段
              </p>
              <p className="text-sm text-gray-700 italic truncate">
                "{selection.startWord.text} ... {selection.endWord.text}"
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {selection.startWord.text} ... {selection.endWord.text} ({(selection.endWord.end - selection.startWord.start).toFixed(1)}s)
              </p>
              <input
                type="text"
                placeholder="添加标签（如：常用短语、连读、生词..."
                value={clipNote}
                onChange={(e) => setClipNote(e.target.value)}
                className="mt-2 w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveClip();
                  if (e.key === 'Escape') handleCancelSelection();
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              <button
                onClick={handleSaveClip}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
              >
                保存
              </button>
              <button
                onClick={handleCancelSelection}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transcript */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-h-[60vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">📖 文本</h2>
        <p className="text-xs text-gray-400 mb-4">拖拽选中连续词语可保存为片段</p>
        <div className="space-y-2" onMouseUp={handleMouseUp}>
          {lines.map((line, lineIdx) => {
            const isActive = lineIdx === activeLineIndex;
            const lineWords = words.filter(
              (w) => w.start >= line.start - 0.05 && w.end <= line.end + 0.05
            );

            return (
              <div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                className={`transcript-line ${isActive ? 'active' : ''}`}
                onClick={() => onSeek(line.start)}
              >
                <div className="text-xs text-gray-400 mb-1">
                  {formatTime(line.start)} — {formatTime(line.end)}
                </div>
                <p className="text-base leading-relaxed text-gray-800 select-none">
                  {lineWords.length > 0
                    ? lineWords.map((word) => {
                        const selected = isWordSelected(word.id);
                        return (
                          <span
                            key={word.id}
                            data-word-id={word.id}
                            onMouseDown={(e) => handleWordMouseDown(word, e)}
                            onMouseEnter={() => handleWordMouseEnter(word)}
                            className={`inline rounded-sm px-0.5 transition-colors cursor-pointer ${
                              word.id === activeWordId && !selection
                                ? 'bg-yellow-300 text-black'
                                : selected
                                  ? 'bg-blue-200 text-blue-900'
                                  : 'hover:bg-gray-100'
                            }`}
                          >
                            {word.text}{' '}
                          </span>
                        );
                      })
                    : line.text}
                </p>
                {line.note && (
                  <p className="text-sm text-gray-400 mt-1 italic">{line.note}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
