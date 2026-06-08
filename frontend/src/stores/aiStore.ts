import { create } from 'zustand';
import type { AiProvider, AiProviderId } from '../types/lesson';

/* ── Storage ── */

const STORAGE_KEY = 'ai-providers';
const CACHE_KEY = 'app-translation-cache';
const CACHE_MAX = 200;

/* ── Provider presets ── */

const PRESETS: Record<AiProviderId, { name: string; apiBase: string; model: string }> = {
  openai:     { name: 'OpenAI',       apiBase: 'https://api.openai.com/v1',            model: 'gpt-4o-mini' },
  deepseek:   { name: 'DeepSeek',     apiBase: 'https://api.deepseek.com/v1',           model: 'deepseek-chat' },
  anthropic:  { name: 'Anthropic',    apiBase: 'https://api.anthropic.com/v1',          model: 'claude-3-haiku-20240307' },
  custom:     { name: '自定义',       apiBase: '',                                       model: '' },
};

/* ── Token encoding (simple obfuscation, not encryption) ── */

function encode(s: string): string {
  try { return btoa(s); } catch { return s; }
}
function decode(s: string): string {
  try { return atob(s); } catch { return s; }
}

function loadProviders(): AiProvider[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { id: AiProviderId; apiKey: string; apiBase: string; model: string; isDefault: boolean }[];
    return parsed.map(p => {
      const preset = PRESETS[p.id];
      return {
        id: p.id,
        name: preset?.name || p.id,
        apiBase: p.apiBase || preset?.apiBase || '',
        apiKey: decode(p.apiKey),
        model: p.model || preset?.model || '',
        isDefault: p.isDefault ?? false,
      };
    });
  } catch { return []; }
}

function persist(providers: AiProvider[]) {
  const toSave = providers.map(p => ({
    id: p.id,
    apiKey: encode(p.apiKey),
    apiBase: p.apiBase,
    model: p.model,
    isDefault: p.isDefault,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

/* ── Translation cache (memory + localStorage) ── */

interface CacheEntry {
  result: string;
  timestamp: number;
}
const translationCache = new Map<string, CacheEntry>();

function loadCacheFromStorage() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, CacheEntry>;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [text, entry] of Object.entries(data)) {
      if (entry.timestamp > cutoff) {
        translationCache.set(text, entry);
      }
    }
  } catch {}
}

function saveCacheToStorage() {
  try {
    const obj: Record<string, CacheEntry> = {};
    for (const [text, entry] of translationCache) {
      obj[text] = entry;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    try {
      localStorage.removeItem(CACHE_KEY);
      const recent = [...translationCache.entries()]
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, 50);
      const obj: Record<string, CacheEntry> = {};
      for (const [text, entry] of recent) { obj[text] = entry; }
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch {}
  }
}

loadCacheFromStorage();

function cacheGet(text: string): string | null {
  const entry = translationCache.get(text);
  if (!entry) return null;
  return entry.result;
}

function cacheSet(text: string, result: string) {
  if (translationCache.size >= CACHE_MAX) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [k, v] of translationCache) {
      if (v.timestamp < oldestTime) { oldestTime = v.timestamp; oldestKey = k; }
    }
    if (oldestKey) translationCache.delete(oldestKey);
  }
  translationCache.set(text, { result, timestamp: Date.now() });
  saveCacheToStorage();
}

/* ── AI API calls ── */

async function callOpenAICompat(text: string, apiKey: string, apiBase: string, model: string): Promise<string> {
  const url = `${apiBase.replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是一个英语学习助手。将以下英文句子翻译成中文，语言自然流畅。只返回翻译结果，不要解释。' },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 256,
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text().catch(() => '')}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callAnthropic(text: string, apiKey: string, _apiBase: string, model: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      system: '你是一个英语学习助手。将以下英文句子翻译成中文，语言自然流畅。只返回翻译结果，不要解释。',
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text().catch(() => '')}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

/* ── State ── */

export type TranslateStatus = 'idle' | 'loading' | 'success' | 'error';

interface TranslationState {
  // Per-sentence translation statuses
  translations: Map<number, { status: TranslateStatus; result?: string }>;
}

interface AiState {
  providers: AiProvider[];
  loaded: boolean;

  loadProviders: () => void;
  saveProvider: (provider: AiProvider) => void;
  removeProvider: (id: AiProviderId) => void;
  setDefaultProvider: (id: AiProviderId) => void;
  getDefaultProvider: () => AiProvider | null;

  translate: (text: string) => Promise<string>;
  testConnection: (provider: AiProvider) => Promise<boolean>;
}

export const useAiStore = create<AiState>((set, get) => ({
  providers: [],
  loaded: false,

  loadProviders: () => {
    const providers = loadProviders();
    set({ providers, loaded: true });
  },

  saveProvider: (provider) => {
    set(s => {
      const existing = s.providers.findIndex(p => p.id === provider.id);
      const updated = [...s.providers];
      if (existing >= 0) {
        updated[existing] = provider;
      } else {
        // If first provider, set as default
        if (updated.length === 0) provider.isDefault = true;
        updated.push(provider);
      }
      persist(updated);
      return { providers: updated };
    });
  },

  removeProvider: (id) => {
    set(s => {
      const updated = s.providers.filter(p => p.id !== id);
      // If default was removed, set first remaining as default
      const hadDefault = s.providers.find(p => p.id === id)?.isDefault;
      if (hadDefault && updated.length > 0) updated[0].isDefault = true;
      persist(updated);
      return { providers: updated };
    });
  },

  setDefaultProvider: (id) => {
    set(s => {
      const updated = s.providers.map(p => ({ ...p, isDefault: p.id === id }));
      persist(updated);
      return { providers: updated };
    });
  },

  getDefaultProvider: () => {
    return get().providers.find(p => p.isDefault) || get().providers[0] || null;
  },

  translate: async (text: string): Promise<string> => {
    // Check cache
    const cached = cacheGet(text);
    if (cached) return cached;

    const provider = get().getDefaultProvider();
    if (!provider) throw new Error('未配置 AI 翻译 Token');
    if (!provider.apiKey) throw new Error('API Key 未配置');

    let result: string;
    if (provider.id === 'anthropic') {
      result = await callAnthropic(text, provider.apiKey, provider.apiBase, provider.model);
    } else {
      result = await callOpenAICompat(text, provider.apiKey, provider.apiBase, provider.model);
    }

    cacheSet(text, result);
    return result;
  },

  testConnection: async (provider: AiProvider): Promise<boolean> => {
    try {
      if (provider.id === 'anthropic') {
        await callAnthropic('Hello.', provider.apiKey, provider.apiBase, provider.model);
      } else {
        await callOpenAICompat('Hello.', provider.apiKey, provider.apiBase, provider.model);
      }
      return true;
    } catch {
      return false;
    }
  },
}));
