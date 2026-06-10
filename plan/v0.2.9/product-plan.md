# v0.2.9 Product Plan — 统一复习模式

> **核心理念：** 把复习做成一个独立的、可从多个入口启动的统一体验，支持填空和闪卡两种模式，并跟踪复习历史。

---

## 一、总览

| 维度 | 占比 | 内容 |
|------|------|------|
| 功能 | 55% | ReviewModal 组件提取、本课单词面板、flashcard 模式、复习历史表 |
| 体验 | 30% | 统一复习入口（4 处启动）、填空/闪卡模式切换、来源标签 |
| 技术 | 15% | review_history 表、batch_review API、组件化 |

---

## 二、ReviewModal 提取为独立组件（P0）

当前 `WordsView.tsx` 1002 行，其中 ~250 行是复习弹窗逻辑。将其提取为独立组件，可从任何入口复用。

**新建文件：** `frontend/src/components/words/ReviewModal.tsx`

**Props 接口：**

```typescript
interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  words: Array<{
    word: string;
    source?: string;
  }>;
  mode: 'fill-in' | 'flashcard';
  onComplete?: (results: ReviewResult[]) => void;
}

interface ReviewResult {
  word: string;
  correct: boolean;
  score: number;
  timeSpent: number;
}
```

**包含的现有逻辑（从 WordsView 迁移）：**
- `reviewQueue` / `reviewIndex` / `reviewComplete` 状态管理
- `getWordSentences` → 自动播放 → 填空展示
- 结果判定 → `submitWordReview`
- 完成总结面板（正确数 / 错误数 / 正确率）
- 所有 review 相关的 state（reviewOpen, reviewQueue, reviewIndex 等 10 个 state）

**新增逻辑：**
- `mode` 切换：`fill-in`（填空输入）或 `flashcard`（看词→回想→显示答案→自评）
- `source` 标签：在弹窗顶部显示当前复习来源名称
- `onComplete` 回调：汇总结果给调用方

**涉及的更改：**
- `frontend/src/views/WordsView.tsx` — 删除内联 review state 和 JSX，替换为 `<ReviewModal>`

---

## 三、本课单词面板（P0）— PlaybackDetailTabs 新 Tab

**修改文件：** `frontend/src/components/PlaybackDetailTabs.tsx`

**改动：**
1. `SideTab` 类型追加 `'words'`
2. 展开/收起状态栏新增第 4 个 tab 按钮（`HiBookOpen`）
3. Tab 内容 `sideTab === 'words'` 时渲染本课单词列表

**面板内容：**
```
本课单词（共 N 个）
────────────────────
  abandon          [0:12] [1:35]  ☆
  ability          [0:45]         ☆
  absolutely       [2:10] [3:40]  ☆
  ...
[🧠 复习本课单词 →]
```

- 从 `lesson.words` 读取，按 `word.text` 去重，收集时间戳
- 时间戳按钮 → 跳到对应时间播放
- 收藏 + 已掌握标记
- 底部「复习本课单词」按钮 → ReviewModal
- 顶部搜索过滤

**无需新增后端 API。**

---

## 四、统一复习入口（P1）

| 入口 | 来源 | 模式默认值 |
|------|------|-----------|
| ① WordsView 今日单词 Tab | 今日未掌握单词 | fill-in |
| ② WordsView 待复习 Tab | dueWords（支持「全部复习」按钮） | fill-in |
| ③ PlaybackDetailTabs 本课单词 | lesson.words | fill-in |
| ④ HomeView 卡片 | todayWords/dueWords | fill-in（可切换 flashcard） |

**改动要点：**
- WordsView 待复习 Tab 的「复习」按钮 → 打开 ReviewModal（不再直接 mark 100）
- 新增「全部复习」按钮
- HomeView 卡片增加直接复习入口（不强制跳转到 /words）

---

## 五、Flashcard 闪卡模式（P1）

### fill-in 模式（现有）
```
显示句子（___ 挖空）→ 用户输入 → 自动判对错 → 下一词
```

