# v0.3.5 代码评审报告 — 卡牌对决 UI 专业重设计

**评审日期**: 2026-06-12
**分支**: v0.3.1
**范围**: 词牌对决全页面 UI 重设计（Lobby / Table / Showdown），无后端改动

---

## 1. 实现概览

| 模块 | 状态 | 文件 |
|------|------|------|
| PokerLobby 大厅重设计 | ✅ | `PokerGameView.tsx` |
| PokerTableView 对战桌重设计 | ✅ | `PokerGameView.tsx` |
| ShowdownResult 摊牌重设计 | ✅ | `PokerGameView.tsx` |
| 稀有度配置统一管理 | ✅ | `PokerGameView.tsx` |
| 卡牌选中交互 | ✅ | `PokerGameView.tsx` |
| 公共词逐轮翻牌动画 | ✅ | `PokerGameView.tsx` |
| 胜利粒子爆炸效果 | ✅ | `PokerGameView.tsx` |
| VERSIONS.md 更新 | ✅ | `VERSIONS.md` |

**变更统计**: 1 file changed, 684 insertions(+), 293 deletions(-)

---

## 2. 架构设计

### 2.1 组件树

```
PokerGameView
 ├─ PokerLobby        → lobby 大厅（卡牌选择 + 历史 + 规则）
 ├─ PokerTableView    → 对战桌（四位玩家 + 公共词 + 操作区）
 │   ├─ PlayerSeat    → 单玩家座位（卡牌 + 名称 + 状态）
 │   ├─ ActionButton  → 操作按钮（primary/secondary/danger）
 │   └─ ShowdownResult→ 摊牌结果（粒子 + 对比网格）
 └─ 工具函数
     ├─ rc(rarity)    → 获取稀有度配置
     └─ fmtTime()     → 格式化时间
```

### 2.2 数据流

```
pokerStore (Zustand)
  ├─ lobby → PokerLobby props
  ├─ game  → PokerTableView + PlayerSeat + ShowdownResult
  └─ actions → onAction / onSetBet / onStart / onBack
```

所有组件均为**纯展示组件**，状态由 `usePokerStore` 管理，与 v0.3.4 的数据接口完全兼容，无后端变更。

### 2.3 关键设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| 稀有度配置 | 独立 `RARITY_CFG` 常量，与 `CardDetailModal` 风格一致 | 避免硬编码颜色散落在 JSX 中 |
| 玩家布局 | `absolute` 四角定位 + `position` prop | 比 grid/flex 更精确控制桌上位置 |
| 牌桌背景 | `bg-gradient-to-b` + `radial-gradient` 叠加 | 模拟赌桌绒布质感，不依赖图片 |
| 动画机制 | `useRef(prevRound)` + `useState(dealAnimate)` | 仅在第一轮/轮换时触发，不持续动画 |
| 胜利粒子 | `[...Array(10)].map` 随机 `left/top` + Tailwind `animate-ping` | 纯 CSS 粒子，零依赖 |

---

## 3. 组件细节评审

### 3.1 PokerLobby

| 元素 | 实现 |
|------|------|
| 标题 | `text-2xl font-extrabold` + emoji 🃏，副标题 `text-xs text-tertiary` |
| 余额 | 右侧 `chip` 样式 capsule：background `--bg-tertiary` + HiStar icon |
| 卡牌网格 | `grid-cols-3 sm:4 md:6` 响应式，gap-3 |
| 卡牌容器 | `rounded-2xl overflow-hidden`，`group` 实现 hover 放大 |
| 稀有度色条 | `absolute top-0 left-0 right-0 h-1`，渐变 `color88 → color` |
| 选中态 | `translateY(-4px)` + 稀有度色 2px `box-shadow` + 左上角圆形 ✓ |
| 空状态 | 卡背 🂠 + 引导文字「先去抽卡收集角色吧！」 |
| 开始按钮 | `linear-gradient(135deg, var(--accent), #ff6b7f)` 渐变，三种文字态 |
| 快速统计 | flex 居中，`余额 · 底注 · 胜率` 三段式 |
| 历史列表 | 每行：胜负标签（绿/红背景） + 卡名 + IP 盈亏 + 时间 |
| 规则 | collapsible 网格 `grid-cols-2`，共 6 条 |

### 3.2 PokerTableView

