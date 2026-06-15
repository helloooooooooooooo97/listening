# v0.3.9 产品计划 — 单词难度分级 + 按难度筛选复习/游戏

**日期**: 2026-06-13 → 2026-06-15
**状态**: 开发中 🛠️

---

## 1. 概述

### 痛点

当前复习的单词太简单了。`apple`、`book`、`cat` 这类高频基础词和 `sustenance`、`benevolent` 这类低频高阶词出现在同一个复习队列里，用户无法按需筛选。

### 目标

为每个单词建立一个 **0~100 的难度评分**，按评分归入 **Hard 🔴 / Medium 🟡 / Easy 🟢** 三个等级，并在以下场景支持按难度筛选：

- **单词复习**：只看 Hard 或只看 Medium 的待复习词
- **听了个听**：选择词源时附加难度过滤
- **单词列表**：展示难度标签，便于用户感知

---

## 2. 难度公式

### 2.1 输入因子

| 因子 | 权重 | 数据来源 | 说明 |
|------|------|----------|------|
| **词频 (frequency)** | 50% | `/api/words` 的 `count` 字段 | 全部 lessons 中的出现次数。低频 = 罕见 = 更难 |
| **词长 (length)** | 30% | 单词字符数 | 长词通常更难拼写和识别 |
| **考试等级 (exam tag)** | 20% | `dictionary` 表的 `tags` | CET-4 < CET-6 < TEM-4 < TEM-8 < IELTS/TOEFL |

### 2.2 计算公式

```python
import math

# 全局归一化——从全部词库计算
# GLOBAL_MAX_LOG_FREQ = max(log(freq + 1) for all words)
# tag_order = ['CET-4', 'CET-6', 'TEM-4', 'TEM-8', 'IELTS', 'TOEFL']

def difficulty_score(word: str, freq: int, tags: list[str],
                     global_max_log_freq: float) -> float:
    """返回 0.0 (最简单) ~ 1.0 (最困难)"""

    # ── 词频项 (50%) ──
    log_freq = math.log(freq + 1)
    freq_score = 1 - (log_freq / global_max_log_freq)

    # ── 词长项 (30%) ──
    length = len(word)
    len_score = min(length / 20.0, 1.0)

    # ── 考试等级项 (20%) ──
    tag_order = ['CET-4', 'CET-6', 'TEM-4', 'TEM-8', 'IELTS', 'TOEFL']
    if not tags:
        exam_score = 0.3
    else:
        max_tier = max(tag_order.index(t) for t in tags if t in tag_order)
        exam_score = max_tier / (len(tag_order) - 1)

    score = 0.50 * freq_score + 0.30 * len_score + 0.20 * exam_score
    return round(score, 4)
```

### 2.3 三分档

| 档位 | 阈值 | 色标 | 说明 |
|------|------|------|------|
| 🟢 **Easy** | `[0.00, 0.33)` | `#34d399` emerald | 常见高频词、短词、CET-4 级 |
| 🟡 **Medium** | `[0.33, 0.66)` | `#fbbf24` amber | 中等频率、中等长度、CET-6/TEM-4 |
| 🔴 **Hard** | `[0.66, 1.00]` | `#f87171` red | 低频罕见词、长词、TEM-8/IELTS/TOEFL |

### 2.4 预期效果示例

| 单词 | 频次 | 长度 | 标签 | 难度分 | 档位 |
|------|------|------|------|--------|------|
| the | 5000+ | 3 | — | ~0.05 | 🟢 Easy |
| apple | 85 | 5 | CET-4 | ~0.18 | 🟢 Easy |
| freedom | 42 | 7 | CET-6 | ~0.35 | 🟡 Medium |
| sustenance | 5 | 11 | TEM-8 | ~0.72 | 🔴 Hard |
| benevolent | 3 | 10 | IELTS | ~0.80 | 🔴 Hard |

---

## 3. 存储方案

### 3.1 新增 `word_difficulty` 表

在 `database.py` 的 `_ensure_tables()` 中添加：

