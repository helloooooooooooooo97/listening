import { create } from 'zustand';
import { getFavorites, addFavorite as apiAdd, removeFavorite } from '../lib/api';
import type { FavoriteItem } from '../lib/api';

interface FavoritesState {
  items: FavoriteItem[];
  loaded: boolean;
  loadFavorites: () => Promise<void>;
  toggle: (item: { item_id: string; item_type: string; title: string; subtitle?: string; extra_data?: string }) => Promise<void>;
  isFav: (item_id: string, item_type: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  items: [],
  loaded: false,

  loadFavorites: async () => {
    try {
      const items = await getFavorites();
      set({ items, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  toggle: async (item) => {
    const existing = get().items.find(i => i.item_id === item.item_id && i.item_type === item.item_type);
    if (existing) {
      await removeFavorite(existing.id);
      set(s => ({ items: s.items.filter(i => i.id !== existing.id) }));
    } else {
      const result = await apiAdd({
        item_id: item.item_id,
        item_type: item.item_type,
        title: item.title,
        subtitle: item.subtitle || '',
        extra_data: item.extra_data || '{}',
      });
      if (result && 'id' in result) {
        set(s => ({ items: [result as FavoriteItem, ...s.items] }));
      }
    }
  },

  isFav: (item_id, item_type) => {
    return get().items.some(i => i.item_id === item_id && i.item_type === item_type);
  },
}));
