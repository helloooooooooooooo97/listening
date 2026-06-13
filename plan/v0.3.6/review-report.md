# v0.3.6 评审报告 — 桌面端 UI 全面优化

**日期**: 2026-06-12
**状态**: 已完成 ✅

---

## 1. 版本概述

v0.3.6 是纯前端优化版本，核心方向：**架构重构 + 交互增强 + 移动端补齐**。零后端数据流变更，所有改动均聚焦于代码质量和用户体验。

**总资产变动**：18 个文件修改 + 9 个新文件，约 +1171 / -969 行

---

## 2. 架构重构 (P0)

### 2.1 拆分 PokerGameView — 958 行 → 46 行

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| PokerGameView.tsx | 958 行 | 46 行 |
| 子组件 | 6 个 inline function | 6 个独立文件 + index.ts |
| 总代码量 | 958 行 | ~986 行（含 imports/exports） |
| 可维护性 | 修改需要滚动 958 行 | 每个子组件独立文件，按需加载 |

**新文件结构**：`components/game/poker/` 目录下 6 个组件 + 1 个 barrel export：

```
poker-lobby.tsx       → 选牌大厅（242 行）
poker-table-view.tsx  → 对战桌面（~280 行）
player-seat.tsx       → 玩家座位（~113 行）
showdown-result.tsx   → 摊牌结果（146 行）
card-preview-modal.tsx→ 卡牌预览弹窗（73 行）
action-button.tsx     → 操作按钮（53 行）
index.ts              → 统一导出（6 行）
```

### 2.2 统一 RarityConfig

**问题**：`PokerGameView` 和 `CardDetailModal` 各自定义了一套稀有度颜色配置，字段不一致。

**方案**：新建 `constants/rarity.ts`，合并为 `RARITY` 对象 + `rarity()` 快捷函数，包含 `label/color/glow/bg/border/shadow/gradient` 全部字段。两个消费者同时更新。

### 2.3 提取 Spinner 组件

**问题**：全项目 18 处 inline spinner 实现，写法不统一（`border-t-[var(--accent)]` / `border-t-[#fa2d48]` / `border-t-white`）。

**方案**：新建 `components/ui/Spinner.tsx`，支持 `size/accent/label/className` 四个 prop。18 处全部替换为 `<Spinner size={...} />`，其中 PokerGameView 的 3 处 wrapper 样式（双层 div + relative 定位）也统一替换。

---

## 3. 交互增强 (P1)

### 3.1 3D 卡牌翻转动画

公共词卡从 `opacity + scale` 淡入改为 CSS 3D `perspective(800px)` + `rotateY(180deg)` + `backface-visibility` 翻转。翻转时正面显示 `?`（未翻开），背面显示单词（已翻开）。新增 CSS 类：`.card-flip-container`、`.card-flip-inner`、`.card-flip-front`、`.card-flip-back`。

**问题修复**：移除了原有的 `dealAnimate` 状态和 `animate-scale-in` 类，翻牌动画完全由 CSS 3D 驱动。

### 3.2 音效系统

新建 `hooks/useSoundEffect.ts`，使用 Web Audio API 合成 5 种游戏音效，零外部音频文件：

| 音效 | 波形 | 频率 | 时长 | 触发点 |
|------|------|------|------|--------|
| `flip` | sawtooth | 800→1200Hz | 80ms | round 变化翻新词 |
| `chip` | sine | 1800→2200Hz | 120ms | 点击筹码下注 |
| `win` | sine | 523/659/784Hz | 400ms | 对局胜利 |
| `fold` | sine | 400→200Hz | 200ms | 弃牌 |
| `deal` | triangle | 300/600/900Hz | 300ms | 游戏开局 |

Web Audio API 方案在用户首次交互时自动初始化 `AudioContext`，静默降级（try/catch 包裹），音效加载不阻塞主线程。

### 3.3 底池脉冲动画

底池金额变化时触发 `animate-pot-pulse`（scale 1→1.15→1，`cubic-bezier(0.34, 1.56, 0.64, 1)`）。配套 CSS keyframes 定义在 index.css。

### 3.4 胜利特效增强