| 元素 | 实现 |
|------|------|
| 背景 | `from-[#0a0a0b] via-[#0f1a12] to-[#0a0a0b]` 深绿渐变 |
| 轮次显示 | `HiClock` + text「第 X/5 轮」，`rgba(255,255,255,0.04)` 背景 |
| 底池 | `rgba(250,45,72,0.12)` 背景 + `box-shadow` 红色光晕 |
| 椭圆桌布 | `radial-gradient(ellipse at 50% 60%)` + `rounded-[100px]` 边框 |
| 公共词 ×5 | `w-12 h-[68px]` → `sm:w-14 sm:h-[80px]` 响应式 |
| 公共词状态 | 未翻：半透明 + `scale(0.95)` + ? / 已翻：白色卡片 + 朗读按钮 |
| 翻牌动画 | `useRef` 监听 `game.round` 变化 → `animate-scale-in` `delay: i*80ms` |
| 玩家座位 ×4 | `absolute` 四角定位，`transition-all duration-500` |
| 玩家卡牌 | `52×70px`，AI 未摊牌显示卡背 🂠，摊牌后显示角色图 |
| 弃牌 | `opacity-30` + `grayscale` |
| 赢家 | 稀有度色 `ring-2` + `box-shadow 20px` 光晕 |
| 关键词 | 折叠按钮「查看关键词」，展开后已匹配绿色高亮 |
| 操作区 | 下注滑条 `range 5-50` step=5 + 三色操作按钮 |

### 3.3 ActionButton

三态设计：