```sql
CREATE TABLE IF NOT EXISTS word_difficulty (
    word TEXT PRIMARY KEY,
    score REAL NOT NULL,        -- 0.0 ~ 1.0
    level TEXT NOT NULL,        -- 'easy' | 'medium' | 'hard'
    freq INTEGER DEFAULT 0,
    length INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_wd_level ON word_difficulty(level);
```

### 3.2 计算时机

- **首次计算（批量）**：应用启动时检查 `word_difficulty` 是否为空，为空则扫描全量词库生成
- **增量更新**：每次 `_build_cache()` 重建后自动触发重新计算
- **按需刷新**：`POST /api/words/difficulty/refresh` 手动触发

### 3.3 实现位置

新建文件：`backend/app/services/word_difficulty_service.py`

```python
class WordDifficultyService:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def compute_all(self) -> int:
        """遍历全量词库，计算并写入 word_difficulty 表。返回处理单词数。"""
        ...

    def get_word_difficulty(self, word: str) -> dict | None:
        ...

    def get_words_by_level(self, level: str | None,
                           offset: int = 0, limit: int = 50) -> dict:
        ...
```

---

## 4. API 变更

### 4.1 Router 文件

`backend/app/routers/words.py` — 新增端点：

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/words/difficulty` | 返回所有单词难度分（支持 `level` 筛选 / `offset`/`limit`） |
| `GET` | `/api/words/difficulty/{word}` | 返回单个单词难度详情 |
| `POST` | `/api/words/difficulty/refresh` | 强制重新计算全库难度 |

### 4.2 响应格式

`GET /api/words/difficulty?level=hard&limit=50`

```json
{
  "total": 420,
  "words": [
    {"word": "sustenance", "score": 0.72, "level": "hard", "freq": 5, "length": 11, "tags": ["TEM-8"]},
    {"word": "benevolent", "score": 0.80, "level": "hard", "freq": 3, "length": 10, "tags": ["IELTS"]}
  ]
}
```

### 4.3 现有接口扩展

**`GET /api/progress/words/due?level=hard&limit=20`**

在 `routers/progress.py` 中已有 `due_words` 端点，新增可选参数 `level`：

```python
@router.get("/words/due")
def due_words(limit: int = Query(default=20, ge=1, le=100),
              level: str | None = None,
              repo: ProgressRepository = Depends(get_repo)):
    return {"words": repo.get_due_words(limit, level)}
```

需要在 `ProgressRepository.get_due_words()` 中增加 JOIN `word_difficulty` 做 level 筛选。

**`GET /api/words?difficulty=hard&limit=200`**

在 `words.py` 的现有 `GET /api/words` 端点添加可选 `difficulty` 参数：

```python
@router.get("/words")
def get_words(difficulty: str | None = None, ...):
```

返回时附加 `score` / `level` 字段。

---

## 5. 前端变更

### 5.1 API 层 — `frontend/src/lib/api.ts`

新增方法：

```typescript
export function getWordDifficulty(level?: string, offset?: number, limit?: number): Promise<...>
export function getWordDifficultyDetail(word: string): Promise<...>
export function getDueWordsByLevel(level: string, limit?: number): Promise<...>
```

### 5.2 WordsView — 难度标签 ✅ (部分完成)

`frontend/src/views/WordsView.tsx` (611 行)：

- 在单词行右侧添加难度色标 badge（`🟢 Easy` / `🟡 Medium` / `🔴 Hard`）
- 在"全部单词"和"待复习" Tab 均展示
- 复用现有的 `TAG_STYLES` 风格模式

### 5.3 复习筛选 — 难度过滤器

在 "待复习" Tab 顶部添加按钮组：

```
[ 全部 ] [ 🟢 简单 ] [ 🟡 中等 ] [ 🔴 困难 ]
```

- 选中后调用 `getDueWordsByLevel(level)` 拉取对应等级
- 显示该等级待复习数量（从 `/api/words/due-count?level=xxx` 获取）
- 按钮样式复用 play-type filter 的 `active` / `bg-[var(--accent)]` 模式

实现位置：WordsView 内部的状态 + API 调用变更。

### 5.4 听了个听 — 难度词源

`frontend/src/components/game/GameLevelSelect.tsx` (114 行)：

在词源选择后面新增难度子筛选：

```
单词来源
[ 今日单词 ] [ 待复习 ] [ 全部单词 ]

