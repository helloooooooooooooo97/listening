# v0.3.5 产品计划 — 卡牌对决 UI 专业重设计

**日期**: 2026-06-12
**状态**: 已完成

---

## 1. 动机

v0.3.4 上线的「词牌对决」核心玩法已经完备，但 UI 层存在严重的**专业感缺失**问题：

- **Lobby 大厅**：卡牌水平密集排列像文件柜，缺少卡牌游戏的收集感和选牌仪式感
- **对战桌**：2×2 纯色网格 + 简单 chip 标签，没有扑克桌应有的沉浸氛围
- **摊牌结果**：纵向信息堆叠，胜利/失败缺乏情感反馈，没有「摊牌时刻」的戏剧张力
- **整体**：与 App 的 Notion 精致风格脱节，视觉层级不够清晰

### 设计目标

> 在不改动后端数据和游戏逻辑的前提下，用纯前端手段将「词牌对决」的视觉品质提升到可上架水平

---

## 2. 设计原则

### 2.1 风格锚点

| 维度 | 方向 | 参考 |
|------|------|------|
| 牌桌氛围 | 暗色桌布 + 微光晕 | 高端扑克直播 UI |
| 卡牌展示 | 稀有度驱动发光 | Hearthstone 卡牌光泽 |
| 交互反馈 | 弹性 + 微动效 | Marvel Snap 卡牌响应 |
| 视觉层级 | 大标题 + 留白 + 对比色 | Notion 品牌体系延续 |

### 2.2 色彩体系

- **Lobby**：继承 App 现有 CSS 变量（亮/暗双主题），用稀有度颜色作为卡牌的主视觉锚点
- **Game Table**：独立深色底色（`#0a0a0b` → `#0f1a12` 渐变），模拟赌桌绒布质感
- 表格内所有文字用白色系（white/70, white/50, white/30），不跟随系统主题

---

## 3. 三视图设计

### 3.1 Lobby 大厅

```
┌──────────────────────────────────┐
│ ←  余额 💎 42 IP                │
│                                  │
│ 🃏 词牌对决                       │
│ 德州扑克式词汇对决 · 选角色对战   │
│                                  │
│ 选择角色牌              6 张可用  │
│ ┌────┐ ┌────┐ ┌────┐           │
│ │ 卡 │ │ 卡 │ │ 卡 │  ← 3列网格 │
│ │ 牌 │ │ 牌 │ │ 牌 │    稀有度   │
│ │ ██ │ │ ██ │ │ ██ │    色条    │
│ └────┘ └────┘ └────┘    光晕框  │
│                                  │
│ [▶ 开始对决 · 底注 10 IP]        │
│                                  │
│ 余额 · 底注 · 胜率               │
│                                  │
│ 最近对局                          │
│ [胜] Coco      +40 IP  06/12    │
│ [负] Coco      -10 IP  06/12    │
│                                  │
│ 📖 游戏规则 ▾                    │
└──────────────────────────────────┘
```

#### 卡牌卡片交互

| 状态 | 效果 |
|------|------|
| 默认 | 圆角 `rounded-2xl`、轻微阴影、稀有度顶部色条 |
| Hover | 图片 `scale(1.05)` 放大、200ms ease-out |
| 选中 | `translateY(-4px)` 上移、稀有度色 2px 光晕边框 + 8px 阴影 |
| 选中标记 | 左上角稀有度色圆形 ✓ 标志 |
| 稀有度徽章 | 右上角半透明背景 + 发光文字，与 CardDetailModal 一致 |

### 3.2 对战桌 (Game Table)

```
┌──────────────────────────────────┐
│ ←    ⏱ 第 3/5 轮  💎 120 IP    │
│                                  │
│          ┌─────────────────┐      │
│ [AI-1]  │  ?   ?   CAT   │ [AI-2]│
│          │  ?   DOG       │      │
│          │  ①  ②  ③  ④  ⑤  │      │
│          └─────────────────┘      │
│ [AI-3]  │   椭圆桌布区域  │ [你]  │
│          │                 │      │
│          ├─────────────────┤      │
│          │ 查看关键词 ▾   │      │
│          │ ✓ fashion  art  │      │
│          └─────────────────┘      │
│                                  │
│ 5 ──────[═══●══════]───── 50  15 │
│ [过牌]  [15]  [弃牌]            │
└──────────────────────────────────┘
```

