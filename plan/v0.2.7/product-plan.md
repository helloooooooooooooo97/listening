# v0.2.7 Product Plan — 本课单词 + 播放闭环 + Bug 修复

> **核心理念：** 在播放页面就能看到并操作当前音频的所有单词，建立"听 → 看词 → 复习"的播放闭环。

---

## 一、总览

| 维度 | 占比 | 内容 |
|------|------|------|
| 功能 | 50% | 播放端"本课单词"面板、今日单词复习增强、每日单词目标设置 |
| 体验 | 30% | 筛选面板重做、空状态引导、Review 模块提取为独立 Modal |
| 技术 | 20% | 缓存刷新机制、WordsView 拆分、flushTrack 防双发、TS 严格化 |

---

## 二、播放详情页 — 本课单词面板 P0 ⭐

### 2.1 新增第四个 SideTab

在 `PlaybackDetailTabs` 侧边栏中，新增 **第四标签：📘 单词**（`HiBookOpen`）。

```
┌─ 侧边栏 tab 切换 ──────────────────┐
│ [📎 片段] [✏️ 听写] [❤️ 收藏] [📘 单词]  │
└────────────────────────────────────┘
```

### 2.2 本课单词列表

选中「单词」tab 后展示：

```
┌────────────────────────────────────────┐
│  本课单词（共 22 个）                     │
│                                        │
│  abandon          [0:12] [1:35]  ☆     │
│  ability          [0:45]         ☆     │
│  absolutely       [2:10] [3:40]  ☆     │
│  ...                                    │
│                                        │
│  [🧠 复习本课单词 →]                     │
└────────────────────────────────────────┘
```

- 从 `lesson.words` 直接读取
- 每个单词显示其在本音频中的出现时间点（按钮，点击跳到对应时间 + 自动播放）
- 右侧收藏按钮（☆）
- 已掌握的单词显示 ✓ 标记
- 底部「复习本课单词」按钮 → 启动针对该音频的单词复习（同今日单词复习弹窗，但限定本课词汇）
- 列表支持搜索过滤（顶部搜索框）

### 2.3 数据流

```
lesson.words（课程 JSON 已有数据）
   ├─ 按 word.text 去重
   ├─ 每个词收集 word.start 时间戳列表
   ├─ 跨表校验 word_progress.known 状态
   └─ 直接展示，无需新增 API
```

无需新增后端接口，所有数据已存在于 `ListeningLesson.words`。

---

## 三、今日复习增强 P1

### 3.1 每日单词目标设置

在 SettingsView 新增设置项：

```
每日单词目标
████████████░░░░ 30 词
[减少] [增加]

今日已听 42 个单词
已复习 12 个
```

- 默认 30 词/天
- 存储在 `settingsStore`（`dailyWordGoal`）
- HomeView 今日单词卡片进度条改为：**今日已听 / 目标词数**（替代现有分钟进度）

### 3.2 HomeView 今日单词卡片增强

当前 HomeView 已有今日单词卡片，改为：

```
┌─ 📅 今日单词 ──────────────────────┐
│  今天听了 3 个音频 · 累计 42 个单词   │
│  ████████████░░░░░░░░ 42/30 目标 ✓  │
│  已复习 12/42                       │
│  [📖 查看单词] [🔄 复习] [▶ 继续听]  │
└────────────────────────────────────┘
```

- 进度条对比 `dailyWordGoal`
- 新增「继续听」按钮 → 回到之前播放的音频
- 目标达成时显示 🎉

### 3.3 待复习 Tab 一键复习

当前「待复习」Tab 中，每个单词只有单个「复习」按钮（直接标记 100 分），
改为点击「复习」后打开填空听写弹窗（复用现有 `openReview` 弹窗逻辑）。

新增「全部复习」按钮：将待复习列表全部推入复习队列。

---

## 四、筛选面板重做 P1