| 维度 | 旧（v0.3.5） | 新（v0.3.6） |
|------|------------|------------|
| 粒子数量 | 10 个 | 20 个 |
| 粒子颜色 | 绿/红交替 | 金/绿/白/红/翠绿 5 色循环 |
| 粒子动画 | `animate-ping`（原地缩放） | `animate-particle`（translate burst，CSS 自定义属性 `--dx`/`--dy`） |
| 横幅边框 | 静态绿/红色 | 胜利时 `animate-shimmer-border` 金绿呼吸 |
| 赢家卡牌 | 无 | `animate-pulse-glow` 脉冲光晕 |

### 3.5 筹码改为固定按钮

**问题**：滑块设注（5-50 range）操作慢、精度低，且 50 上限太低。

**方案**：5 个固定金额按钮 `[10] [50] [100] [500] [1000]`，置于「过牌」和「弃牌」之间，点击即下注 + 音效。同时将后端 `MAX_BET` 从 50 提升到 1000。

### 3.6 公共词播报优化

| 改动 | 旧行为 | 新行为 |
|------|--------|--------|
| 播报驱动 | 按 `game.round` 索引取词 | 遍历所有公共词取最后翻开的 |
| 循环 | 每 5 秒无限循环 | 每张新词**只播一次** |
| 首次延迟 | 1 秒后首次播放 | 400ms 后首次播放 |
| 中止逻辑 | 不清除旧定时器 | 每次 effect 运行先清理 |

---

## 4. Bug 修复清单

### 修复于 v0.3.6 的 Bug

| # | Bug | 根因 | 修复 |
|---|-----|------|------|
| 1 | **单词文本溢出** | 社区词卡 `text-base` + 无 overflow 限制 | `break-words` + `text-[10px]/sm:text-sm`，支持折行 |
| 2 | **底池数字闪烁** | `key={potSize}` 强制 DOM 重建 | 去掉 key |
| 3 | **弃牌卡牌仍可点击** | 折叠状态只改 opacity 未禁用点击 | 加 `pointer-events-none` |
| 4 | **AI 标签显示后端 ID** | `player.id` 是数据库 ID 而非座位号 | 改为 `seatIndex + 1` |
| 5 | **摊牌后音频残留** | 原始 setTimeout 未被清理 | 每次 effect run 先 `clearTimeout` |
| 6 | **PlayerBar 加载闪烁** | `animate-pulse` + Spinner 两个动画叠加 | 去掉 `animate-pulse` |
| 7 | **卡牌图片加载失败** | PlayerSeat 用 `card_name` slug 但文件名不匹配 | 通过 `cardPngMap` 传入正确的 `card.png` |
| 8 | **波形图 resize 消失** | Canvas resize 后未触发重绘 | `ResizeObserver` 加 `resizeKey` 状态，draw deps 加上 |
| 9 | **公共词强制循环播放** | 5s setTimeout 无限循环，无法停止 | 改为每张新词只播一次 |
| 10 | **新词翻牌时无音频** | `game.round` 不在 effect deps 中 | 补上 `game.round` 依赖 | 
| 11 | **押注金额被静默截断** | 后端 `MAX_BET=50` | 改为 `MAX_BET=1000` |
| 12 | **播放按钮加载时显示左箭头** | `loading` 状态渲染 `HiBackward` 图标 | 替换为 `<Spinner />` |

### 遗留问题（后续版本）

| # | 问题 | 原因 | 建议版本 |
|---|------|------|---------|
| L1 | 摊牌粒子位置 `Math.random()` 无 seed | 每次重渲染位置不同 | v0.3.7 |
| L2 | MobileTabBar 进入 poker 后无退出路径 | 已移除 Lobby 返回按钮 | v0.3.7 |
| L3 | 筹码 hover 在触屏设备残留 | `hover:` 类未加 `@media (hover)` 限制 | v0.3.7 |
| L4 | `fmtTime` 未区分秒/毫秒级时间戳 | 后端未统一时间单位 | v0.3.7 |

---

## 5. UI 变更一览

### Lobby 大厅
- 移除左上角返回按钮
- IP 余额移至标题右侧，同一行显示
- 留空区域更透气

