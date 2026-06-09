# v0.2.2 Product Plan — 正在播放 + 播放队列体验打磨

> 目标：打磨正在播放的内容展示、播放队列的交互细节，提升日常使用流畅度

---

## 一、正在播放（PlayerBar + PlayerPanel）

### 1.1 底部播放栏（PlayerBar）

**现状：**
- 进度条在顶部，容易误触
- 片段模式缺少当前播放时间范围指示（`startTime-endTime`）
- 右侧操作区（收藏、倍速、音量、循环）没有分组，图标多且密
- 隐藏的时间悬浮显示不明显

**改进：**

| 项 | 说明 |
|----|------|
| 进度条交互优化 | 增加进度条高度（`h-1` → `h-1.5`），hover 时变高便于拖动 |
| 片段模式时间指示 | 片段播放时在进度条上标记 `[startTime, endTime]` 范围色块 |
| 操作按钮分组 | 左侧：收藏 + 名称；中间：播放控制；右侧：倍速/音量/循环/队列 |
| 时间显示 | `a/b` 时间已做悬浮显示，保持 |

### 1.2 展开视图（PlayerPanel）

**现状：**
- 片段模式下展开视图仅显示片段文本和备注，缺少上下文歌词
- 展开后全屏覆盖，缺少"正在播放"的沉浸感

**改进：**

| 项 | 说明 |
|----|------|
| 片段展开视图增强 | 显示片段所在课程标题 + 前后几句歌词作为上下文 |
| 进度条增强 | 点击进度条任意位置可跳转，显示时间戳标记 |
| 倍速/循环状态 | 展开视图中显示当前倍速和循环模式，可直接切换 |
| 播放完成状态 | 音频/片段播放完毕后的状态提示（不要空转） |

### 1.3 歌词视图（TranscriptView）

**现状：**
- 正在播放的句子只有背景色高亮（v0.2.0 已改）
- 片段模式下没有视觉区分当前片段范围
- 歌词行没有时间戳显示

**改进：**

| 项 | 说明 |
|----|------|
| 片段范围指示 | 当前 clip 的 `[startTime, endTime]` 之间所有歌词行用 clip.color 半透明底色标记 |
| 时间戳 on hover | 歌词行悬浮时显示 `mm:ss` 时间戳 |
| 当前行增强 | 正在播放的句子加左侧 accent 播放指示条（与片段列表统一） |

---

## 二、播放队列（QueuePanel）

### 2.1 队列面板 UI

**现状：**
- 队列条目没有排序/拖拽功能
- 当前播放项仅有一个小圆点指示
- 历史记录和当前队列混合显示，交互不够清晰
- 没有"播完后自动移除"的视觉反馈

**改进：**

| 项 | 说明 |
|----|------|
| 当前项视觉增强 | 当前播放项：左侧 accent 条 + 行背景色加深 + 播放中动画 |
| 队列排序拖拽 | 支持上下拖拽调整顺序（react-dnd 或原生 HTML5 drag） |
| 清除已完成 | 播放完成的条目自动移出队列（或提供开关选项） |
| 空队列状态 | 增加引导提示，展示从哪里添加内容到队列 |

### 2.2 添加到队列的交互

**现状：**
- ClipsView 加队列按钮在 ClipActions 中（hover 显示）
- CollectionDetailView 加队列通过 `handleAddItemToQueue`
- 各视图添加到队列的 Toast 提示不一致

**改进：**

| 项 | 说明 |
|----|------|
| 添加反馈统一 | 所有添加到队列的操作都有 Toast + 队列图标微动效 |
| 批量加队列 | ClipsView 的「播放全部」同时支持「全部加入队列」 |

### 2.3 队列播放逻辑

**现状：**
- `playlistStore.playClipsFrom` 将一个课程所有片段加入队列
- `playClipsFrom` 的实现有重复代码（see `playlistStore.ts`）

**改进：**

| 项 | 说明 |
|----|------|
| playClipsFrom 重构 | 消除与 `addAllToQueue` 的重复代码 |
| 队列持久化 | 刷新页面后队列不清空（zustand persist + localStorage） |

---

## 三、交互细节清单

| # | 项 | 优先级 | 涉及文件 |
|---|-----|--------|----------|
| 1 | PlayerBar 进度条交互增强（高度+hover变高） | P0 | `PlayerBar.tsx` |
| 2 | 片段模式进度条显示 [startTime,endTime] 范围 | P0 | `PlayerBar.tsx` |
| 3 | PlayerBar 操作按钮重新分组 | P1 | `PlayerBar.tsx` |
| 4 | PlayerPanel 片段上下文歌词 | P1 | `PlayerPanel.tsx`, `TranscriptView.tsx` |
| 5 | TranscriptView 片段范围色块标记 | P1 | `TranscriptView.tsx` |
| 6 | 歌词行悬浮显示时间戳 | P1 | `TranscriptView.tsx` |
| 7 | 当前播放句子左 accent 条 | P1 | `TranscriptView.tsx`, `index.css` |
| 8 | 队列当前项视觉增强 | P0 | `QueuePanel.tsx` |
| 9 | 队列拖拽排序 | P1 | `QueuePanel.tsx` |
| 10 | 添加到队列反馈统一 | P1 | `ClipActions.tsx`, 各视图 |
| 11 | 批量加队列（全部加入队列按钮） | P1 | `ClipsView.tsx`, `FavoritesView.tsx` |
| 12 | playClipsFrom 重构去重 | P2 | `playlistStore.ts` |
| 13 | 队列持久化（localStorage） | P2 | `playlistStore.ts` |
| 14 | 清除已完成项 | P2 | `playlistStore.ts`, `QueuePanel.tsx` |
| 15 | 空队列引导 | P2 | `QueuePanel.tsx` |

---

## 四、里程碑

1. **PlayerBar 进度条增强** — 0.5d
2. **片段范围标记 + 歌词时间戳** — 1d
3. **PlayerPanel 上下文增强** — 0.5d
4. **队列 UI 增强 + 当前项视觉** — 0.5d
5. **队列拖拽排序** — 1d
6. **添加到队列交互统一** — 0.5d
7. **队列逻辑重构 + 持久化** — 0.5d

总计约 **4-5 天**

---

## 五、技术方案

### 进度条范围标记

在 `PlayerBar.tsx` 进度条上叠加一个 `div` 表示 clip 的 `[startTime, endTime]` 范围：

```tsx
{isC && dur > 0 && (
  <div className="absolute top-0 left-0 h-full bg-[var(--accent)]/20 pointer-events-none"
    style={{
      left: `${(mode.clip.startTime / dur) * 100}%`,
      width: `${((mode.clip.endTime - mode.clip.startTime) / dur) * 100}%`
    }}
  />
)}
```

### 歌词悬浮时间戳

每行歌词加 `group` + `opacity-0 group-hover:opacity-100` 显示 `mm:ss`，复用歌词行已有的 `line.start`。

### 队列拖拽

使用原生 HTML5 Drag & Drop API（避免引入额外依赖）：
- `draggable` + `onDragStart` / `onDragOver` / `onDrop`
- 目标交换 `queue` 数组中两个元素的位置
- `playlistStore` 加 `moveItem(from, to)` 方法

### 队列持久化

zustand `persist` 中间件 + `localStorage`，队列和当前索引在刷新后恢复。

```ts
create(
  persist(
    (set, get) => ({ ... }),
    { name: 'playlist-queue' }
  )
)
```