难度筛选    ← 新增
[ 🟢 简单 ] [ 🟡 中等 ] [ 🔴 困难 ] [ 🔄 全部 ]
```

- `frontend/src/stores/gameStore.ts` 新增 `difficultyFilter` 字段
- `frontend/src/views/GameView.tsx` 的 `handleStart` 按 `difficultyFilter` 过滤传给 `initGame`

### 5.5 ReviewModal — 难度色标

`frontend/src/components/words/ReviewModal.tsx` (213 行)：

- 复习弹窗中每个单词左侧显示难度色条（小圆点或左侧竖条）
- 可在 `array.map` 遍历单词时附加 `span` 标签

### 5.6 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/app/services/word_difficulty_service.py` | **新文件**：难度计算引擎 + DB 读写 |
| `backend/app/routers/words.py` | 新增 `/difficulty` 系列端点 + `?difficulty=` 参数 |
| `backend/app/routers/progress.py` | `/words/due` 增加 `level` 参数 |
| `backend/app/repositories/progress_repo.py` | `get_due_words` 增加 level 筛选 |
| `backend/app/database.py` | `_ensure_tables` 新增 `word_difficulty` 表 |
| `frontend/src/lib/api.ts` | 新增 `getWordDifficulty()` / `getDueWordsByLevel()` |
| `frontend/src/views/WordsView.tsx` | 难度标签展示 + 复习筛选按钮组 |
| `frontend/src/components/game/GameLevelSelect.tsx` | 词源增加难度筛选项 |
| `frontend/src/stores/gameStore.ts` | 新增 `difficultyFilter` |
| `frontend/src/views/GameView.tsx` | `handleStart` 按难度过滤 |
| `frontend/src/components/words/ReviewModal.tsx` | 单词行显示难度色标 |

---

## 6. 实施顺序

| 阶段 | 内容 | 预估 |
|------|------|------|
| **Phase 1** | 后端引擎：`word_difficulty_service.py` + 表创建 + 批量计算 + `database.py` | 0.5 天 |
| **Phase 2** | 后端 API：`/difficulty` 端点 + progress 扩展 + `words.py` 扩展 + **测试** | 0.5 天 |
| **Phase 3** | 前端 API 层 + WordsView 难度标签 + 复习筛选 | 0.5 天 |
| **Phase 4** | 前端游戏：GameLevelSelect 难度筛选 + gameStore + GameView | 0.5 天 |
| **Phase 5** | ReviewModal 色标 + 空状态 + 边界 case + **集成测试** | 0.25 天 |

---

## 7. 关键指标

| 指标 | 目标 |
|------|------|
| 全量难度计算耗时 | ≤ 3s（2000+ 单词） |
| API 响应 (带 level 筛选) | ≤ 100ms |
| 用户触达 | 复习页 + 游戏页 + 单词列表页均可筛选 |

---

## 8. 不在此版本范围

- 基于难度的自适应学习路径（自动降/升级）
- 难度与代币/卡牌奖励联动（hard 词加分）
- 用户自定义难度权重
- SRS（间隔重复）排期与难度结合

---

## 9. 先行修复 — 合集单词播放

在 v0.3.9 开发前，修复了合集单词无法加入播放队列的问题（**已合并**）。

### 问题

点击合集"播放全部"时，单词条目没有反应。原因是 `collectionItemToQueueItem` 对单词的处理依赖 `getWordSentences` API 查句子数据，而合集条目本身已存储 `lesson_id` / `start_time` / `end_time`，无需额外请求。

此外 `ensureWordClipCached` 只缓存非 null 结果，查不到的单词会反复请求 API → 形成轮询。

### 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/src/lib/collectionQueue.ts` | 单词处理分快慢路径：有 `lesson_id` 直接用合集数据（0 API），没有才回退 `getWordSentences` |
| `frontend/src/hooks/useWordAudio.ts` | 导出 `ensureWordClipCached`；null 结果也缓存防止轮询 |

### 效果

- 合集"播放全部"按钮对单词立刻响应，音频通过播放队列自动逐个播放
- 无额外 API 调用（快路径），Safari 手势上下文不丢失