### 4.1 从下拉菜单改为抽屉式面板

当前筛选为下拉菜单（`filterOpen` 控制），改为右侧抽屉（Drawer）：

```
┌─────── 全部单词 ────────┐
│                         │
│  📚 按合集               │
│  ├ 全部单词        1024  │
│  ├ 今日单词         42   │
│  ├ 高频错词         15   │
│  └ 全部听写记录     200  │
│                         │
│  📖 按分类               │
│  ├ IELTS            520  │
│  ├ 伊索寓言          302  │
│  └ 📂 其他          202  │
│                         │
│  🔄 按状态               │
│  ├ 全部            1024  │
│  ├ 未复习           400  │
│  ├ 待复习           200  │
│  └ 已掌握           520  │
│                         │
│  [清除筛选]              │
└─────────────────────────┘
```

- 从右侧滑出，带遮罩层
- 三个分组：合集 / 分类 / 状态
- 每个选项显示对应单词数
- `filterCounts` 从后端一次获取（或优化为批量查询）

### 4.2 新增「按状态」筛选

新增「按掌握状态」筛选维度，独立于合集/分类：

- 全部 / 未复习（`word_progress` 无记录或 `last_score IS NULL`）
- 待复习（`known=1 AND (last_score < 80 OR last_score IS NULL)`）
- 已掌握（`known=1 AND last_score >= 80`）

后端 `GET /api/words` 新增 `status` 查询参数：

```
GET /api/words?status=review|mastered|new
```

---

## 五、Bug 修复 P1

| # | 问题 | 修复 |
|---|------|------|
| 1 | `flushTrack()` 在 `pause` 和 `ended` 事件中可能双发 | `flushTrack` 开头检测 `_trackStart===0` 已提前 return，但 `ended` 后再 `pause` 仍然可能触发空数据 POST。添加 `_trackFlushed` 标志位防止重复写入 play_history。 |
| 2 | WordsView 已掌握 Tab 缺少无限滚动 | `masteredWords` 当前一次 load 500 条无翻页。改为分页加载 + IntersectionObserver 触发。 |
| 3 | 待复习 Tab「复习」按钮直接标记 100 分无真正复习 | 改为弹出填空听写弹窗（复用 reviewOpen 弹窗） |
| 4 | 首次导入课程后单词缓存不刷新 | `_build_cache()` 在课程导入 API 后自动触发刷新 |
| 5 | 动态合集 `_CATEGORY_LESSONS_CACHE` 在导入后不刷新 | import_api 中调用 `refresh_category_cache()` |
| 6 | 今日单词「无记录」空状态缺少行动引导 | 空状态增加「去听音频」按钮，跳转到 HomeView |
| 7 | WordsView 前端 `clean_word` 与后端重复 | 提取为共享 util 或仅用后端 API 返回已清理词 |
| 8 | 今日单词复习 Modal 嵌入 WordsView 导致组件达 932 行 | 提取 `ReviewModal` 为独立组件 |

---

## 六、技术改进

### 6.1 WordsView 拆分

当前 `WordsView.tsx` 932 行，包含：
- Tab 栏 (50 行)
- 四个 Tab 的内容 (400 行)
- 详情面板 (200 行)
- 复习弹窗 (250 行)

**拆分为：**

| 新文件 | 责任 |
|--------|------|
| `WordsView.tsx` | 仅 Tab 切换 + 顶层状态 + 布局容器 (~200 行) |
| `components/words/WordList.tsx` | 单词列表渲染（今日/全部/待复习/已掌握 四种模式） |
| `components/words/WordDetailPanel.tsx` | 单词详情侧边面板（已有逻辑提取） |
| `components/words/ReviewModal.tsx` | 填空听写复习弹窗（已有逻辑提取） |
| `components/words/FilterDrawer.tsx` | 筛选抽屉面板 |

### 6.2 缓存按需刷新

