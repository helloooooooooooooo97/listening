# v0.2.1 Review Report

> 交互细节统一 — AI 功能扩散、片段编辑入口补齐、播放操作一致性

---

## 一、新增组件

### 1. ClipActions
提取自 `PlaybackDetailTabs` 的片段操作按钮组，支持：

| 功能 | 触发方式 | 说明 |
|------|----------|------|
| AI 解析 | `onAnalyze` | 自动缓存分析结果，加载/完成/失败三态 |
| 编辑 | `onEdit` | 打开 `EditClipModal` 改色/备注 |
| 加入队列 | `onAddToQueue` | 快捷加入播放队列 |
| 删除 | `onDelete` | 移除片段 |

### 2. ClipAnalysisModal
独立 AI 分析结果弹窗，从 `PlaybackDetailTabs` 原内联弹窗提取。

---

## 二、视图集成

### ClipsView（全部片段页）

| 新增功能 | 实现 |
|----------|------|
| **播放全部** 按钮 | 顶部右侧，收集当前筛选/全部片段到队列播放 |
| **ClipActions** | 每张卡片右下角 hover 显示（AI/编辑/删除/加入队列） |
| **AI 分析** | 首次点击触发，缓存结果，加载中 pulse 动画 |
| **编辑** | 调用 `updateClip` 更新 store |
| **ClipAnalysisModal** | 点击 AI 结果弹窗展示 |

### CollectionDetailView（合集详情）

| 新增功能 | 实现 |
|----------|------|
| **ClipActions** | 片段类型条目的操作区替换为 ClipActions |
| **AI 分析** | 与 ClipsView 相同模式 |
| **编辑** | 调用 `clipsStore.updateClip` |
| **删除** | 调用 `clipsStore.removeClip` |

### FavoritesView（收藏页）

| 新增功能 | 实现 |
|----------|------|
| **Clip 分组+播放全部** | 按 audio title 分组，每组顶部「播放全部」按钮 |
| **ClipActions** | 每个收藏片段 hover 显示 |
| **Icon 颜色** | 从 clips store 查找实际颜色 |
| **AI 分析** | 与 ClipsView 相同模式 |

---

## 三、影响范围

| 文件 | 变更 |
|------|------|
| `ClipActions.tsx` | **新建** — 片段操作按钮组件 |
| `ClipAnalysisModal.tsx` | **新建** — AI 分析结果弹窗 |
| `ClipsView.tsx` | +81 行，集成 ClipActions + 播放全部 |
| `CollectionDetailView.tsx` | +75 行，集成 ClipActions + AI |
| `FavoritesView.tsx` | +124 行，片段分组/播放入口 + ClipActions + AI |

---

## 四、未实现（plan 中标记为 P2/P3）

- 片段列表 hover/active 视觉统一（P2）
- 空状态区分动态/静态合集（P3）
- LessonDetailPanel 集成（已在 PlaybackDetailTabs 中存在，非独立视图）
- QueuePanel 快捷操作（队列操作逻辑不同，不适合 ClipActions）

---

## 五、已知问题

- `updateClip` 不持久化到后端，刷新后颜色/备注丢失
- FavoritesView 中 clip 的 `startTime`/`endTime` 来自 `extra_data`，部分旧数据可能缺失
