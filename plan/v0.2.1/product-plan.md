# v0.2.1 Product Plan — 交互细节统一

> 目标：补齐各视图中缺失的片段交互功能，提升操作一致性

---

## 一、AI 功能扩散

### 现状
AI 片段解析（`HiSparkles` 图标 + 弹窗）仅在 `PlaybackDetailTabs` 的播放侧栏中存在，其他展示片段的地方完全没有。

### 需要补充的位置

| 视图 | 缺失功能 |
|------|----------|
| **ClipsView**（全部片段页） | 无 AI 分析、无编辑/改色入口 |
| **CollectionDetailView**（合集详情） | 无 AI 分析、无编辑/改色入口 |
| **LessonDetailPanel**（课程详情侧栏） | AI 分析仅在主播放侧栏有，课程详情侧栏没有 |
| **QueuePanel**（队列面板） | 片段条目无快捷操作 |
| **FavoritesView**（收藏页） | 片段收藏项无播放/编辑/AI |

### 方案
- 提取 `ClipActions` 组件：包含 AI 分析、编辑（改色/备注）、删除、加入队列
- 在 ClipsView 每个片段卡片右下角加入 `ClipActions`
- 在 CollectionDetailView 片段条目中集成 `ClipActions`
- 在 FavoritesView 的片段条目中增加播放入口

---

## 二、片段编辑入口统一

### 现状
编辑片段（改色、改备注）只能在 `PlaybackDetailTabs` 侧栏通过 `EditClipModal` 完成。其他视图的片段完全不可编辑。

### 需要补充的位置
- **ClipsView**：每张卡片加编辑（铅笔）按钮
- **CollectionDetailView**：片段条目加编辑按钮（与移除并列）
- **FavoritesView**：收藏的片段支持编辑备注

---

## 三、播放操作一致性

### 缺失场景
- **ClipsView**：无「播放全部」功能，只能逐个点击播放
- **FavoritesView**：收藏的片段不能批量播放
- **CollectionDetailView**：已支持播放全部（v0.2.0），但片段项缺少「加入队列」快捷操作

### 方案
- ClipsView 顶部加「播放全部」按钮（复用 CollectionDetailView 的筛选+播放模式）
- FavoritesView 按来源音频分组，加「播放本组全部片段」

---

## 四、视觉细节打磨

### 4.1 片段卡片统一

不同视图的片段卡片样式各异：

| 视图 | 卡片样式 |
|------|----------|
| ClipsView | 圆角卡片，无边框，hover 背景变深 |
| CollectionDetailView | 列表行，hover 背景变深 |
| PlaybackDetailTabs | 列表行，active 项有 accent 底色 |
| LessonDetailPanel | 列表行，hover 背景变深 |

### 方案
统一片段列表的交互行为：
- 列表行 hover 应有「播放」指示（如左侧 accent 条或 icon 变色）
- active 播放的片段应有视觉高亮（accent 底色 + icon 放大或变色）

### 4.2 空状态/加载状态

- ClipsView empty：有提示但无配图，可增加引导步骤
- CollectionDetailView empty：有提示，但动态集空的场景未区分

---

## 五、交互细节清单

| # | 项 | 优先级 | 涉及文件 |
|---|-----|--------|----------|
| 1 | ClipsView 加 AI 分析按钮 | P0 | `ClipsView.tsx` |
| 2 | ClipsView 加编辑（铅笔）按钮 | P0 | `ClipsView.tsx` |
| 3 | ClipsView 加「播放全部」 | P1 | `ClipsView.tsx` |
| 4 | CollectionDetailView 加 AI 分析 | P1 | `CollectionDetailView.tsx` |
| 5 | CollectionDetailView 加编辑按钮 | P1 | `CollectionDetailView.tsx` |
| 6 | FavoritesView 片段支持播放 | P1 | `FavoritesView.tsx` |
| 7 | FavoritesView 片段支持编辑 | P2 | `FavoritesView.tsx` |
| 8 | 提取 ClipActions 复用组件 | P0 | 新建 `ClipActions.tsx` |
| 9 | 片段列表 hover/active 视觉统一 | P2 | `index.css` + 各视图 |
| 10 | 空状态区分动态/静态合集 | P3 | `CollectionDetailView.tsx` |

---

## 六、技术方案

### ClipActions 组件

```tsx
interface ClipActionsProps {
  clip: AudioClip;
  lesson?: ListeningLesson | null;
  onPlay?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddToQueue?: (clip: AudioClip) => void;
  showAi?: boolean;
  size?: 'sm' | 'md';
}
```

- 从 `PlaybackDetailTabs` 提取现有的 AI 分析、编辑、删除逻辑
- 各视图按需传入 props，控制显示哪些按钮

### 颜色编辑持久化（可选）

如用户需要编辑结果在刷新后不丢失，需：
- 后端：`PUT /api/clips/{id}`（clips_api.py）
- 前端：`clipsStore.updateClip` 增加 API 调用
- 参考 v0.2.0 review 中记录的已知问题

---

## 七、里程碑

1. **ClipActions 组件提取** — 1d
2. **ClipsView 集成** — 0.5d
3. **CollectionDetailView 集成** — 0.5d
4. **FavoritesView 片段入口** — 0.5d
5. **播放全部功能扩散** — 0.5d
6. **视觉统一打磨** — 0.5d

总计约 **3-4 天**