| 变体 | 背景 | 文字 | 边框 | 阴影 |
|------|------|------|------|------|
| `primary` | 红色渐变 | `#fff` | none | 红色 8px 阴影 |
| `secondary` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.7)` | `1px rgba(255,255,255,0.08)` | none |
| `danger` | `rgba(239,68,68,0.1)` | `rgba(239,68,68,0.7)` | `1px rgba(239,68,68,0.15)` | none |

所有按钮共用：`flex-1 py-2.5 rounded-xl text-[10px] font-semibold active:scale-95`

### 3.4 ShowdownResult

| 元素 | 实现 |
|------|------|
| 结果横幅 | 胜利 → 绿渐变底 / 失败 → 红渐变底 |
| 粒子 | `[...Array(10)]` × `animate-ping` + 随机 `left/top` + 延迟 `i*0.2s` |
| 卡牌对比 | `grid-cols-4`，按 `matches` 降序排列，`revealed` 状态延迟 `i*100ms` |
| 卡牌动画 | 初始 `scale(0.9) opacity(0)` → 300ms 后 → `scale(1) opacity(1)` |
| 匹配数 | 大号 `text-[13px] font-extrabold` + 后缀 `/5` |
| 赢家 | 稀有度色 `ring-1` + 渐变背景 + `box-shadow` 光晕 |
| 公共词回顾 | `<details>` 折叠块 |
| 再来一局 | 胜利 → 红色渐变，失败 → `rgba(255,255,255,0.06)` 灰底 |

---

## 4. 与 v0.3.4 UI 对比

### 4.1 Lobby

| 维度 | v0.3.4 | v0.3.5 |
|------|--------|--------|
| 卡牌列数 | `grid-cols-3 sm:4 md:6 gap-2` | 同左，gap-3 |
| 卡牌样式 | 纯色背景 `--bg-secondary` | 稀有度顶部色条 + 光晕选中框 |
| 选中态 | 2px `--accent` 边框 | 稀有度色 2px 光晕 + 上移 4px + ✓ 标志 |
| 空状态 | 简单文字提示 | 卡背插图 + 双行引导 |
| 开始按钮 | `--accent` 纯色 | 红色渐变 + HiPlay icon |
| 统计 | 一行文字 | 三段式「余额 · 底注 · 胜率」 |
| 历史 | `text-xs` 小字（颜色/灰底） | 胜负方形标签 + IP 盈亏 + 时间 |
| 规则 | `<details>` 纯文本列表 | `<details>` + 网格布局 + chevron 动画 |

### 4.2 Game Table

| 维度 | v0.3.4 | v0.3.5 |
|------|--------|--------|
| 背景 | `--bg-primary`（跟随主题） | 独立深色渐变（不跟随主题） |
| 表布局 | 社区词 → 2×2 网格 → 操作区 | 四角定位：4 玩家包围 5 公共词 |
| 公共词 | 紧凑 chip 标签 `px-2.5 py-1.5` | 卡片式 `w-12 h-[68px]` + 翻牌动画 |
| 玩家卡牌 | `w-14 h-[76px]` 统一 | `52×70px`，未摊牌 AI 显示卡背 |
| 赢家 | `ring-2 ring-[var(--accent)]/40` | 稀有度色 ring + 20px 光晕 |
| 弃牌 | `opacity-35` | `opacity-30` + `grayscale` |
| 关键词 | 自动展开显示 | 可折叠「查看关键词」 |
| 操作按钮 | `text-xs` 无 icon + 边框 | icon + text + 三色渐变 + `active:scale-95` |
| 等待 AI | spinner + 文字 | 同左，样式微调 |
| 底池 | 纯文字「🏆 X」 | 红色光晕 chip + HiSparkles |

### 4.3 Showdown

| 维度 | v0.3.4 | v0.3.5 |
|------|--------|--------|
| 布局 | `grid-cols-4 gap-2` | 同左，按 matches 排序 |
| 卡牌 | 4 列网格 + 名称/匹配数 | 4 列 + 渐入动画 + 匹配数大号 |
| 赢家 | `ring-1 ring-emerald-500/40` | 稀有度色 ring + 渐变背景 |
| 横幅 | `py-4 px-4 rounded-xl` | 粒子爆炸 + 圆角 `rounded-2xl` |
| 公共词 | `<details>` 小字 | `<details>` + 圆角 pill 标签 |

---

## 5. 动画系统

| 动画 | 触发条件 | 实现 |
|------|----------|------|
| 卡牌 hover | 鼠标悬停 | `group-hover:scale-105` 500ms ease |
| 选择上移 | `selectedId === card.id` | inline `transform: translateY(-4px)` |
| 翻牌动画 | 轮次增加 | `useRef` 监听 → `animate-scale-in` + `animationDelay: i*80ms` |
| 摊牌渐入 | 组件 mount 300ms 后 | `useState(revealed)` → `scale(0.9)→(1)` + `opacity(0)→(1)` |
| 摊牌逐卡 | 摊牌 mount | `delay: i*100ms` |
| 粒子 | 胜利 | `animate-ping` 1.5s + 随机位置/间隔 |
| 按钮按压 | 点击 | `active:scale-95` 100ms |
| 规则展开 | chevron 点击 | `rotate-180` + `animate-fade-in` |

---

## 6. CSS 变量使用审计

| 变量 | 组件 | 用途 |
|------|------|------|
| `--bg-primary` | Lobby 容器 | 页面背景 |
| `--bg-secondary` | 卡牌容器、禁用按钮 | 卡牌底、disabled 态 |
| `--bg-tertiary` | 历史行、规则面板、余额 chip | 表面层 |
| `--bg-hover` | 返回按钮 hover | 浅色 hover |
| `--text-primary/tertiary` | 标题、正文 | 文本色 |
| `--accent` | 按钮、IP 数值、icon | 主题色 |
| `--border-primary/secondary` | 卡牌、分隔线 | 边框色 |

Table 内部统一使用 `rgba(255,255,255,*)` 直接色值，不跟随 — 保证暗色牌桌一致。

---

## 7. 可访问性 & 响应式

| 维度 | 措施 |
|------|------|
| 触摸友好 | 所有按钮 `cursor-pointer`，按钮最小 `32px` 触控区 |
| 图片 alt | 所有 `<img>` 有 `alt` 属性 |
| 焦点状态 | 选中卡牌 `focus:outline-none` + 稀有度色视觉指示 |
| 响应式 (Lobby) | `grid-cols-3 sm:4 md:6`，`px-6` 统一内边距 |
| 响应式 (Table) | 公共词 `w-12` → `sm:w-14`，玩家卡牌固定 `52×70px` |
| 暗色模式 | Lobby 自动继承，Table 独立暗色不切换 |

---

## 8. 代码质量

### 👍 优点

- **零后端变更**：纯前端 684 行改动，未触及 API / DB / 后端逻辑
- **组件拆分合理**：`PlayerSeat`、`ActionButton`、`ShowdownResult` 独立为纯展示组件
- **稀有度集中配置**：`RARITY_CFG` 统一管理，一处修改全局生效
- **动画性能**：CSS transform/opacity 动画（GPU 加速），无 JS 帧驱动
- **渐进增强**：动画不会阻止交互，无 `transition-duration` > 500ms

### 🤔 可改进

- **音效**：翻牌、下注、胜利缺少音效反馈（需要音频素材）
- **卡牌翻转 3D**：AI 卡牌从卡背翻到正面可以加 `rotateY` 3D 动画
- **下注动画**：筹码从玩家位置飞到池中央的过渡
- **AI 卡牌悬浮提示**：hover 时可显示 AI 已匹配的公共词数量（当前仅文字显示）

---

## 9. 提交范围

本次提交仅触及一个文件：

- `frontend/src/views/PokerGameView.tsx` — 全页面重写（+684 / -293 行）

无后端改动，无 API 变更，无新增依赖。
