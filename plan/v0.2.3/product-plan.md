# v0.2.3 Product Plan — 代码优化 & 抽象

> 目标：消除重复代码、提取可复用 hook/组件、清理冗余逻辑

---

## 一、提取 useClipAnalysis hook

### 现状
AI 分析状态管理在 5 个文件中完全重复：

| 文件 | 行数 | 重复代码 |
|------|------|----------|
| `ClipsView.tsx` | ~12 行 | 3 个 state + handleAnalyze |
| `CollectionDetailView.tsx` | ~12 行 | 同上 |
| `FavoritesView.tsx` | ~12 行 | 同上 |
| `LessonDetailPanel.tsx` | ~12 行 | 同上 |
| `PlaybackDetailTabs.tsx` | ~12 行 | 同上 |

### 方案

```ts
// hooks/useClipAnalysis.ts
export function useClipAnalysis() {
  const [clipAnalyses, setClipAnalyses] = useState<Map<string, ClipAnalysis>>(new Map());
  const [analyzingClips, setAnalyzingClips] = useState<Set<string>>(new Set());
  const [viewingAnalysis, setViewingAnalysis] = useState<ClipAnalysis | null>(null);
  const analyzeClipFn = useAiStore(s => s.analyzeClip);
  const addToast = useToastStore(s => s.addToast);

  const handleAnalyze = useCallback((text: string) => {
    if (clipAnalyses.has(text) || analyzingClips.has(text)) return;
    setAnalyzingClips(prev => new Set(prev).add(text));
    analyzeClipFn(text)
      .then(analysis => {
        setClipAnalyses(prev => new Map(prev).set(text, analysis));
        setAnalyzingClips(prev => { const n = new Set(prev); n.delete(text); return n; });
      })
      .catch(() => {
        setAnalyzingClips(prev => { const n = new Set(prev); n.delete(text); return n; });
        addToast('AI 分析失败', 'error');
      });
  }, [clipAnalyses, analyzingClips, analyzeClipFn, addToast]);

  return { clipAnalyses, analyzingClips, viewingAnalysis, setViewingAnalysis, handleAnalyze };
}
```

### 涉及文件
- `hooks/useClipAnalysis.ts` — 新建
- `ClipsView.tsx` — 替换为 hook
- `CollectionDetailView.tsx` — 替换
- `FavoritesView.tsx` — 替换
- `LessonDetailPanel.tsx` — 替换
- `PlaybackDetailTabs.tsx` — 替换（保留 auto-analyze effect）

---

## 二、提取 useCollectionFilter hook

### 现状
`CollectionDetailView.tsx` 中的颜色/类型筛选逻辑在主组件和 `PlayConfigPanel` 之间完全重复（`filteredItems` / `filteredCount`）。

### 方案
```ts
// hooks/useCollectionFilter.ts
interface FilterState {
  playTypes: Set<string>;
  playColors: Set<string>;
}
```
- 封装 `playTypes`、`playColors` 状态管理
- 封装 `filteredItems` 计算逻辑
- 返回 `filteredCount`、`isFilterActive` 等派生状态

---

## 三、清除 PlaybackDetailTabs 内联 EditClipModal 重复

### 现状
`PlaybackDetailTabs.tsx` 中有 **两处** 完全相同的内联编辑弹窗代码（行 379-434 和 549-585），共约 110 行重复代码。但 `EditClipModal` 组件已经存在且被 `ClipActions` 使用。

### 方案
- 删除两处内联编辑弹窗，替换为 `<EditClipModal>` 组件
- 清理 `editNote`、`editingColor` 等不再需要的本地 state
- 移除对应的 `HiXMark`、`HiPencil` 等局部 import（确认是否被其他地方使用）

---

## 四、PlaybackDetailTabs 逻辑拆分

### 现状
`PlaybackDetailTabs.tsx` 638 行，承担了：
- 弹窗 state 管理
- 三个 tab（clips/dictation/favorites）的渲染
- AI 分析
- 编辑弹窗
- 导出功能

### 方案
- 将 clip actions 区域的 AI/编辑/删除逻辑替换为 `ClipActions` 组件（ClipActions 已存在）
- 将 dictation tab 渲染抽为 `DictationTab` 内部组件或独立文件
- 将 favorites tab 渲染抽为 `FavoritesTab` 组件

---

## 五、其他代码清理

| # | 项 | 说明 | 涉及文件 |
|---|-----|------|----------|
| 1 | 清理未使用的 import | `react-icons/hi2` 中未使用的图标 | 多个文件 |
| 2 | CSS 变量清理 | 检查 `index.css` 中未使用的 `var(--*)` | `index.css` |
| 3 | PlaybackDetailTabs 移除 auto-analyze effect | 效果产生冗余 API 调用（每节课所有 clips 都分析），可改为按需分析 | `PlaybackDetailTabs.tsx` |
| 4 | 类型定义统一 | `FavoriteItem` 的 `extra_data` 解析逻辑分散在各处，可提取工具函数 | `FavoritesView.tsx` + `PlaybackDetailTabs.tsx` |
| 5 | collectionQueue.ts 检查 | 检查 `collectionItemToQueueItem` 和 `collectionItemsToQueueItems` 是否合理 | `lib/collectionQueue.ts` |
| 6 | 硬编码字符串抽取 | 颜色列表 `COLOR_HEX` / `CLIP_COLORS` 多处分定义，统一到常量文件 | `CollectionDetailView.tsx`, `EditClipModal.tsx`, `TranscriptView.tsx` |

---

## 六、目录结构建议

```
frontend/src/
├── components/        ← 保留现有 UI 组件
├── hooks/             ← 新增
│   ├── useClipAnalysis.ts
│   └── useCollectionFilter.ts
├── stores/            ← 保留现有状态管理
├── lib/               ← 保留现有工具函数
├── types/             ← 保留现有类型定义
└── constants/
    └── colors.ts      ← 新增：CLIP_COLORS / COLOR_HEX 统一常量
```

---

## 七、里程碑

1. **useClipAnalysis hook** — 1h
2. **useCollectionFilter hook** — 1h
3. **EditClipModal 重复清理** — 0.5h
4. **PlaybackDetailTabs 拆分** — 2h
5. **其他代码清理** — 1h

总计约 **1 天**
