# v0.2.0 Review Report

> 基于 dev-0.1.8 的迭代，聚焦 UI 一致性和 Bug 修复

---

## 一、Bug 修复

### 1. 合集颜色筛选失效

**问题：** `all_clips` 动态合集按颜色筛选片段时选不到任何片段。

**原因：**
- 后端 `all_clips` SQL 查询用 `SELECT id AS item_ref` 返回 `item_ref` 为 **number**（SQLite INTEGER）
- `clipsStore` 中 clip 的 `id` 是 `String(c.id)` 为 **string**
- `getCollectionClipColor` 中 `c.id === item.item_ref` 永远为 false（`"42" === 42`）
- 后备 `getExtraColor(item.extra_data)` 也无效，因为 `all_clips` 的 `extra_data` 为 `'{}'`

**修复：** `CollectionDetailView.tsx:38` — `String(item.item_ref)` 统一转为 string 比较

### 2. Transcript 歌词边框 → 背景

**问题：** 播放中的歌词句子用 `box-shadow: inset 0 0 0 2px` 模拟边框，视觉上比较突兀。

**修复：** `index.css`
- `.transcript-line.active`：边框 → `background: var(--bg-active)`
- `.transcript-line:hover`：边框 → `background: var(--bg-hover)`

### 3. 后端打包失败

**问题：** `bundle-backend.sh` 硬编码 `python3.9/site-packages`，而开发环境为 Python 3.12。

**修复：** 自动检测 `.venv/lib/python3.x` 版本号，动态拼接路径。

---

## 二、UI 一致性改进

### 1. 所有片段 Icon 颜色统一

播放详情侧栏的片段 icon 有颜色（`style={{ color: clip.color }}`），而其他视图的 icon 是灰色（`text-tertiary`）或硬编码色。

| 位置 | 修复前 | 修复后 |
|------|--------|--------|
| **ClipsView** | `text-tertiary` | `style={{ color: clip.color }}` |
| **CollectionDetailView** | `text-tertiary` | `style={{ color: itemColor }}` |
| **LessonDetailPanel** 片段列表 | 灰色 icon | `style={{ color: clip.color }}` |
| **LessonDetailPanel** 收藏片段 | `var(--clip-gradient)` | 从 store 查找 `clip.color` + `'30'` |
| **PlaybackDetailTabs** 收藏片段 | `var(--clip-gradient)` | 从 store 查找 `clip.color` + `'30'` |
| **PlayerBar** 片段模式 | 无颜色 | `style={{ color: mode.clip.color }}` |
| **QueuePanel** 片段 | `text-amber-500` | `style={{ color: clip.color }}` |

### 2. 所有片段 Icon 背景统一

播放详情侧栏使用 `clip.color + '30'`（19% 透明度），其他位置用 `+ '20'`（12%）偏暗。

统一改为 `+ '30'`，并去掉残存的 `border: 1px` 边框。

### 3. 播放栏时间显示

默认隐藏时间 `a/b`（`opacity-0`），悬浮控制区时显示（`group-hover:opacity-100`）。

---

## 三、功能改进

### 合集播放全部按钮拆分

**之前：** 点击「播放全部」弹出 PlayConfigPanel（类型/颜色筛选设置弹窗）→ 再点「开始播放」

**之后：**
- 「播放全部」按钮直接播放（不再弹设置）
- 新增 `HiAdjustmentsHorizontal` 筛选图标按钮，点击弹出 PlayConfigPanel
- 筛选图标右上角数字实时显示当前筛选后的条目数（`filteredCount`）
- 有筛选时数字高亮 accent 色，无筛选时灰色显示总数

---

## 四、影响范围

| 影响 | 文件 |
|------|------|
| 合集颜色筛选 | `CollectionDetailView.tsx` |
| 播放全部 UX | `CollectionDetailView.tsx` |
| Icon 颜色统一 | `ClipsView.tsx`, `PlayerBar.tsx`, `QueuePanel.tsx`, `PlaybackDetailTabs.tsx`, `LessonDetailPanel.tsx` |
| 歌词边框 → 背景 | `index.css` |
| 播放栏时间 | `PlayerBar.tsx` |
| 打包脚本 | `bundle-backend.sh` |
| API 辅助 | `api.ts`（新增 PUT helper） |

---

## 五、已知问题

1. `updateClip` 仅更新内存中的 zustand store，不持久化到后端，刷新页面后 clip 颜色/备注会丢失
2. `all_clips` 动态查询 `extra_data` 仍为 `'{}'`，未包含颜色信息（但前端已不依赖此字段）
