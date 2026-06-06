# 技术架构 — 英语听力 App `v0.0.6`

> 继承自 [v0.0.5](../v0.0.5/technical-architecture.md)
>
> v0.0.6 零功能变更，仅优化代码架构。

## 后端架构变更

### 数据库连接：request-scoped → singleton

```
v0.0.5: 每个请求 get_conn() → new sqlite3.connect()
v0.0.6: 模块加载时 init_db() 创建单例连接，复用
```

```python
# database.py (v0.0.6)
_conn: sqlite3.Connection | None = None

def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(str(DB_PATH))
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
    return _conn
```

### 单词缓存：on-demand → precomputed

```
v0.0.5: GET /api/words → 遍历 18 个 JSON → 构建 dict → 返回
v0.0.6: 启动时构建缓存 → GET /api/words → 直接查缓存 → 返回
```

```python
# words.py (v0.0.6)
_word_cache: list[dict] | None = None

def _build_cache():
    """Precompute word index from all lesson JSONs."""
    ...

def get_words(...):
    if _word_cache is None:
        _build_cache()
    # filter/sort from cache
```

### 异常中间件

```python
# main.py (v0.0.6)
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})
```

---

## 前端架构变更

### API 层：fetch 散落 → 集中模块

```
v0.0.5: 23 处 fetch() 散落在 12 个文件中
v0.0.6: lib/api.ts 集中全部调用，各组件 import { getXxx } from '../lib/api'
```

```
frontend/src/lib/
└── api.ts              # 全部 API 函数，typed request/response
```

```typescript
// lib/api.ts
const BASE = '';

async function get<T>(url: string): Promise<T> {
  const r = await fetch(BASE + url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export function getOverview() { return get<Overview>('/api/stats/overview'); }
export function getDailyTime(days: number) { return get<{days:DailyDay[]}>(`/api/stats/daily-time?days=${days}`); }
export function getDictationRecords(limit=500) { return get<{audios:AudioGroup[]}>(`/api/stats/dictation-records?limit=${limit}`); }
export function getAudioProgress() { return get<{audios:AudioProgress[]}>('/api/stats/audio-progress'); }
export function postPlayHistory(audio_id, audio_title, duration_seconds) { ... }
export function postDictation(audio_id, audio_title, sentence_index, score, user_input, expected_text) { ... }
// ... 全部 ~15 个端点
```

### audioStore 拆分

```
v0.0.5: stores/audioStore.ts (300 lines)
v0.0.6:
  lib/audioEngine.ts       # Audio 元素管理、switchSource、waitForReady
  stores/audioStore.ts     # Zustand state + actions (~180 lines)
  lib/playTracking.ts      # _trackStart + flushTrack
```

### 组件拆分

```
v0.0.5:
  views/StatsView.tsx              272 lines

v0.0.6:
  views/StatsView.tsx              ~80 lines (layout + fetch orchestration)
  components/stats/OverviewCards.tsx
  components/stats/DailyTimeChart.tsx
  components/stats/DictationTrend.tsx
  components/stats/AudioProgressList.tsx
  components/stats/ActivityTimeline.tsx
  components/stats/Skeleton.tsx       (可复用)
```

```
v0.0.5:
  views/DictationHistoryView.tsx   237 lines

v0.0.6:
  views/DictationHistoryView.tsx   ~90 lines
  components/dictation/AudioGroupCard.tsx
  components/dictation/SentenceRow.tsx
```

```
v0.0.5:
  views/DictationView.tsx          249 lines

v0.0.6:
  views/DictationView.tsx          ~120 lines
  components/dictation/SentenceSelector.tsx
  components/dictation/TypingPhase.tsx
  components/dictation/FeedbackPhase.tsx
  components/dictation/CompletionScreen.tsx
```

### 文件变更清单

| 操作 | 文件 |
|---|---|
| 🆕 | `frontend/src/lib/api.ts` |
| 🆕 | `frontend/src/lib/audioEngine.ts` |
| 🆕 | `frontend/src/lib/playTracking.ts` |
| 🆕 | `frontend/src/components/ErrorBoundary.tsx` |
| 🆕 | `frontend/src/components/stats/OverviewCards.tsx` |
| 🆕 | `frontend/src/components/stats/DailyTimeChart.tsx` |
| 🆕 | `frontend/src/components/stats/DictationTrend.tsx` |
| 🆕 | `frontend/src/components/stats/AudioProgressList.tsx` |
| 🆕 | `frontend/src/components/stats/ActivityTimeline.tsx` |
| 🆕 | `frontend/src/components/stats/Skeleton.tsx` |
| 🆕 | `frontend/src/components/dictation/SentenceSelector.tsx` |
| 🆕 | `frontend/src/components/dictation/TypingPhase.tsx` |
| 🆕 | `frontend/src/components/dictation/FeedbackPhase.tsx` |
| 🆕 | `frontend/src/components/dictation/CompletionScreen.tsx` |
| 🆕 | `frontend/src/components/dictation/SentenceRow.tsx` |
| 🆕 | `frontend/src/components/dictation/AudioGroupCard.tsx` |
| ✏️ | `stores/audioStore.ts` — 拆分后精简 |
| ✏️ | `stores/clipsStore.ts` — any → typed |
| ✏️ | `views/StatsView.tsx` — 子组件提取 |
| ✏️ | `views/DictationView.tsx` — 子组件提取 |
| ✏️ | `views/DictationHistoryView.tsx` — 子组件提取 |
| ✏️ | `views/WordsView.tsx` — 子组件提取 |
| ✏️ | `views/HomeView.tsx` — fetch → api.ts |
| ✏️ | `views/CoursesView.tsx` — fetch → api.ts |
| ✏️ | `views/RecentView.tsx` — fetch → api.ts |
| ✏️ | `App.tsx` — any → typed |
| ✏️ | `components/ContentPanel.tsx` — 去重 fetch |
| ✏️ | `components/PlayerBar.tsx` — fetch → api.ts |
| ✏️ | `tsconfig.json` — strict: true |
| ✏️ | `backend/app/database.py` — 单例连接 |
| ✏️ | `backend/app/routers/words.py` — 缓存 |
| ✏️ | `backend/app/routers/stats_api.py` — streak 优化 |
| ✏️ | `backend/app/main.py` — 全局异常处理 |
| ✏️ | `backend/app/services/__init__.py` — import re 移出循环 |
| 🗑️ | `backend/app/package.json` |
| 🗑️ | `backend/app/package-lock.json` |