```python
# words.py 新增
@router.post("/words/refresh")
def refresh_word_cache():
    _build_cache()
    return {"ok": True}

# import_api.py 中导入完成后自动调用
import httpx
httpx.post("http://127.0.0.1:8000/api/words/refresh")
# 或直接在 import 完成时 import words; words._build_cache()
```

### 6.3 flushTrack 防双发

```typescript
let _trackFlushed = false;

function flushTrack() {
  if (_trackStart === 0 || _trackFlushed) return;
  _trackFlushed = true;
  // ... 原有逻辑
}

// 在 play / trackPlay 时重置
function trackPlay() {
  _trackStart = Date.now();
  _trackFlushed = false;
}
```

---

## 七、涉及文件

### 后端（6 文件）

| 文件 | 改动 |
|------|------|
| `backend/app/routers/words.py` | 新增 `status` 查询参数 + `/words/refresh` 端点 |
| `backend/app/routers/collections.py` | 导入后触发缓存刷新 |
| `backend/app/routers/import_api.py` | 导入完成 → 触发 `_build_cache()` + `refresh_category_cache()` |
| `backend/app/text_utils.py` | 无变更 |
| `backend/app/repositories/progress_repo.py` | 可能需新增 `get_lesson_words_progress` |
| `backend/app/services/collection_service.py` | `get_today_words` 增加 `known` 聚合信息 |

### 前端（10+ 文件）

| 文件 | 改动 |
|------|------|
| `frontend/src/components/PlaybackDetailTabs.tsx` | 新增「单词」tab + 本课单词列表 |
| `frontend/src/views/WordsView.tsx` | **拆分重构** — 提取独立组件 |
| `frontend/src/views/HomeView.tsx` | 今日单词卡片增强 + 每日目标进度 |
| `frontend/src/views/SettingsView.tsx` | 新增每日单词目标设置 |
| `frontend/src/stores/audioStore.ts` | `flushTrack` 防双发 + `trackPlay` 重置标志 |
| `frontend/src/stores/settingsStore.ts` | 新增 `dailyWordGoal` |
| `frontend/src/lib/api.ts` | 可能新增 `refreshWordCache` API |
| `frontend/src/components/words/WordList.tsx` | **新建** — 单词列表渲染 |
| `frontend/src/components/words/WordDetailPanel.tsx` | **新建** — 详情面板 |
| `frontend/src/components/words/ReviewModal.tsx` | **新建** — 复习弹窗 |
| `frontend/src/components/words/FilterDrawer.tsx` | **新建** — 筛选抽屉 |

---

## 八、验证

- [ ] 播放端「本课单词」tab 显示当前音频所有单词
- [ ] 点击单词时间戳 → 跳转到对应时间播放
- [ ] 单词收藏按钮正常工作
- [ ] 在已掌握/待复习 Tab 中点击「复习」→ 弹出填空面板
- [ ] WordsView 筛选面板改为抽屉，合集/分类/状态筛选正常
- [ ] 设置每日单词目标 → HomeView 进度条更新
- [ ] 今日单词空状态显示「去听音频」按钮
- [ ] WordList/ReviewModal/FilterDrawer 独立工作
- [ ] 课程导入后单词缓存自动刷新
- [ ] `flushTrack` 不会重复写入 play_history
- [ ] `npx tsc --noEmit` 无错误
- [ ] 已掌握 Tab 支持无限滚动

---

## 九、建议开发批次

| 批次 | 内容 | 说明 |
|------|------|------|
| **第一批** | Bug 修复（flushTrack 防双发、缓存刷新、已掌握无限滚动） | 基础设施 |
| **第二批** | 本课单词面板（PlaybackDetailTabs 新 tab） | 播放闭环 |
| **第三批** | WordsView 拆分 + 筛选抽屉重做 | 体验优化 |
| **第四批** | 每日单词目标 + HomeView 卡片增强 | 收尾完善 |
