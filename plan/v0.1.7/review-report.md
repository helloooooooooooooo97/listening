# v0.1.7 评审报告

**日期**: 2026-06-08
**范围**: 播放队列逻辑优化 + 倍速兼容性修复 + 编辑弹窗  
**文件**: 6 个文件变更，+69/-43 行

---

## 变更概览

### 🔴 P0 — 播放队列逻辑重写

**核心问题**：点击片段播放时，只用 `playNow` 把该片段加入队列，上/下一首无法跳转到其他片段。

**解决方案**：新增 `playClipsFrom` 方法，点击任一片段时将当前音频的**所有片段**加载为队列：

```
之前: 队列 = [片段B]               → 上一首/下一首 无内容
现在: 队列 = [片段A, 片段B, 片段C, 片段D]  → 可在片段间跳转
                      ↑ currentIndex=1
```

受影响文件：
- `playlistStore.ts` — 新增 `playClipsFrom` / `queueContext` / `playPrev` 回绕
- `PlaybackDetailTabs.tsx` — 片段点击 + 全部播放改用 `playClipsFrom`
- `TranscriptView.tsx` — 歌词中片段播放按钮改用 `playClipsFrom`

### 🟡 P1 — 交互完善

| 任务 | 实现 |
|------|------|
| `playPrev` 边界处理 | 支持 repeat-all 回绕到末尾 |
| 队列状态指示 | `queueContext` 跟踪来源，PlaylistView 显示"来自 xx 音频的 N 个片段" |
| 音频切换清理 | 切换到不同音频时自动清空队列 |

### 🔴 P0 — 倍速兼容性修复（Chromium / Edge）

**问题**：Edge 浏览器（Chromium 内核）中倍速设置无效，始终 1x 播放。

**根因**：

| 问题 | 说明 |
|------|------|
| `audio.load()` 重置 `playbackRate` | Chromium 在调用 `load()` 后把速率重置为 1。Safari 无此问题 |
| `playbackRate` 需在 `play()` 之后设置 | Chromium 要求 `a.play()` **之后**再设 `a.playbackRate`，之前设置被忽略 |

**修复**：
1. `audioEngine.ts`: `switchSource` 保存 `_savedRate`，`load()` 后立即恢复
2. `audioStore.ts`: `playLesson` / `playClip` 改为先 `a.play()` 再 `a.playbackRate = rate`
3. `getSettingDefault` 与 zustand persist 中间件数据格式不兼容，改用 `useSettingsStore` 读取

### 🟢 P2 — 片段编辑弹窗

- 删除每个片段行内的六个颜色小圆圈
- 删除内联编辑（isEditing 条件渲染）
- 点击编辑 → 弹出独立窗口（备注输入 + 6 色选择 + 保存/取消）
- 片段文本下方显示起止时间和时长

---

## 发现问题 & 处理

| # | 严重度 | 文件 | 问题 | 处理 |
|---|--------|------|------|------|
| 1 | 🔴 高 | `audioEngine.ts` / `audioStore.ts` | Edge/Chrome 倍速不生效，`load()` 重置 rate | ✅ `_savedRate` 保存+恢复 + `play()` 后设 rate |
| 2 | 🔴 中 | `audioStore.ts` | `getSettingDefault` 读取 persist 中间件的嵌套格式失败 | ✅ 改用 `useSettingsStore.getState()` |
| 3 | 🟡 低 | `PlaybackDetailTabs.tsx` | 全部播放按钮先 `addAllToQueue` 再 `playNow` 第一个片段重复 | ✅ 改用 `playClipsFrom` 统一处理 |
| 4 | 🟡 低 | `TranscriptView.tsx` | 歌词中片段播放按钮只播单个片段，无队列上下文 | ✅ 改用 `playClipsFrom` |

---

## 核心架构变化

```
v0.1.6 (之前)                 v0.1.7 (现在)
─────────────────             ─────────────────
点击片段 → playNow()          点击片段 → playClipsFrom()
         → 队列 = [片段]                → 队列 = [全部片段]
         → 上/下一首 无内容             → 上/下一首 在片段间跳转

播放栏倍速 → setRate()        播放栏倍速 → setRate()
          → a.playbackRate               → a.playbackRate (play()之后)
          → a.play()先                   → setSavedRate → switchSource恢复
          → Safari: ✓                    → Safari: ✓
          → Edge/Chrome: ✗               → Edge/Chrome: ✓
```

---

## 结论

v0.1.7 主要解决了两个核心问题：播放队列逻辑（点击片段后片段间可跳转）和 Edge/Chrome 倍速兼容性。改动量小但影响面广，已在 Safari 和 Edge 上验证。

**评审结果**: ✅ 通过
