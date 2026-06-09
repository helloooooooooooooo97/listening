import { useState, useMemo } from 'react';
import type { AudioClip, CollectionItem } from '../types/lesson';
import { normalizeColor } from '../constants/colors';

export const COLOR_HEX = ['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7'];

function getExtraColor(extraData?: string): string {
  if (!extraData) return '';
  try {
    const parsed = JSON.parse(extraData);
    return typeof parsed?.color === 'string' ? normalizeColor(parsed.color) : '';
  } catch {
    return '';
  }
}

function getCollectionClipColor(item: CollectionItem, allClips: AudioClip[]): string {
  return normalizeColor(allClips.find(c => c.id === String(item.item_ref))?.color)
    || getExtraColor(item.extra_data);
}

export function useCollectionFilter(items: CollectionItem[], allClips: AudioClip[]) {
  const [playTypes, setPlayTypes] = useState<Set<string>>(new Set(['audio', 'clip', 'sentence', 'word']));
  const [playColors, setPlayColors] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (!playTypes.has(item.item_type)) return false;
      if (item.item_type === 'clip' && playColors.size > 0 && playColors.size < COLOR_HEX.length) {
        const clipColor = getCollectionClipColor(item, allClips);
        return playColors.has(clipColor);
      }
      return true;
    });
  }, [items, playTypes, playColors, allClips]);

  const filteredCount = filteredItems.length;
  const hasClips = items.some(i => i.item_type === 'clip');

  return {
    playTypes,
    setPlayTypes,
    playColors,
    setPlayColors,
    filteredItems,
    filteredCount,
    hasClips,
    getCollectionClipColor: (item: CollectionItem) => getCollectionClipColor(item, allClips),
  };
}
