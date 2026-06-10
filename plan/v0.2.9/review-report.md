# v0.2.9 Review Report — 统一复习模式 + WordsView 代码拆分

> 8 files modified, 8 files added, WordsView 从 1002 行降至 579 行

---

## 核心变化

### 🎯 ReviewModal 独立组件 + 子组件拆分（P0）

复习弹窗从 WordsView 提取为独立组件，并进一步拆分为子组件。

| 文件 | 行数 | 说明 |
|------|------|------|
| `frontend/src/components/words/ReviewModal.tsx` | 153 **(new)** | 复习会话弹窗（状态管理 + 流程控制） |
| `frontend/src/components/words/ReviewFillIn.tsx` | 146 **(new)** | 填空听写模式子组件 |
| `frontend/src/components/words/ReviewFlashcard.tsx` | 154 **(new)** | 闪卡模式子组件 |

**Props 接口：**
- `open` / `onClose` — 显隐控制
- `words` — 待复习单词列表（`{ word, source? }`）
- `mode` — 复习模式：`'fill-in'` | `'flashcard'`
- `onComplete` — 完成回调

**fill-in 模式（填空听写）：**
- 显示句子（目标词 `___` 挖空）→ 自动播放原声 → 用户输入拼写 → 判对错 → 下一词
- 完成总结（正确数 / 错误数 / 正确率百分比）

**flashcard 模式（闪卡）：**
- 显示单词 + 自动播放原声 + 音频播放指示器（ping 动画）
- 点击「显示释义」→ 发音 / 词性 / 中文释义 / 考试标签 + 句子上下文 + 重听按钮
- 三级自评：忘了 (0分) / 模糊 (50分) / 想起 (100分)
- 顶部模式切换按钮（拼写模式 ↔ 闪卡模式）

**数据来源：**
- fill-in: `getWordSentences` → 句子 + 音频自动播放
- flashcard: `getDictionaryEntry`（释义）+ `getWordSentences`（例句音频）并行加载

### 🎯 本课单词面板（P0）

在 PlaybackDetailTabs 侧边栏新增第 4 个 Tab「📘 单词」。

| 文件 | 改动 |
|------|------|
| `frontend/src/components/PlaybackDetailTabs.tsx` | 新增 `'words'` 类型、知词状态加载、本课单词列表渲染 |

**面板内容：**
```
本课单词（共 N 个）
────────────────────
  abandon          [0:12] [1:35]  ☆
  ability          [0:45]         ☆
  absolutely       [2:10] [3:40]  ☆
  ...（搜索框过滤）
[🧠 复习本课单词 →]
```

- 从 `lesson.words` 读取，按 `word.text` 去重收集时间戳
- 时间戳按钮 → 跳转到对应位置
- 收藏按钮（☆）+ 已掌握标记（✓）
- 搜索过滤框
- 底部「复习本课单词」按钮 → 启动 ReviewModal

### 🎯 统一复习入口（P1）

| 入口 | 来源 | 状态 |
|------|------|------|
| WordsView 今日单词 Tab | 今日未掌握单词 | ✅ 改用 ReviewModal |
| WordsView 待复习 Tab | dueWords | ✅ 新增「全部复习」按钮 + 弹窗复习 |
| PlaybackDetailTabs 单词 Tab | 本课单词 | ✅ 新增 |
| HomeView 卡片 | todayWords / dueWords | ✅ 新增直接复习按钮 |

**HomeView 卡片改造：**
- 今日单词卡片 + 待复习卡片均拆为上下两栏（信息栏 + 操作按钮）
- 「📖 查看」→ 跳转到 WordsView
- 「🧠 复习」→ 直接启动 ReviewModal（on-demand 获取单词列表）
- 复习按钮仅在今日单词有未复习内容时显示

### 🎯 FilterDrawer 独立组件（P1）

| 文件 | 行数 | 说明 |
|------|------|------|
| `frontend/src/components/words/FilterDrawer.tsx` | 152 **(new)** | 合集/分类/考试标签筛选 |

