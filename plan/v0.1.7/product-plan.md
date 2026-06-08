# v0.1.7 产品计划 — 播放队列逻辑优化

**日期**: 2026-06-08
**主题**: 重写播放队列交互逻辑，使其与"当前音频的片段列表"深度绑定——点击任一片段即定位到该音频的片段队列，而非独立管理队列项。

---

## 一、当前问题

### 1.1 片段播放与队列脱节

当前行为：
- 点击片段 A → `playNow({ kind: 'clip', clip: A })` → 将 A 加入队列，设为当前
- 此时队列中只有 A
- 再点击片段 B → `playNow({ kind: 'clip', clip: B })` → B 加入队列，A 被截断（truncate after current）
- 结果：队列累计混乱，上/下一首行为不可预期

期望行为：
- 点击任一片段 → 以该片段为起点，构建"本音频所有片段"的播放列表
- 当前片段在列表中高亮
- 上/下一首在片段列表中顺序切换

### 1.2 入口不一致

| 操作 | 当前行为 | 期望 |
|------|---------|------|
| TranscriptView 中点击片段播放按钮 | 独立播放该片段，不管理队列 | 应等同于"从此片段开始播放所有片段" |
| 侧边栏片段列表点击片段 | `playNow` 加入队列，截断后续 | 应定位到该音频的片段列表 |
| "全部播放"按钮 | 将全部片段加入队列 | 合理，但应与上面统一 |

### 1.3 用户场景

用户正在听音频 A：
1. 看到某句不错，保存为片段
2. 点击该片段播放 → 期望播放该片段及后续所有片段
3. 点上一首 → 回到前一个片段
4. 点下一首 → 跳到下一个片段

当前：点片段后队列只有这一个片段，上/下一首无法跳转到其他片段。

---

## 二、技术设计

### 2.1 核心概念：Lesson Clip Queue

引入"音频片段队列"概念：

```
┌─────────────────────────────────────────┐
│  当前音频: "Lesson A"                    │
│  片段队列 (lessonClips):                 │
│                                         │
│  [0] "first clip..."     ← 上一首       │
│  [1] "second clip..."    ← 当前播放 ★   │
│  [2] "third clip..."     ← 下一首       │
│  [3] "fourth clip..."                   │
│                                         │
│  队列 (Queue) = 正在播放的片段列表        │
└─────────────────────────────────────────┘
```

关键变化：
- **播放片段 = 将本音频所有片段加载为队列**（而非只加一个）
- **当前索引 = 被点击片段的位置**
- 上/下一首 → 在片段列表中跳转
- 仍然可以手动添加其他音频的片段到队列（队列追加模式）

### 2.2 交互规则

#### 点击片段播放（核心变化）

```
点击片段 X:
  → 获取当前音频 lessonClips 列表
  → 构建 QueueItem[] = lessonClips.map(c => ({ kind: 'clip', clip: c, lesson }))
  → 替换当前队列（不是追加）
  → currentIndex = X 在 lessonClips 中的索引
  → 开始播放 X
```

#### 全部播放（不变，优化）

```
点击"全部播放":
  → 同上，构建全部片段队列
  → currentIndex = 0（从第一个开始）
```

#### 上/下一首

```
上一首:
  → currentIndex - 1
  → 如果已到开头，停在第一个（或 repeat 回到末尾）

下一首:
  → currentIndex + 1
  → 如果已到末尾，停在最后一个（或 repeat 回到开头）
```

#### 手动加入队列

```
手动点击"加入队列":
  → 追加到当前队列末尾（不影响 currentIndex）
  → 用于混合多个音频的片段
```

### 2.3 状态变更

**playlistStore.ts** 新增/修改：

```typescript
interface PlaylistState {
  queue: QueueItem[];
  currentIndex: number;
  repeatMode: RepeatMode;

  // 新增：播放音频的片段列表（替换队列）
  playClipsFrom: (clips: AudioClip[], lesson: ListeningLesson | null, startIndex: number) => void;
  // 修改：playNow → 如果片段属于当前音频，加入片段列表逻辑
  playNow: (item: QueueItem) => void;
  // 新增：判断队列是否来自当前音频的片段列表
  isLessonClipQueue: (lessonId: string) => boolean;
}
```

### 2.4 集成点

| 文件 | 改动 |
|------|------|
| `playlistStore.ts` | 新增 `playClipsFrom` / 修改 `playNow` |
| `PlaybackDetailTabs.tsx` | 片段行点击 → 调用 `playClipsFrom` |
| `TranscriptView.tsx` | 片段播放按钮 → 调用 `playClipsFrom` |
| `PlayerBar.tsx` | 上/下一首 → 在片段列表中跳转 |
| `PlaylistView.tsx` | 显示当前音频的片段队列上下文 |

### 2.5 边缘情况

| 场景 | 处理 |
|------|------|
| 点击的片段不属于 lessonClips | 回退到旧逻辑：`playNow` 单个播放 |
| 队列中混入其他音频的片段 | 保留追加模式，上/下一首跳转到所有队列项 |
| 当前音频无片段 | 不创建队列，提示用户先保存片段 |
| 正在播放队列，用户切换音频 | 不清除队列，但新的片段播放会替换 |

---

## 三、任务拆分

### 🔴 P0 — 核心逻辑

- [ ] **3.1 `playClipsFrom` 方法**：将一组片段替换为当前队列，设置 currentIndex
- [ ] **3.2 `playNow` 改造**：如果 item 是 clip 且属于同一音频，调用 playClipsFrom
- [ ] **3.3 片段点击集成**：PlaybackDetailTabs 中片段行和全部播放按钮使用 playClipsFrom

### 🟡 P1 — 交互完善

- [ ] **3.4 TranscriptView 片段按钮**：播放片段时使用 playClipsFrom
- [ ] **3.5 上/下一首边界处理**：到末尾时 repeat-all 回到开头
- [ ] **3.6 队列状态指示**：显示当前队列来自"xx 音频的 N 个片段"

### 🟢 P2 — 细节打磨

- [ ] **3.7 手动追加 vs 替换**：区分"播放片段"和"加入队列到末尾"
- [ ] **3.8 音频切换时清理**：切音频时如果队列是之前的片段列表，自动清理

---

## 四、文件清单

| 文件 | 操作 |
|------|------|
| `frontend/src/stores/playlistStore.ts` | 修改 |
| `frontend/src/components/PlaybackDetailTabs.tsx` | 修改 |
| `frontend/src/components/TranscriptView.tsx` | 修改 |
| `frontend/src/components/PlayerBar.tsx` | 修改 |
| `frontend/src/views/PlaylistView.tsx` | 修改 |

---

## 五、不涉及

- ❌ 数据库变更
- ❌ 后端 API 变更
- ❌ 听写模式
- ❌ AI 翻译/解析
- ❌ UI 主题/布局

---

## 六、预估

| 优先级 | 模块 | 任务数 | 预估 |
|--------|------|--------|------|
| 🔴 P0 | 核心逻辑 | 3 | 1 天 |
| 🟡 P1 | 交互完善 | 3 | 0.5 天 |
| 🟢 P2 | 细节打磨 | 2 | 0.5 天 |
| **合计** | | **8** | **2 天** |