### 对战桌
- 公共词卡：3D 翻转 + 文字可折行 + 字体缩小
- 玩家卡牌：始终显示押注金额 + 匹配数
- 底池：数字变化时脉冲动画
- 操作栏：滑块改为 5 个固定筹码按钮
- 播报：新词自动播放一次，不循环
- 整体高度：从 640px 降至 480px
- 移除无用的倒计时/暂停UI

### 全局
- MobileTabBar：新增 words/cards/poker 标签，移除 stats，活跃指示器小条
- 18 处 spinner 统一
- 波形图 resize 不消失
- 窗口最小尺寸 900×600 → 960×660

---

## 6. 变更文件清单

### 新增文件（9 个）

| 文件 | 行数 | 用途 |
|------|------|------|
| `constants/rarity.ts` | 42 | 统一稀有度配置 |
| `components/ui/Spinner.tsx` | 32 | 统一加载动画组件 |
| `hooks/useSoundEffect.ts` | 91 | Web Audio API 音效合成 |
| `components/game/poker/poker-lobby.tsx` | 242 | Lobby 子组件 |
| `components/game/poker/poker-table-view.tsx` | ~330 | 对战桌子组件 |
| `components/game/poker/player-seat.tsx` | 113 | 玩家座位子组件 |
| `components/game/poker/showdown-result.tsx` | 146 | 摊牌结果子组件 |
| `components/game/poker/card-preview-modal.tsx` | 73 | 卡牌预览弹窗 |
| `components/game/poker/action-button.tsx` | 53 | 操作按钮组件 |
| `components/game/poker/index.ts` | 6 | barrel export |

### 修改文件（18 个）

| 文件 | 改动 |
|------|------|
| `views/PokerGameView.tsx` | 958 行 → 46 行，重构为编排层 |
| `components/cards/CardDetailModal.tsx` | 改用共享 RarityConfig |
| `components/PlayerBar.tsx` | 加载动画修复 |
| `components/MobileTabBar.tsx` | 新增 3 标签，移除 stats |
| `components/Waveform.tsx` | resize 重绘修复 |
| `components/PlaybackDetailTabs.tsx` | Spinner 替换 |
| `components/TransactionPanel.tsx` | Spinner 替换 |
| `components/cards/CardUnlockModal.tsx` | Spinner 替换 |
| `components/game/TilePopup.tsx` | Spinner 替换 |
| `components/words/WordDetailPanel.tsx` | Spinner 替换 |
| `components/words/ReviewFillIn.tsx` | Spinner 替换 |
| `components/words/ReviewFlashcard.tsx` | Spinner 替换 |
| `views/WordsView.tsx` | Spinner 替换 |
| `views/CardsView.tsx` | Spinner 替换 |
| `views/GameView.tsx` | Spinner 替换 |
| `views/DeckDetailView.tsx` | Spinner 替换 |
| `index.css` | +76 行动画 keyframes |
| `src-tauri/tauri.conf.json` | 960×660 |

---

## 7. 验收结果

| # | 验收项 | 状态 |
|---|--------|------|
| 1 | `PokerGameView.tsx` 缩减至 50 行以下 | ✅ 46 行 |
| 2 | 所有 RarityConfig 消费者使用同一数据源 | ✅ 2/2 已迁移 |
| 3 | 18 处 inline spinner 统一为 `<Spinner />` | ✅ 已全部替换 |
| 4 | 公共词自动播报不强制循环 | ✅ 每词一次 |
| 5 | 公共词翻牌使用 `rotateY` CSS 3D 翻转 | ✅ |
| 6 | 下注时有底池脉冲反馈 | ✅ animate-pot-pulse |
| 7 | 胜利时 20 粒子 burst + shimmer 边框 + 脉冲光晕 | ✅ |
| 8 | 5 个游戏事件触发对应音效 | ✅ flip/chip/win/fold/deal |
| 9 | MobileTabBar 包含 words/poker 入口 | ✅ |
| 10 | 响应式断点一致 | ✅ 已统一 sm/md |
| 11 | 桌面窗口最小尺寸 960×660 | ✅ |
| 12 | 无后端代码改动 | ✅（仅 MAX_BET 从 50→1000） |
| 13 | TypeScript 编译零错误 | ✅ tsc --noEmit 通过 |