### flashcard 模式（新增）
```
显示单词 + 发音图标 → 用户在心里回想
→ 点击「显示答案」
→ 显示中文释义 + 原句 + 自评按钮（忘记/模糊/想起）
→ 评分 (0/50/100) → 下一词
```

**数据来源优先级：**
1. `dictionary` 表（pronunciation + definition + partOfSpeech）
2. `getWordSentences`（句子上下文）
3. `getWordDetail`（出现信息降级）

**模式切换：** 弹窗标题栏右侧加切换按钮，调用方可指定默认 mode。

---

## 六、后端：复习历史表（P1）

### 新增表

```sql
CREATE TABLE IF NOT EXISTS review_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    session_id TEXT NOT NULL,
    source TEXT NOT NULL,
    mode TEXT NOT NULL,
    correct INTEGER NOT NULL,
    score REAL NOT NULL,
    session_index INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rh_session ON review_history(session_id);
CREATE INDEX IF NOT EXISTS idx_rh_word ON review_history(word);
CREATE INDEX IF NOT EXISTS idx_rh_date ON review_history(created_at);
```

### 新增 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /api/progress/review/batch` | POST | 批量提交复习结果（事务性写入） |
| `GET /api/progress/review/history` | GET | 复习历史（按 session 聚合） |
| `GET /api/progress/review/stats` | GET | 今日统计 + 连续天数 + 总正确率 |

**POST /review/batch 请求体：**
```json
{
  "session_id": "uuid-string",
  "source": "today_words",
  "mode": "fill-in",
  "results": [
    {"word": "abandon", "correct": 1, "score": 100, "session_index": 0}
  ]
}
```

**处理逻辑：**
1. 批量写入 `review_history`
2. 依次更新 `word_progress`（调用 `add_review`）
3. 返回 `{ ok: true, reviewed: N, correct: M }`

---

## 七、涉及文件

### 新建文件

| 文件 | 说明 |
|------|------|
| `frontend/src/components/words/ReviewModal.tsx` | 复习会话弹窗（~250 行） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/src/views/WordsView.tsx` | 删除内联 review 代码，改用 ReviewModal；待复习 Tab 改为弹窗复习 |
| `frontend/src/components/PlaybackDetailTabs.tsx` | 新增「单词」Tab（本课单词列表 + 复习入口） |
| `frontend/src/views/HomeView.tsx` | 今日单词/待复习卡片增加直接复习按钮 |
| `frontend/src/lib/api.ts` | +submitBatchReview / +ReviewBatchResult 类型 |
| `backend/app/database.py` | +review_history 表 |
| `backend/app/repositories/progress_repo.py` | +batch_review / +get_review_history / +get_review_stats |
| `backend/app/routers/progress.py` | +POST /review/batch / +GET /review/history / +GET /review/stats |

---

## 八、与 v0.2.7 未完成项的关系

v0.2.9 覆盖的 v0.2.7 遗留项：
- ✅ 本课单词面板（PlaybackDetailTabs 新 Tab）
- ✅ 待复习 Tab 改为真正复习
- ✅ flushTrack 防双发（顺带修复）

延后到 v0.3.x：
- ❌ WordsView 拆分（WordList / WordDetailPanel / FilterDrawer）
- ❌ 每日单词目标设置 + SettingsView
- ❌ 已掌握 Tab 无限滚动分页
- ❌ 导入后缓存自动刷新

---

## 九、验证

- [ ] ReviewModal 从 3+ 处启动均正常
- [ ] fill-in 模式：填空句子 → 输入 → 判对错 → 下一词 → 总结
- [ ] flashcard 模式：显示单词 → 显示答案 → 自评 → 下一词
- [ ] 本课单词面板列出单词及时间戳，点击跳到对应位置
- [ ] 复习历史写入 review_history 表
- [ ] GET /review/stats 返回正确统计
- [ ] HomeView 卡片直接启动复习
- [ ] npx tsc --noEmit 无错误
