# v0.2.0 产品计划 — 功能细节打磨

**日期**: 2026-06-09
**主题**: 零新功能，聚焦已有功能的交互细节打磨、边界情况处理、UI统一、修复遗留问题。

> 前置版本: v0.1.9 已完成全面性能优化（Safari 60fps、后端缓存、预加载精简）。v0.2.0 回过来打磨每一个功能板块的交互细节。

---

## 目录

1. [代码质量修复（遗留缺陷）](#一代码质量修复遗留缺陷)
2. [播放体验打磨](#二播放体验打磨)
3. [歌词与翻译体验](#三歌词与翻译体验)
4. [听写体验](#四听写体验)
5. [片段与收藏管理](#五片段与收藏管理)
6. [队列管理](#六队列管理)
7. [首页与导航](#七首页与导航)
8. [设置页](#八设置页)
9. [UI/UX 统一](#九uiux-统一)
10. [键盘快捷键系统](#十键盘快捷键系统)
11. [统计页](#十一统计页)

---

## 一、代码质量修复（遗留缺陷）

### 1.1 PlayerBar 残留 `backdrop-filter`（严重）

**问题**: v0.1.9 已在 `index.css` 移除了全局 `.glass` 类的 `backdrop-filter`，但 `PlayerBar.tsx` 第 167-169 行内联样式仍然保留 `backdrop-filter: blur(40px) saturate(180%)`。Safari/WKWebView 仍然卡顿。

**修复**: 删除 PlayerBar 组件的内联 `backdrop-filter` 和 `WebkitBackdropFilter` 样式。

**文件**: `frontend/src/components/PlayerBar.tsx`

### 1.2 `animate-speed-pop` 引用未定义

**问题**: PlayerBar.tsx 第 278 行引用了 `animate-speed-pop` CSS class，但 `index.css` 中没有定义该动画。速度选中时无视觉反馈。

**修复**: 在 `index.css` 中补全 `animate-speed-pop` keyframes 定义，或移除引用改用 `animate-scale-in`。

**文件**: `frontend/src/index.css` + `frontend/src/components/PlayerBar.tsx`

### 1.3 PlaybackDetailTabs 编辑片段弹窗代码重复

**问题**: `PlaybackDetailTabs.tsx` 第 378-427 行与第 544-592 行是完全相同的编辑片段弹窗代码（从 `editingClipId && (() => {...})()` 到结束），被复制粘贴了两份。

**修复**: 提取为独立组件 `EditClipModal.tsx`，消除重复。

**文件**: `frontend/src/components/PlaybackDetailTabs.tsx` (删除重复代码)
**新增**: `frontend/src/components/EditClipModal.tsx`

---

## 二、播放体验打磨

### 2.1 进度显示

**问题**: PlayerBar 没有当前时间/总时长文本显示。用户只能通过波形图大概判断进度。

**方案**: 在播放按钮右侧（或波形图右下角）添加 `fmt(currentTime) / fmt(duration)` 文本显示，字体 `tabular-nums`，颜色 `text-tertiary text-xs`。

**文件**: `frontend/src/components/PlayerBar.tsx`

### 2.2 播放/暂停键盘快捷键不统一

**问题**: Space 键能播放/暂停，但 Q 键打开队列面板时不阻止默认行为（滚动页面）。PlayerBar 的 queue button 有 title "播放队列 (Q)"，但 `useKeyboardShortcuts.ts` 中没有 Q 键的绑定。

**方案**: 
- 在 `useKeyboardShortcuts.ts` 中添加 Q 键绑定 → 切换队列面板
- 确保队列面板打开时 Space 不触发播放切换

**文件**: `frontend/src/components/PlayerBar.tsx` + `frontend/src/hooks/useKeyboardShortcuts.ts`

### 2.3 音量控制的混乱

**问题**: PlayerBar 的 volume slider 直接使用 `document.querySelector("audio")` 获取 `<audio>` 元素，绕过 zustand store。且音量值虽然持久化到 `localStorage("app-volume")`，但应用启动时不从 localStorage 恢复音量。

**方案**:
- 将音量状态纳入 `audioStore`（`{ volume: number }`）
- `settingsStore` 添加 `volume` 持久化
- 音量 slider 改为使用 store API

**文件**: `frontend/src/stores/audioStore.ts`, `frontend/src/stores/settingsStore.ts`, `frontend/src/components/PlayerBar.tsx`

### 2.4 音频加载失败反馈

**问题**: 当前网络断开或音频文件缺失时，播放按钮一直转圈（loading 状态），没有错误提示。用户不知道是加载中还是失败了。

**方案**: 
- `audioStore` 增加 `error: string | null` 状态
- 音频 `onError` 事件设置 error 信息
- PlayerBar 显示错误 Toast 并恢复为暂停状态
- 波形图区域显示"加载失败"占位

**文件**: `frontend/src/stores/audioStore.ts`, `frontend/src/components/PlayerBar.tsx`, `frontend/src/components/Waveform.tsx`

### 2.5 `上一首/下一首` 与 `上一句/下一句` 的混淆

**问题**: PlayerBar 中的 `playPrev`/`playNext` 操作的是"队列中的上/下一个条目"。而实际使用场景中，用户经常希望"上/下一句"（在当前音频内导航句子）。两者的区别不清晰。

**方案**: 
- 保留 ← → / ↑ ↓ 为句子导航（已实现）
- PlayerBar 的 prev/next 按钮增加 tooltip 说明："队列中上/下一个"
- 或者当队列只有 1 项时，prev/next 自动回退为句子导航

**文件**: `frontend/src/components/PlayerBar.tsx` (tooltip 文案)

---

## 三、歌词与翻译体验

### 3.1 AI 翻译批量请求限流

**问题**: `TranscriptView.tsx` 第 257-264 行，当 `translationEnabled` 打开时，立即对 **所有** 未翻译的句子发起翻译请求。如果有 30 个句子，瞬间发出 30 个 AI API 请求，导致限流 / 超时。

**方案**: 
- 改为**按需翻译**：只翻译当前可视区域（viewport）内的句子
- 使用 IntersectionObserver 感知句子进入视图
- 翻译结果缓存到组件状态（已有）
- 添加 2 句并发的请求队列，避免瞬时洪峰

**文件**: `frontend/src/components/TranscriptView.tsx`

### 3.2 翻译失败无重试机制

**问题**: 翻译失败后显示"翻译失败"，用户必须重新切换 translationEnabled 才能重试。没有单个句子的重试按钮。

**方案**: 
- 翻译失败的句子显示 [重试] 按钮（点击对此句重新翻译）
- 自动重试 1 次（遇到 429/5xx 时）

**文件**: `frontend/src/components/TranscriptView.tsx`

### 3.3 歌词显示模式切换无快捷键

**问题**: 用户必须到播放详情页顶部按钮区才能切换「中英/仅英文/仅中文/悬浮」，无法通过键盘快速切换。

**方案**:
- 快捷键 `L` 循环切换歌词显示模式
- 当前模式显示在快捷键面板中

**文件**: `frontend/src/hooks/useKeyboardShortcuts.ts`, `frontend/src/components/TranscriptView.tsx`

### 3.4 悬浮模式下无法选中文本

**问题**: `hover-reveal` 模式下歌词默认 `opacity-0`，用户无法选中/复制歌词文本。

**方案**: 
- 保持 `select-none` 但增加 `group-hover:select-auto`
- 或将歌词用 `pointer-events-none` 控制，hover 时改为 `pointer-events-auto`

**文件**: `frontend/src/components/TranscriptView.tsx`

---

## 四、听写体验

### 4.1 `setTimeout` 链的竞态条件

**问题**: `DictationView.tsx` 第 42-46 行和第 67-69 行使用 `setTimeout` 链实现"seek → 等 150ms → 播放"。当用户在 150ms 窗口内快速操作（点击下一句、退出），会导致 `seek` 和 `togglePlay` 在错误的时间点执行。

**方案**:
- 使用 `audioEngine` 的 `playRange(start, end)` 方法替代手动 setTimeout 链
- 或监听 `seeked` 事件，seek 完成后自动触发播放

**文件**: `frontend/src/views/DictationView.tsx`, `frontend/src/lib/audioEngine.ts`（如需要）

### 4.2 听写记录提交失败无提示

**问题**: 第 61 行 `postDictation(...).catch(() => {})` 静默吞掉错误。提交失败时用户不知道。

**方案**: 提交失败时显示 Toast 提示，不中断听写流程。

**文件**: `frontend/src/views/DictationView.tsx`

### 4.3 CompletionScreen 内容单薄

**问题**: 完成屏只显示分数。没有鼓励文案、没有错误单词汇总、没有"复练错句"按钮。

**方案**: 
- 补全 CompletionScreen 内容：
  - 总正确率 + count-up 动画
  - 错句列表（点击跳转复练）
  - 错误高频词 Top 5
  - "复练错句" 按钮 → 加入播放队列
  - "回到当前句子" 按钮（点错了想继续）

**文件**: `frontend/src/components/dictation/CompletionScreen.tsx`

### 4.4 听写模式没有暂停/跳过当前词

**问题**: 听写时不能暂停正在播放的句子，用户必须等句子播完才能输入。反馈阶段也没有"再听一遍"的快捷操作。

**方案**:
- TypingPhase 添加「停止播放」按钮
- 补充键盘快捷键: Enter = 提交, Ctrl+Enter = 强制下一句

**文件**: `frontend/src/components/dictation/TypingPhase.tsx`

### 4.5 听写句子无进度指示器

**问题**: 用户不知道当前是第几句 / 共几句。SentenseSelector 只显示序号点，没有文字进度。

**方案**: 在听写 Header 添加 `第 {sentenceIndex+1} / {total} 句` 文字。

**文件**: `frontend/src/views/DictationView.tsx`

---

## 五、片段与收藏管理

### 5.1 删除片段无确认弹窗

**问题**: 点击删除按钮立即删除，没有确认弹窗。用户误操作无法恢复。

**方案**: 
- 删除前弹出确认对话框："确定删除此片段？"
- 或使用 undo Toast（6s 内可撤销）
- 推荐后者，体验更好

**文件**: `frontend/src/components/PlaybackDetailTabs.tsx`

### 5.2 片段批量操作缺失

**问题**: 用户不能批量删除、批量导出、批量选择片段。100 个片段要一个个删。

**方案**: 
- 添加"编辑模式"：长按或点击右上角编辑按钮进入多选模式
- 多选后可以批量删除、批量入队
- 此功能优先级为 🟢 P3

**文件**: `frontend/src/components/PlaybackDetailTabs.tsx`

### 5.3 收藏列表无筛选/搜索

**问题**: FavoritesView 以简单列表展示所有收藏项，不能按类型（音频/片段/单词）筛选，不能搜索。

**方案**: 
- 顶部添加类型 tab 筛选：全部/音频/片段/单词
- 搜索框过滤
- P1 优先级

**文件**: `frontend/src/views/FavoritesView.tsx`

### 5.4 收藏一个已收藏项不提示

**问题**: 调用 `favToggle` 会静默取消收藏，没有 Toast 提示。用户可能不知道自己做了切换操作。

**方案**: 
- 收藏时 Toast "已收藏" / 取消收藏时 "已取消收藏"
- 或保留现有行为但增加动画反馈（心形缩放动画）

**文件**: `frontend/src/components/HeartButton.tsx`

---

## 六、队列管理

### 6.1 队列不支持拖拽排序

**问题**: QueuePanel 中的队列项不能拖拽调整顺序。用户必须清空后重新添加。

**方案**: 
- 实现 HTML5 Drag & Drop 拖拽排序
- 拖拽时有视觉反馈（拖拽项半透明、drop target 高亮）
- 此功能 P2 优先级

**文件**: `frontend/src/components/QueuePanel.tsx`, `frontend/src/stores/playlistStore.ts`

### 6.2 播放历史不能独立清空

**问题**: 队列可以清空，但历史不能单独清空。只能等数据自然溢出（max 30）。

**方案**: 历史区域添加「清空」按钮。

**文件**: `frontend/src/components/QueuePanel.tsx`, `frontend/src/stores/playlistStore.ts`

### 6.3 队列项显示时长

**问题**: 队列项只显示标题和副标题，不显示时长。用户不知道每个条目占多久。

**方案**: 在副标题右侧（或下方）显示时长 `fmt(duration)`。

**文件**: `frontend/src/components/QueuePanel.tsx`

### 6.4 入队成功提示不一致

**问题**: 某些入口入队成功显示 Toast（"已加入队列"），某些入口不显示。缺少统一反馈。

**方案**: 
- 统一在 `addToQueue` 函数内包含 Toast
- 去除调用方独立的 addToast 调用（避免重复）

**文件**: `frontend/src/stores/playlistStore.ts`, 各调用处

---

## 七、首页与导航

### 7.1 首页音频列表只显示 8 个

**问题**: HomeView 第 153 行 `fL.slice(0,8)` 只展示前 8 个音频。没有"查看全部"链接。

**方案**: 
- 添加「查看全部 N 个」链接 → 跳转到 CoursesView
- 或显示更多（类似 CoursesView 的 N/30 逻辑）

**文件**: `frontend/src/views/HomeView.tsx`

### 7.2 首页统计卡片无加载骨架

**问题**: OverviewCards 组件有 loading 处理，但 HomeView 上的 5 个统计卡片（音频/片段/句子/单词/总时长）没有加载状态。当接口慢时显示 0。

**方案**: 
- `lessons`, `clips` 等 prop 为 empty 时显示骨架屏
- 使用 `Skeleton.tsx` 组件

**文件**: `frontend/src/views/HomeView.tsx`

### 7.3 侧边栏活跃状态不清晰

**问题**: 侧边栏（Sidebar.tsx）当前路由的高亮不明显，用户不知道自己在哪个页面。

**方案**: 
- 使用 `react-router-dom` 的 `useLocation` 匹配当前路由
- 活跃菜单项增加左侧色条或更强背景色

**文件**: `frontend/src/components/Sidebar.tsx`

---

## 八、设置页

### 8.1 AI 设置「清除」后 UI 不回退

**问题**: 点击「清除」按钮会调用 `removeProvider(selectedId)`，但 UI 状态（apiKey、apiBase、model）不清零。用户看到 API Key 还在输入框中。

**方案**: 清除后重置 ui 状态为 PROVIDER_PRESETS[selectedId] 的默认值。

**文件**: `frontend/src/views/SettingsView.tsx`

### 8.2 AI 测试连接不能先测试后保存

**问题**: 测试连接时会暂存 provider，但状态不是在 provider 对象中测试，而是用当前 UI 输入值测试。且测试通过后用户还必须点保存。体验分裂。

**方案**: 
- 「测试」只测试不保存，测试通过后高亮"保存"按钮
- 或「保存并测试」合并按钮

**文件**: `frontend/src/views/SettingsView.tsx`

### 8.3 默认速度/循环变更应同步到当前播放

**问题**: 设置页修改默认速度/循环次数后，不会同步到当前正在播放的音频。必须重新开始播放才能生效。

**方案**: 
- 设置默认速度时同时更新 audioStore 的 `playbackRate`
- 设置默认循环次数时更新 `loopTarget`（如正在播放片段）

**文件**: `frontend/src/views/SettingsView.tsx`（已做一半，确认完整）

---

## 九、UI/UX 统一

### 9.1 Toast 消息类型不一致

**问题**: 代码中使用的 Toast type 不一致：
- `'success'`（片段保存、入队成功）
- `'info'`（删除片段）
- 部分地方没有 Toast（收藏切换、听写提交失败）

**方案**: 统一 Toast 用法：
- 操作成功 → `success`
- 操作提示 → `info`  
- 操作失败 → `error`
- 危险操作可撤销 → `undo`（6s 带撤销按钮）

**文件**: 全项目检索

### 9.2 确认对话框统一

**问题**: 目前没有任何组件使用确认对话框。删除片段、清空队列、退出听写都是立即执行。

**方案**: 
- 新建 `ConfirmDialog.tsx` 通用组件
- 用于：删除片段、清空队列、退出听写（有未提交内容时）
- 非模态，不影响背景交互

**文件**: `frontend/src/components/ConfirmDialog.tsx`（新增）

### 9.3 空状态统一

**问题**: 各视图的空状态文案和样式不统一。有的显示 icon + 文案，有的只有纯文字。

**方案**: 
- 新建 `EmptyState.tsx` 通用组件：icon + title + description + action button
- 替换各视图的空状态硬编码

**文件**: `frontend/src/components/EmptyState.tsx`（新增）

### 9.4 加载骨架屏覆盖不全

**问题**: 很多视图在数据加载时没有任何加载指示（StatsView 有但 HomeView 没有、PlaybackDetailTabs 的侧边栏没有）。

**方案**: 
- 逐视图检查，确保所有有异步数据请求的地方都有 loading state
- 使用 `Skeleton.tsx` 现有组件

### 9.5 移动端触摸优化

**问题**: v0.1.7+ 的版本中，大量交互（右键菜单、拖拽选词、hover 显示）在触摸设备上不可用。

**方案**: 
- 长按（500ms）触发右键菜单
- 片段选择增加触摸版：点击起始词 + 点击结束词
- 横向滑动切换句子（仅移动端）
- P2 优先级

---

## 十、键盘快捷键系统

### 10.1 快捷键面板可随时唤起

**问题**: 快捷键列表只在设置页中显示。用户想不起来快捷键时需要去设置页查看。

**方案**: 
- `?` 键在任何页面显示/隐藏快捷键面板（modal 形式）
- 面板按分类展示：播放控制、导航、听写、其他

**文件**: `frontend/src/hooks/useKeyboardShortcuts.ts`, 新增快捷键面板组件

### 10.2 快捷键绑定可自定义

**问题**: 用户不能自定义快捷键。Space 和方向键不可更改。

**方案**: 
- 设置页添加快捷键自定义区域
- 存储到 `settingsStore`
- P3 优先级，当前版本仅展示面板即可

### 10.3 补充缺失快捷键

| 快捷键 | 功能 | 状态 |
|--------|------|------|
| `?` | 显示/隐藏快捷键面板 | 新增 |
| `L` | 循环歌词模式 | 新增 |
| `Q` | 切换队列面板 | 新增 |
| `D` | 切换听写模式 | 新增 |
| `Ctrl+Enter` | 听写强制下一句 | 新增 |
| `F` | 搜索（聚焦搜索框） | 新增 |

**文件**: `frontend/src/hooks/useKeyboardShortcuts.ts`

---

## 十一、统计页

### 11.1 统计数字千分位格式化

**问题**: 统计卡片显示大数字时（如 15230 个单词）没有千分位分隔符，阅读困难。

**方案**: `toLocaleString('zh-CN')` 格式化。

**文件**: `frontend/src/components/stats/OverviewCards.tsx`

### 11.2 ActivityTimeline 样式改进

**问题**: ActivityTimeline 目前时间线样式较简陋，事件类型区分度不高。

**方案**: 
- 不同事件类型不同 icon 和颜色（播放、听写、收藏）
- 时间线的小圆点彩色
- 点击事件项跳转到对应音频

**文件**: `frontend/src/components/stats/ActivityTimeline.tsx`

---

## 优先级与预估

| 优先级 | 分类 | 任务数 | 预估时间 |
|--------|------|--------|----------|
| 🔴 P0 | 代码质量修复（1.1-1.3） | 3 | 0.5h |
| 🔴 P0 | 播放体验（2.1-2.4） | 4 | 1.5h |
| 🟡 P1 | 翻译体验（3.1-3.3） | 3 | 1.5h |
| 🟡 P1 | 听写体验（4.1-4.5） | 5 | 2h |
| 🟡 P1 | 片段/收藏（5.1, 5.3, 5.4） | 3 | 1.5h |
| 🟡 P1 | 队列管理（6.2-6.4） | 3 | 1h |
| 🟡 P1 | 快捷键（10.1, 10.3） | 2 | 1h |
| 🟢 P2 | 统计页（11.1-11.2） | 2 | 0.5h |
| 🟢 P2 | UI 统一（9.1-9.4） | 4 | 1.5h |
| 🟢 P2 | 首页/导航（7.1-7.3） | 3 | 1h |
| 🟢 P2 | 设置优化（8.1-8.2） | 2 | 0.5h |
| 🔵 P3 | 片段批量操作（5.2） | 1 | 1h |
| 🔵 P3 | 移动端触摸优化（9.5） | 1 | 1h |
| 🔵 P3 | 队列拖拽排序（6.1） | 1 | 1h |
| 🔵 P3 | 快捷键自定义（10.2） | 1 | 0.5h |
| **合计** | | **37** | **~15h** |

### 建议执行顺序

1. **P0 (0.5h)**: 修复 PlayerBar backdrop-filter, animate-speed-pop, 弹窗重复代码
2. **P0 (1.5h)**: 完善播放体验 — 进度显示、音量控制、错误反馈、快捷键
3. **P1 (2h)**: 听写体验优化 — setTimeout 竞态、错误提示、CompletionScreen、进度指示
4. **P1 (1.5h)**: 翻译体验优化 — 批量限流、重试按钮、快捷键
5. **P1 (1.5h)**: 片段/收藏 — 删除确认、筛选、收藏反馈
6. **P1 (1h)**: 队列 — 历史清空、时长显示、Toast 统一
7. **P1 (1h)**: 快捷键系统 — ? 面板、缺失快捷键绑定
8. **P2 (2.5h)**: UI 统一 — Toast/ConfirmDialog/EmptyState、骨架屏覆盖
9. **P2 (1h)**: 首页/导航 — 加载骨架、侧边栏高亮
10. **P2 (0.5h)**: 设置页修复
11. **P2 (0.5h)**: 统计页数字格式化、时间线
12. **P3 (2.5h)**: 批量操作、触摸优化、拖拽排序、快捷键自定义

---

## 十二、片段 AI 功能跨页面覆盖（新增·用户反馈）

### 背景
当前 AI 片段解析（Sparkles 图标→弹出分析弹窗）和片段编辑（HiPencil→编辑备注/颜色）**只存在于**播放详情页的侧边栏（`PlaybackDetailTabs.tsx`）。其余所有展示片段的地方都没有这些功能。

### 12.1 ClipsView 缺少 AI 解析和编辑

**问题**: `ClipsView.tsx` 中的片段卡片只支持播放、收藏、删除。没有 AI 解析（查看语法/词汇/难度）也没有编辑（备注/颜色修改）。

**方案**: 在 ClipsView 的每个片段卡片右下角添加：
- AI 解析按钮（Sparkles 图标）→ 复用已有 `analyzeClip` 和 `ClipAnalysis` 弹窗
- 编辑按钮（HiPencil）→ 复用 `EditClipModal`（从 1.3 提取的公共组件）

**文件**: `frontend/src/views/ClipsView.tsx`

### 12.2 首页片段列表缺少 AI 解析和编辑

**问题**: `HomeView.tsx` 第 179-200 行的"最近片段"列表只有点击播放功能，没有 AI 解析和编辑。

**方案**: 同 12.1，添加 Sparkles 和 Pencil 按钮。考虑卡片空间有限，可只显示 AI 解析按钮（因为编辑频率较低）。

**文件**: `frontend/src/views/HomeView.tsx`

### 12.3 CollectionDetailView 片段项缺少 AI 解析

**问题**: `CollectionDetailView.tsx` 第 264-296 行的条目列表只有播放、入队、移除。片段类型的条目没有 AI 解析和编辑。

**方案**: 在片段类型条目的操作区域添加 AI 解析按钮。

**文件**: `frontend/src/views/CollectionDetailView.tsx`

### 12.4 技术方案：提取 AI 解析弹窗为公共组件

**问题**: AI 解析弹窗（`viewingAnalysis` → ClipAnalysis popup）目前写在 `PlaybackDetailTabs.tsx` 第 466-541 行，无法被其他页面复用。

**方案**:
- 提取 `ClipAnalysisPopup.tsx` 公共组件（同 `EditClipModal` 一起做）
- `analyzeClip` 的 AI Store 方法已经是全局的，可以直接调用
- 各页面通过 `useAiStore(s => s.analyzeClip)` 获得解析结果，传入 `ClipAnalysisPopup`

**文件**: `frontend/src/components/ClipAnalysisPopup.tsx`（新增）
**文件**: `frontend/src/components/PlaybackDetailTabs.tsx`（移出弹窗代码，引用公共组件）

---

## 十三、合集播放配置（新增·用户反馈）

### 背景
合集（CollectionDetailView）包含音频、片段、句子、单词等各种类型的条目。特别是**智能合集**（如今日练习、高频错词、最近听写错误），条目类型多样，用户需要配置**播什么**和**怎么播**。

现有"播放全部"无差别地遍历全部 `current.items` 入队，用户无法控制播放内容。

用户期望：**按条目类型筛选**、**按片段颜色筛选**（颜色有语义区分）、**控制播放顺序**。

### 13.1 播放配置按钮位置

**问题**: 当前"播放全部"按钮独立一行在 header 下方，占据空间且无法与设置联动。

**方案**: 将"播放全部"按钮移到右上角操作区，**和「刷新/清空」等设置按钮放在一起**。点击后展开播放配置面板，面板中包含「开始播放」按钮。

```
┌─ Header ──────────────────────────────────────┐
│  [icon]  合集名称              [▶ 播放全部]    │
│           智能合集 · 12 个条目  [🔄 刷新]     │
└────────────────────────────────────────────────┘
                          ↑ 播放全部移到右上角，
                            点击展开配置面板
```

**文件**: `frontend/src/views/CollectionDetailView.tsx`

### 13.2 播放配置面板

点击"播放全部"按钮展开下拉配置面板：

```
┌─ 播放配置 ──────────────────────────┐
│                                      │
│  条目类型: [✓ 音频] [✓ 片段] [句子] │
│                      [✓ 单词]       │
│                                      │
│  片段颜色:  [■全部] [■] [■] [■] [■]│
│            [■] [■]                  │
│                                      │
│  播放顺序: [顺序 ▶] [随机]          │
│                                      │
│  [▶ 开始播放 (共 N 项)]             │
└──────────────────────────────────────┘
```

**文件**: `frontend/src/views/CollectionDetailView.tsx`

### 13.3 配置应用逻辑

**方案**:
- **类型过滤**: 面板勾选的条目类型 → `handlePlayAll` 中 `.filter(item => selectedTypes.includes(item.item_type))`
- **颜色过滤（仅片段类型）**: 片段项的 `extra_data` 中解析 color 字段（或从本地 clipsStore 获取），按选中颜色过滤
- **播放顺序**: 顺序保留原数组；随机在过滤结果上 `.sort(() => Math.random() - 0.5)`
- **配置状态**: 存于 `collectionsStore` 中 `playConfig: Record<number, { types: string[], colors: string[], shuffle: boolean }>`，按 `collectionId` 索引（session 级别，刷新重置）

**文件**: `frontend/src/views/CollectionDetailView.tsx`, `frontend/src/stores/collectionsStore.ts`

### 13.4 智能合集优先

**说明**: 此功能**对智能合集和自定义合集同时适用**。智能合集条目类型更丰富（音频+句子+单词），播放配置的价值更大。自定义合集通常条目类型单一，但颜色过滤功能同样有用。

---

## 优先级与预估（终版）

| 优先级 | 分类 | 任务数 | 预估时间 |
|--------|------|--------|----------|
| 🔴 P0 | 代码质量修复（1.1-1.3） | 3 | 0.5h |
| 🔴 P0 | 播放体验（2.1-2.4） | 4 | 1.5h |
| 🟡 P1 | 翻译体验（3.1-3.4） | 4 | 1.5h |
| 🟡 P1 | 听写体验（4.1-4.5） | 5 | 2h |
| 🟡 P1 | 片段/收藏（5.1, 5.3, 5.4） | 3 | 1.5h |
| 🟡 P1 | **片段 AI 跨页面**（12.1-12.4） | **4** | **2h** |
| 🟡 P1 | 队列管理（6.2-6.4） | 3 | 1h |
| 🟡 P1 | 快捷键（10.1, 10.3） | 2 | 1h |
| 🟡 P1 | **合集播放配置**（13.1-13.3） | **3** | **1.5h** |
| 🟢 P2 | 统计页（11.1-11.2） | 2 | 0.5h |
| 🟢 P2 | UI 统一（9.1-9.4） | 4 | 1.5h |
| 🟢 P2 | 首页/导航（7.1-7.3） | 3 | 1h |
| 🟢 P2 | 设置优化（8.1-8.2） | 2 | 0.5h |
| 🔵 P3 | 片段批量操作（5.2） | 1 | 1h |
| 🔵 P3 | 移动端触摸优化（9.5） | 1 | 1h |
| 🔵 P3 | 队列拖拽排序（6.1） | 1 | 1h |
| 🔵 P3 | 快捷键自定义（10.2） | 1 | 0.5h |
| **合计** | | **45** | **~19h** |

### 建议执行顺序

1. **P0 (0.5h)**: 修复 PlayerBar backdrop-filter, animate-speed-pop, 弹窗重复代码
2. **P0 (1.5h)**: 完善播放体验 — 进度显示、音量控制、错误反馈、快捷键
3. **P1 (2h)**: 听写体验优化 — setTimeout 竞态、错误提示、CompletionScreen、进度指示
4. **P1 (1.5h)**: 翻译体验优化 — 批量限流、重试按钮、快捷键
5. **P1 (2h)**: **片段 AI 跨页面** — 提取 ClipAnalysisPopup + EditClipModal，覆盖 ClipsView/HomeView/CollectionDetailView
6. **P1 (1.5h)**: **合集播放配置** — 按类型/颜色过滤播放内容
7. **P1 (1.5h)**: 片段/收藏 — 删除确认（undo Toast）、收藏反馈
8. **P1 (1h)**: 队列 — 历史清空、时长显示、Toast 统一
9. **P1 (1h)**: 快捷键系统 — ? 面板、缺失快捷键绑定
10. **P2 (2.5h)**: UI 统一 — Toast/ConfirmDialog/EmptyState、骨架屏覆盖
11. **P2 (1h)**: 首页/导航 — 加载骨架、侧边栏高亮
12. **P2 (0.5h)**: 设置页修复
13. **P2 (0.5h)**: 统计页数字格式化、时间线
14. **P3 (2.5h)**: 批量操作、触摸优化、拖拽排序、快捷键自定义

---

## 不涉及

- ❌ 新页面/新视图
- ❌ 新 API 端点（合集播放配置用前端过滤即可，无需新增接口）
- ❌ 数据库 schema 变更
- ❌ 性能优化（v0.1.9 已完成）
- ❌ 打包/构建流程
- ❌ 国际化
- ❌ 新 AI 功能
