# v0.2.6 Review Report

> 15 files changed, 1446 insertions(+), 329 deletions(-)

---

## 核心变化

### 🎯 今日听词系统（P0）

自动记录你每天真正听过的单词，独立复习。

| 文件 | 改动 |
|------|------|
| `backend/app/database.py` | 新增 `listened_words` 表 + `今日单词` 默认动态合集 |
| `backend/app/services/collection_service.py` | 新增 `today_words` 动态合集查询 |
| `backend/app/text_utils.py` | **新建** — `clean_word()` 工具函数，集中管理单词去标点逻辑 |
| `backend/app/repositories/progress_repo.py` | 新增 `record_listened_words`、`get_today_words`、`get_today_stats` |
| `backend/app/routers/progress.py` | 新增 `POST /listened-words`、`GET /daily-words/today`、`GET /daily-words/stats` |

**数据流：**

```
播放 → trackPlay()
  ↓
暂停 → flushTrack()
  ├─ POST play-history（已有）
  └─ 从 lesson.words 筛选 word.start <= elapsed
     └─ POST listened-words → 存入 listened_words 表
```

### 🎯 今日单词复习（P0）

填空听写式复习，切词自动播原音。

| 文件 | 改动 |
|------|------|
| `backend/app/routers/words.py` | 新增 `GET /words/{word}/sentences` — 返回单词所在的句子上下文 |
| `frontend/src/lib/api.ts` | 新增 `TodayWord`、`TodayStats`、`WordSentence` 类型 + 4 个 API 函数 |
| `frontend/src/views/WordsView.tsx` | 新增复习弹窗：填空、自动播句子、自动判对错、完成统计 |

**复习流程：**

```
点击"开始今日复习"
  → 弹窗显示句子（目标词挖空 ___）
  → 自动播放该句子的音频片段
  → 用户输入单词拼写
  → 自动判对错（绿色 / 红色反馈）
  → 下一词 → 全部完成 → 总结（正确率）
```

### 🎯 WordsView 重构（P0）

| 改动 | 说明 |
|------|------|
| Tab 栏 | 📅 今日单词 / 📚 全部单词 / 🔄 待复习 / ✅ 已掌握 |
| 今日单词 Tab | 默认显示，展示今天听过的所有单词 + 进度 |
| 列表布局 | 从网格改为列表，左右布局，信息更清晰 |
| 单词详情 | 新增统计行 + AI 分析入口（✨ 图标） |
| 全部单词筛选 | 保留合集/分类筛选 |
| 单词列表 | 添加 AI ✨ 图标（hover 显示），点击直接查 AI 分析 |
| 已掌握 Tab | 修复后端集合查询 bug，正确显示已掌握单词 |

### 🔧 修复

| 问题 | 修复 |
|------|------|
| `playTracking.ts` ↔ `audioStore.ts` 循环依赖 | 合并 `playTracking.ts` 到 `audioStore.ts`，删除独立模块 |
| 播放 clip 第二次不停止 | `viewClip` 中重置 `_clipEndHandled` 标志 |
| 单词缓存查找失败（标点问题） | `get_word_detail`、`get_word_sentences` 使用 `clean_word` 清理入参 |
| 句子匹配不准（文本匹配） | 改为时间戳区间匹配 |
| 填空题正则匹配到子串（"or" 匹配到 "for"） | 添加 `\b` 单词边界 |
| 存储词带标点导致填空/划线失败 | `record_listened_words` 写入前先 `clean_word` |
| 已掌握 Tab 列表为空 | `all_words` 集合返回单词名，修复后端 lesson_id 过滤逻辑 |
| 中文独占模式字号太小 | 切换到 `text-base` 匹配英文大小 |
| 划线选中单词有圆角 | 去掉 `.transcript-word` 基类的 `rounded` |
| WordBadges 带 `rounded-md` | 去掉圆角使划线更直 |

### 💅 体验优化

| 改动 | 说明 |
|------|------|
| 首页卡片改为网格布局 | 今日单词 + 待复习并排两列 |
| 卡片颜色适配暗色模式 | 从渐变色改为 `var(--bg-tertiary)` + 主题色图标 |
| Tab emoji 改为 icon | 📅📚🔄✅ → `HiSun`/`HiBookOpen`/`HiArrowPath`/`HiCheck` |
| AI 图标统一 | 全部改为 `HiSparkles` ✨，与播放器右键菜单一致 |
| 单词详情增强 | 增加统计（次数、课时数、掌握状态）+ AI 分析面板 |

---

## 文件变更清单

### 后端（7 文件，+200 行）

| 文件 | 行数 |
|------|------|
| `backend/app/database.py` | +15 |
| `backend/app/repositories/progress_repo.py` | +57 |
| `backend/app/routers/progress.py` | +25 |
| `backend/app/routers/words.py` | +111 |
| `backend/app/services/collection_service.py` | +16 |
| `backend/app/text_utils.py` | +11 **(new)** |

### 前端（8 文件，+1246 / -329 行）

| 文件 | 行数 |
|------|------|
| `frontend/src/views/WordsView.tsx` | +968 / -286 **(大重构)** |
| `frontend/src/views/HomeView.tsx` | +61 |
| `frontend/src/lib/api.ts` | +47 |
| `frontend/src/stores/audioStore.ts` | +44 / -30 |
| `frontend/src/lib/playTracking.ts` | -30 **(delete, merged into audioStore)** |
| `frontend/src/components/TranscriptView.tsx` | +4 |
| `frontend/src/components/dictation/WordBadges.tsx` | +8 |
| `frontend/src/index.css` | +2 |

### 文档（1 文件，+376 行）

| 文件 | 说明 |
|------|------|
| `plan/v0.2.6/product-plan.md` | 完整产品计划（多次迭代） |
| `plan/v0.2.6/review.md` | 本文件 |
