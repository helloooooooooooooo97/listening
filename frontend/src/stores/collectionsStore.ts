import { create } from 'zustand';
import type { CollectionSummary, CollectionDetail, CollectionItem } from '../types/lesson';
import {
  getCollections as apiGetCollections,
  getCollection as apiGetCollection,
  createCollection as apiCreateCollection,
  updateCollection as apiUpdateCollection,
  deleteCollection as apiDeleteCollection,
  refreshCollection as apiRefreshCollection,
  addCollectionItem as apiAddItem,
  removeCollectionItem as apiRemoveItem,
  reorderCollectionItems as apiReorder,
  clearCollectionItems as apiClear,
} from '../lib/api';

interface CollectionsState {
  collections: CollectionSummary[];
  current: CollectionDetail | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;

  loadCollections: () => Promise<void>;
  loadCollection: (id: number) => Promise<void>;
  create: (name: string, icon?: string, color?: string) => Promise<CollectionSummary | null>;
  update: (id: number, data: { name?: string; icon?: string; color?: string }) => Promise<void>;
  remove: (id: number) => Promise<void>;
  refresh: (id: number) => Promise<void>;
  addItem: (collectionId: number, item: {
    item_type: string;
    item_ref: string;
    lesson_id?: string;
    lesson_title?: string;
    title?: string;
    subtitle?: string;
    start_time?: number;
    end_time?: number;
    extra_data?: string;
  }) => Promise<void>;
  removeItem: (collectionId: number, itemId: number) => Promise<void>;
  clearItems: (collectionId: number) => Promise<void>;
}

export const useCollectionsStore = create<CollectionsState>((set, get) => ({
  collections: [],
  current: null,
  loaded: false,
  loading: false,
  error: null,

  loadCollections: async () => {
    set({ loading: true, error: null });
    try {
      const collections = await apiGetCollections();
      set({ collections, loaded: true, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false, loaded: true });
    }
  },

  loadCollection: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const current = await apiGetCollection(id);
      set({ current, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  create: async (name, icon, color) => {
    try {
      const col = await apiCreateCollection({ name, icon, color });
      set(s => ({ collections: [col, ...s.collections] }));
      return col;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },

  update: async (id, data) => {
    try {
      const updated = await apiUpdateCollection(id, data);
      set(s => ({
        collections: s.collections.map(c => c.id === id ? { ...c, ...updated } : c),
        current: s.current?.id === id ? { ...s.current, ...updated } : s.current,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  remove: async (id) => {
    try {
      await apiDeleteCollection(id);
      set(s => ({
        collections: s.collections.filter(c => c.id !== id),
        current: s.current?.id === id ? null : s.current,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  refresh: async (id) => {
    try {
      const result = await apiRefreshCollection(id);
      set(s => ({
        current: s.current?.id === id
          ? { ...s.current, items: result.items, item_count: result.item_count }
          : s.current,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  addItem: async (collectionId, item) => {
    try {
      const newItem = await apiAddItem(collectionId, item);
      set(s => ({
        collections: s.collections.map(c =>
          c.id === collectionId ? { ...c, item_count: c.item_count + 1 } : c
        ),
        current: s.current?.id === collectionId
          ? { ...s.current, items: [...s.current.items, newItem], item_count: s.current.item_count + 1 }
          : s.current,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  removeItem: async (collectionId, itemId) => {
    try {
      await apiRemoveItem(collectionId, itemId);
      set(s => ({
        collections: s.collections.map(c =>
          c.id === collectionId ? { ...c, item_count: Math.max(0, c.item_count - 1) } : c
        ),
        current: s.current?.id === collectionId
          ? {
              ...s.current,
              items: s.current.items.filter(i => i.id !== itemId),
              item_count: Math.max(0, s.current.item_count - 1),
            }
          : s.current,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  clearItems: async (collectionId) => {
    try {
      await apiClear(collectionId);
      set(s => ({
        collections: s.collections.map(c =>
          c.id === collectionId ? { ...c, item_count: 0 } : c
        ),
        current: s.current?.id === collectionId
          ? { ...s.current, items: [], item_count: 0 }
          : s.current,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
