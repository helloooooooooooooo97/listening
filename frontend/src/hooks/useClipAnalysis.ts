import { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioClip, ClipAnalysis } from '../types/lesson';
import { useAiStore } from '../stores/aiStore';
import { useToastStore } from '../stores/toastStore';

function parseAnalysis(text: string, jsonStr: string): ClipAnalysis | null {
  try {
    return JSON.parse(jsonStr) as ClipAnalysis;
  } catch {
    return null;
  }
}

/**
 * Manage AI clip analysis state.
 * Pre-populates from clips that have `ai_analysis` data from the server.
 */
export function useClipAnalysis(clips?: AudioClip[]) {
  const [clipAnalyses, setClipAnalyses] = useState<Map<string, ClipAnalysis>>(new Map());
  const [analyzingClips, setAnalyzingClips] = useState<Set<string>>(new Set());
  const [viewingAnalysis, setViewingAnalysis] = useState<ClipAnalysis | null>(null);
  const analyzeClipFn = useAiStore(s => s.analyzeClip);
  const addToast = useToastStore(s => s.addToast);

  // Pre-populate from clips with server-side ai_analysis
  useEffect(() => {
    if (!clips) return;
    let changed = false;
    setClipAnalyses(prev => {
      const next = new Map(prev);
      for (const clip of clips) {
        if (clip.ai_analysis && !next.has(clip.text)) {
          const parsed = parseAnalysis(clip.text, clip.ai_analysis);
          if (parsed) {
            next.set(clip.text, parsed);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [clips?.length ?? 0]);

  const analysesRef = useRef(clipAnalyses);
  analysesRef.current = clipAnalyses;
  const analyzingRef = useRef(analyzingClips);
  analyzingRef.current = analyzingClips;

  const handleAnalyze = useCallback((text: string) => {
    if (analysesRef.current.has(text) || analyzingRef.current.has(text)) return;
    setAnalyzingClips(prev => new Set(prev).add(text));
    analyzeClipFn(text)
      .then(analysis => {
        setClipAnalyses(prev => new Map(prev).set(text, analysis));
        setAnalyzingClips(prev => { const n = new Set(prev); n.delete(text); return n; });
      })
      .catch(() => {
        setAnalyzingClips(prev => { const n = new Set(prev); n.delete(text); return n; });
        addToast('AI 分析失败', 'error');
      });
  }, [analyzeClipFn, addToast]);

  return { clipAnalyses, analyzingClips, viewingAnalysis, setViewingAnalysis, handleAnalyze };
}