### 🎯 WordDetailPanel 独立组件（P1）

| 文件 | 行数 | 说明 |
|------|------|------|
| `frontend/src/components/words/WordDetailPanel.tsx` | 221 **(new)** | 单词详情侧边面板 |

### 🎯 后端 batch_review API + review_history 表（P1）

**新增表 `review_history`：**

```sql
CREATE TABLE IF NOT EXISTS review_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    session_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'review',
    mode TEXT NOT NULL DEFAULT 'fill-in',
    correct INTEGER NOT NULL DEFAULT 0,
    score REAL NOT NULL DEFAULT 0,
    session_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
```

**新增 API：**

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /api/progress/review/batch` | POST | 批量提交复习结果（事务性写入 review_history + word_progress） |
| `GET /api/progress/review/history` | GET | 复习历史（按 session 聚合） |
| `GET /api/progress/review/stats` | GET | 今日复习统计 + 连续天数 |

**ReviewModal 改造：**
- 不再逐词调用 `submitWordReview`（N 词 N 次 HTTP 请求）
- 改为收集整批结果 → 关闭时一次 `submitBatchReview` → 1 次请求

**涉及文件：**
| 文件 | 改动 |
|------|------|
| `backend/app/database.py` | +review_history 表 |
| `backend/app/repositories/progress_repo.py` | +batch_review / +get_review_history / +get_review_stats |
| `backend/app/routers/progress.py` | +POST /review/batch / +GET /review/history / +GET /review/stats |
| `frontend/src/lib/api.ts` | +submitBatchReview / +getReviewHistory / +getReviewStats |
| `frontend/src/components/words/ReviewModal.tsx` | 改用 batch_review 提交 |

### 🎯 WordsView 代码拆分

| 指标 | 拆分前 | 拆分后 | 变化 |
|------|--------|--------|------|
| 总行数 | 1002 | 579 | **-423 行 (-42%)** |
| 内联组件 | 5+ | 4 (TabBar, TagBadge, TabContent, WordRow) | 3 个提取为独立文件 |
| 职责 | 所有逻辑杂糅 | Tab 切换 + 数据加载 + 状态协调 | 单一职责 |

**拆出的组件：**

| 组件 | 原行数 | 现行数 | 位置 |
|------|--------|--------|------|
| ReviewModal | ~250 | 153 | `components/words/ReviewModal.tsx` |
| ReviewFillIn | — | 146 | `components/words/ReviewFillIn.tsx` |
| ReviewFlashcard | — | 154 | `components/words/ReviewFlashcard.tsx` |
| FilterDrawer | ~70 | 152 | `components/words/FilterDrawer.tsx` |
| WordDetailPanel | ~160 | 221 | `components/words/WordDetailPanel.tsx` |

**新增共享内联组件：**
- `TabContent` — 统一的 loading/empty 状态包装器
- `WordRow` — 共享单词行组件（today/all/mastered 三 Tab 复用）

---

## 🔧 Bug 修复

| 问题 | 原因 | 修复 |
|------|------|------|
| 「全部单词」面板加载完成后会再闪一次 | 搜索防抖 `useEffect` deps 包含 `tab` 和 `examFilter`，Tab 切换后 250ms 二次触发 `loadWords` | deps 改为 `[search]` |
| 逐词 HTTP 请求浪费（N 词 → N 请求） | 每个词独立 `submitWordReview` | 改为 `submitBatchReview` 批量提交 |

---

## 文件变更清单

### 新建文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `frontend/src/components/words/ReviewModal.tsx` | 153 | 复习弹窗主组件 |
| `frontend/src/components/words/ReviewFillIn.tsx` | 146 | 填空听写子组件 |
| `frontend/src/components/words/ReviewFlashcard.tsx` | 154 | 闪卡子组件 |
| `frontend/src/components/words/FilterDrawer.tsx` | 152 | 筛选下拉面板 |
| `frontend/src/components/words/WordDetailPanel.tsx` | 221 | 单词详情侧边面板 |
| `plan/v0.2.9/product-plan.md` | — | 产品计划 |

### 修改文件

| 文件 | 说明 |
|------|------|
| `frontend/src/views/WordsView.tsx` | 重写，改用 ReviewModal / FilterDrawer / WordDetailPanel / TabContent / WordRow |
| `frontend/src/components/PlaybackDetailTabs.tsx` | 新增「单词」Tab（本课单词列表 + 复习入口） |
| `frontend/src/views/HomeView.tsx` | 今日单词/待复习卡片新增直接复习按钮 |
| `frontend/src/lib/api.ts` | +submitBatchReview / +getReviewHistory / +getReviewStats |
| `backend/app/database.py` | +review_history 表 |
| `backend/app/repositories/progress_repo.py` | +batch_review / +get_review_history / +get_review_stats |
| `backend/app/routers/progress.py` | +POST /review/batch / +GET /review/history / +GET /review/stats |

---

## 完成度评估

### 按 v0.2.9 产品计划对比

| 模块 | 计划内容 | 状态 | 说明 |
|------|----------|------|------|
| **一、ReviewModal** | 提取为独立组件 | ✅ | 153 行，并进一步拆为 ReviewFillIn + ReviewFlashcard 子组件 |
| **二、本课单词面板** | PlaybackDetailTabs 新 Tab | ✅ | 完整实现：时间戳、收藏、已掌握、搜索过滤、复习入口 |
| **三、统一复习入口** | 4 处入口统一 | ✅ | WordsView × 2 + PlaybackDetailTabs + HomeView 全部完成 |
| **四、Flashcard 模式** | 看词→显示答案→自评 | ✅ | 含自动播放音频 + 词典释义 + 句子上下文 |
| **五、复习历史表** | review_history + batch API | ✅ | 表 + 3 API + 前端批量提交改造 |
| **六、WordsView 拆分** | ReviewModal / FilterDrawer / WordDetailPanel / WordList | ✅ | 全部完成，另增 TabContent + WordRow 共享组件 |

### 遗留项（可改进但暂时不做）

| 项目 | 原因 |
|------|------|
| dailyWordGoal 设置 + SettingsView | 纯功能新增，非代码质量问题 |
| 已掌握 Tab 无限滚动分页 | 当前 limit 500 够用 |
| 本课单词面板记住已知词状态 | 当前每次切 Tab 重新加载（可后期优化） |

---

## 架构评价

### 亮点

1. **ReviewModal 彻底模块化** — 主组件 153 行只负责流程管理，fill-in 和 flashcard 为独立子组件
2. **N 次 HTTP → 1 次** — batch_review 减少后端连接压力
3. **复习入口全覆盖** — WordsView × 2 + PlaybackDetailTabs + HomeView 全部可用
4. **PlaybackDetailTabs 单词 Tab** — 填补了播放页→复习的闭环缺口
5. **共享 WordRow** — today/all/mastered 三 Tab 复用同一行渲染逻辑，消除重复代码

### 代码质量指标

| 文件 | 行数 | 评价 |
|------|------|------|
| WordsView.tsx | 579 | ✅ 适中，职责单一 |
| ReviewModal.tsx | 153 | ✅ 轻量，仅流程管理 |
| ReviewFillIn.tsx | 146 | ✅ 专注填空模式 |
| ReviewFlashcard.tsx | 154 | ✅ 专注闪卡模式 |
| FilterDrawer.tsx | 152 | ✅ 自管理数据加载 |
| WordDetailPanel.tsx | 221 | ✅ 适中 |
| PlaybackDetailTabs.tsx | ~480 | 🟡 略大，但侧边栏逻辑都在这里，拆分会增加不必要的 Props 传递 |
| HomeView.tsx | ~310 | ✅ 适中 |
