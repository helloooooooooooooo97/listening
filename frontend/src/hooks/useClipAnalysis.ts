import { useState, useRef, useCallback } from 'react';
import type { ClipAnalysis } from '../types/lesson';
import { useAiStore } from '../stores/aiStore';
import { useToastStore } from '../stores/toastStore';

export function useClipAnalysis() {
  const [clipAnalyses, setClipAnalyses] = useState<Map<string, ClipAnalysis>>(new Map());
  const [analyzingClips, setAnalyzingClips] = useState<Set<string>>(new Set());
  const [viewingAnalysis, setViewingAnalysis] = useState<ClipAnalysis | null>(null);
  const analyzeClipFn = useAiStore(s => s.analyzeClip);
  const addToast = useToastStore(s => s.addToast);

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
