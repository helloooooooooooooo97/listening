# 技术架构 — 英语听力 App `v0.0.3`

> 继承自 [v0.0.2](../v0.0.2/technical-architecture.md)

## v0.0.3 架构变更

### 新增模块

```
frontend/src/
├── components/
│   ├── Toast.tsx                  # 🆕 Toast 通知组件
│   └── LoopModeIndicator.tsx      # 🆕 循环模式指示器
├── hooks/
│   └── useKeyboardShortcuts.ts    # 🆕 全局键盘快捷键 Hook
├── stores/
│   ├── audioStore.ts              # ✏️ 增加 loopMode、currentSentenceIndex
│   └── settingsStore.ts           # 🆕 用户设置（播放位置记忆等）
└── types/
    └── lesson.ts                  # ✏️ 增加 LoopMode 类型
```

### 数据模型变更

```typescript
// 🆕 循环模式
type LoopMode = 'all' | 'sentence' | 'clip';

// ✏️ audioStore 新增字段
interface AudioState {
  // ... existing
  loopMode: LoopMode;              // 当前循环模式
  currentSentenceIndex: number;    // 当前播放的句子索引
  cycleLoopMode: () => void;       // 切换循环模式
  jumpToPrevSentence: () => void;  // 上一句
  jumpToNextSentence: () => void;  // 下一句
}

// 🆕 用户设置
interface UserSettings {
  playbackMemory: Record<string, number>;  // lessonId → lastPosition
  lastLessonId: string | null;
}
```

### 循环模式逻辑

```
loopMode = 'all':
  播放到 audio.ended → 停止（不循环）

loopMode = 'sentence':
  currentTime 达到当前句子的 end → seek(currentSentence.start)
  上/下句跳转后重置循环起点

loopMode = 'clip':
  现有片段循环逻辑不变
```

### 键盘快捷键实现

```typescript
// useKeyboardShortcuts.ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key;
    if (key === ' ') { e.preventDefault(); togglePlay(); }
    if (key === 'ArrowLeft') seekRelative(-5);
    if (key === 'ArrowRight') seekRelative(5);
    if (key === 'ArrowUp') jumpToPrevSentence();
    if (key === 'ArrowDown') jumpToNextSentence();
    if (key === 'r' || key === 'R') cycleLoopMode();
    if (['1','2','3','4','5'].includes(key)) setRate([0.5,0.75,1,1.25,1.5][+key-1]);
    if (key === 's' || key === 'S') saveCurrentSentenceAsClip();
    if (key === 'Escape') clearSelection();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [/* deps */]);
```

### Toast 系统设计

```
┌─ ToastContainer (fixed top-right) ─┐
│  ┌──────────────────────┐          │
│  │ ✅ 片段已保存         │  3s后消失 │
│  └──────────────────────┘          │
│  ┌──────────────────────┐          │
│  │ 🗑 片段已删除         │          │
│  └──────────────────────┘          │
└────────────────────────────────────┘

实现：
- Zustand store: toastStore (toasts: Toast[], addToast, removeToast)
- Toast组件: 从右侧滑入，300ms ease-out
- 自动消失: setTimeout 3s
- 手动关闭: 点击 × 按钮
```

### 播放位置记忆

```
存储: localStorage key = 'playback-memory'
结构: { [lessonId]: lastPositionInSeconds, lastLessonId: string }

写入: audioStore timeupdate 事件中每5秒写入一次
读取: viewLesson/playLesson 时检查是否有记忆位置
UI:   PlayerPanel顶部显示 "📍 跳转到上次位置 (3:24)"
```

### 文件清理计划

| 删除文件 | 替代者 |
|---|---|
| `hooks/useAudioPlayer.ts` | `stores/audioStore.ts` |
| `hooks/useClips.ts` | `stores/clipsStore.ts` |
| `assets/react.svg` | 不再使用 |
| `assets/vite.svg` | 不再使用 |
| `assets/hero.png` | 不再使用 |

### 组件树更新

```
App
├── Sidebar
│   ├── [搜索框]
│   ├── LessonCard[]  (✏️ 选中态过渡动画)
│   └── ClipCard[]    (✏️ 排序/筛选/搜索高亮)
├── PlayerPanel
│   ├── [播放位置恢复提示] (🆕)
│   ├── TranscriptView (✏️ 禁止浏览器选中)
│   └── [听写模式面板]    (🆕 P2)
├── PlayerBar
│   ├── [⏮ ⏭ 上下句按钮]  (🆕)
│   ├── [循环模式切换]      (🆕)
│   └── (现有播放控制)
├── ToastContainer (🆕)
└── useKeyboardShortcuts (🆕 无UI)
```