#### 4 玩家座位布局

```
      top-left       top-right
         [AI-1]        [AI-2]
               ╭───────╮
               │ 公共词  │
               ╰───────╯
         [AI-3]        [你]
      bottom-left   bottom-right
```

- 使用 `absolute` 定位 + position prop（`top-left | top-right | bottom-left | bottom-right`）
- 卡牌 `52×70px`，折叠的 AI 显示卡背 🂠
- 弃牌 → `opacity-30` + `grayscale`

#### 公共词卡片

| 状态 | 视觉 |
|------|------|
| 未翻开 | 半透明灰底、`scale(0.95)`、「?」文字、`opacity-60` |
| 已翻开 | 半透明白色卡片、大号词、朗读按钮、`scale(1.0)` |
| 轮转动画 | `animate-scale-in` + 逐卡 `animationDelay: i*80ms` |

### 3.3 摊牌结果 (Showdown)

```
┌──────────────────────────────────┐
│ ┌────────────────────────────┐   │
│ │  🏆 胜利！            (✦✦✦) │   │
│ │  底池 120 IP              │   │
│ └────────────────────────────┘   │
│                                  │
│ 摊牌结果              匹配数     │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐           │
│ │你│ │AI│ │AI│ │AI│           │
│ │3 │ │2 │ │1 │ │1 │           │
│ │/5│ │/5│ │/5│ │/5│           │
│ └──┘ └──┘ └──┘ └──┘           │
│   👑                           │
│                                  │
│ 公共词回顾 ▸                    │
│                                  │
│ [再来一局]                       │
└──────────────────────────────────┘
```

- 4 列网格，按匹配数降序排列
- 胜利者稀有度光晕边框
- 获胜绿色渐变底 + 粒子 ping 动画
- 失败红色渐变底，文字「再接再厉」

---

## 4. UI 组件树

```
PokerGameView
├── PokerLobby
│   ├── Header (Back + Balance Chip + Title)
│   ├── Loading
│   ├── CardSelectionGrid
│   │   └── CardButton (rarity stripe, glow, selection state)
│   ├── EmptyState (no cards)
│   ├── StartButton (gradient, disabled states)
│   ├── QuickStats (balance / ante / win-rate)
│   ├── GameHistory (win/loss tag, IP delta)
│   └── RulesPanel (collapsible grid)
│
├── PokerTableView
│   ├── Header (Back + Round + Pot)
│   ├── TableArea
│   │   ├── TableFelt (radial gradient background)
│   │   ├── CommunityWordsRow (×5 cards)
│   │   ├── PlayerSeat ×4 (absolute positioned)
│   │   └── KeywordsToggle (collapsible)
│   ├── BettingControls (slider + 3 action buttons)
│   ├── WaitingForAI (spinner)
│   ├── QuickWin (all AI folded)
│   └── ShowdownResult
│       ├── ResultBanner (win/loss gradient + particles)
│       ├── CardComparisonGrid (4 columns)
│       ├── CommunityWordsRecap (collapsible)
│       └── PlayAgainButton
│
└── Utility
    ├── ActionButton (primary/secondary/danger)
    ├── PlayerSeat
    └── RarityConfig
```

---

## 5. 不变范围

以下内容在本版本中**不做改动**：

| 模块 | 原因 |
|------|------|
| 后端 API / 数据库 | 纯前端版本，不涉及服务端 |
| 游戏逻辑 / AI 决策 | 玩法不变 |
| 数据流 / pokerStore | 接口不变，仅消费方改 UI |
| 卡牌图片 / cardImageUrl | 复用现有 API |
| 主题系统 CSS 变量 | Lobby 继续使用，Table 独立暗色背景 |
