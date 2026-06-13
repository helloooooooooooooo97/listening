# v0.3.6 产品计划 — 桌面端 UI 全面优化

**日期**: 2026-06-12
**状态**: 已完成

---

## 1. 版本定位

### 动机

v0.3.5 完成了「德州听词」牌桌 UI 的专业化重设计，但在代码质量和用户体验细节上仍有明显短板：

- **架构层面**：`PokerGameView.tsx` 膨胀至 **958 行**，6 个子组件揉在一个文件中，难以维护和独立测试
- **代码重复**：稀有度配置在 `PokerGameView` 和 `CardDetailModal` 中定义了两套类似的结构；Spinner 有 **18 处** inline 实现，每处写法略有差异
- **视觉细节**：公共词自动播报无状态指示器、缺少卡牌翻转 3D 动画、无筹码动画反馈
- **响应式缺口**：MobileTabBar 缺少 `words`/`poker`/`game`/`cards` 入口，不同视图断点不一致
- **交互反馈**：翻牌 / 下注 / 胜利各环节缺少音效触点（音频管线已就绪但未连接）

### 设计原则

| 维度 | 方向 |
|------|------|
| 重构优先级 | 先拆文件 → 再提取公共组件 → 最后加动效 |
| 代码整洁 | 消除重复配置，统一常用组件（Spinner、Rarity） |
| 视觉一致性 | 所有视图使用一致的 CSS 变量体系，独立主题区域保持风格统一 |
| 交互深度 | 回合关键动作添加音效连接点 + 3D 卡牌翻转 + 筹码动画 |
| 移动端补齐 | 补全导航入口，统一响应式断点策略 |
| 零功能变更 | 不改后端 API、游戏逻辑、数据流 |

---

## 2. 架构重构 — 拆分 PokerGameView

### 当前问题

```
PokerGameView.tsx (958 行, 42.5 KB)
├── PokerLobby           (225 行)
├── PokerTableView       (295 行)
├── PlayerSeat           (105 行)
├── CardPreviewModal     ( 60 行)
├── ActionButton         ( 55 行)
└── ShowdownResult       (135 行)
```

所有子组件使用 `function` 定义，不导出，无法单独测试或 lazy-load。

### 重构方案

```
frontend/src/
├── components/game/poker/
│   ├── poker-lobby.tsx          ← 从 PokerGameView 迁出
│   ├── poker-table-view.tsx     ← 从 PokerGameView 迁出
│   ├── player-seat.tsx          ← 从 PokerGameView 迁出
│   ├── showdown-result.tsx      ← 从 PokerGameView 迁出
│   ├── card-preview-modal.tsx   ← 从 PokerGameView 迁出
│   ├── action-button.tsx        ← 从 PokerGameView 迁出
│   └── index.ts                 ← 统一导出
├── views/
│   └── PokerGameView.tsx        ← 精简为 ~40 行，仅组合子组件
```

**迁移后**：`PokerGameView.tsx` 从 958 行 → ~40 行，成为纯编排层。

### 重构细节

| 子组件 | 导出类型 | 额外改进 |
|--------|---------|---------|
| PokerLobby | `export default` | 无逻辑改动 |
| PokerTableView | `export default` | 音频播报 `useEffect` 提取为自定义 hook |
| PlayerSeat | `export function` | AI 卡牌背面改用 SVG 替代 emoji 🂠，更精致 |
| CardPreviewModal | `export default` | 关键词匹配高亮内联样式 → 类名提取 |
| ActionButton | `export function` | 提取 variant 样式从 `styles` 对象转为 CSS 类 |
| ShowdownResult | `export default` | 粒子爆炸 `Math.random()` 改为确定性 seed，保动画一致性 |

---

## 3. 公共组件提取

### 3.1 RarityConfig — 统一稀有度配置

**现状**：两套配置并存且字段不同，未来新增稀有度需修改两处。

| 位置 | 字段 |
|------|------|
| `PokerGameView.tsx` | `RARITY_CFG`: `{ label, color, glow, bg, border }` |
| `CardDetailModal.tsx` | `RARITY_GLOW`: `{ border, shadow, accent, gradient }` |

**方案**：新建 `frontend/src/constants/rarity.ts`，合并为完整配置：

```typescript
export const RARITY: Record<string, {
  label: string;
  color: string;         // 主要颜色（文字/指示器）
  glow: string;          // 光晕半透明色
  bg: string;            // 半透明背景
  border: string;        // 边框颜色
  shadow: string;        // box-shadow
  gradient: string;      // 渐变背景 - 用于详情弹窗
}> = { ... };

export function rarity(r: string) { return RARITY[r] || RARITY.R; }
```

重构后：
- `PokerGameView` → 移除 inline `RARITY_CFG` + `rc()`，改用 `import { rarity } from '../../constants/rarity'`
- `CardDetailModal` → 移除 inline `RARITY_GLOW`，改用同名导入

### 3.2 Spinner — 统一加载动画

**现状**：全项目 **18 处** inline spinner 实现，写法不统一：

```tsx
// 写法 A: border-t-[var(--accent)]
<div className="w-5 h-5 border-2 border-white/10 border-t-[var(--accent)] rounded-full animate-spin" />
// 写法 B: border-t-[#fa2d48]
<div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
// 写法 C: border-t-white
<div className="w-4 h-4 border-2 border-white/10 border-t-white rounded-full animate-spin" />
```

**方案**：新建 `frontend/src/components/ui/Spinner.tsx`：

```tsx
interface SpinnerProps {
  size?: number;         // 默认 20
  accent?: string;        // 默认 'var(--accent)'
  className?: string;
}
```

支持 `size` 快速切换，默认跟随主题 accent 色。

**迁移计划**：逐文件替换 18 处 inline 实现（可在多个子任务中并行）。

### 3.3 其他可复用 UI 组件（P2 优先级）

| 组件 | 说明 | 来源 |
|------|------|------|
| `BalanceChip` | IP 余额胶囊显示 | `PokerLobby` / `CurrencyBadge` |
| `RarityBadge` | 稀有度标签 | 多次 inline 实现 |
| `AnimatedNumber` | 数字 count-up 动画 | 底池 / 分数变化 |

---

## 4. 视觉与交互增强

### 4.1 公共词自动播报指示器

**现状**：进入对战桌后新单词自动循环播报 `playWordAudio` + `setTimeout(5000)`，用户无法感知正在播报，也无法暂停。

**方案**：

```
┌──────────────────────────┐
│ 第 3/5 轮    💎 120 IP  │
│                          │
│  ┌────┐ ┌────┐ ┌────┐  │
│  │CAT │ │DOG │ │BALL│  │
│  │ 🔊 │ │    │ │    │  │
│  └────┘ └────┘ └────┘  │
│                          │
│    🔊 自动播报中 · 5s    │
│    [暂停] [跳过]        │
└──────────────────────────┘
```

**改动点**：
- `PokerTableView` 新增循环播放状态管理（`playingIndex`, `isPaused`, `countdownSec`）
- 当前播报词下方显示波形动效 `animate-sound-wave`（CSS keyframes）
- 底部显示倒计时 + [暂停 / 继续] 按钮
- 鼠标悬停 / 点击暂停，5 秒无操作恢复自动播报
- 引入 `usePokerAudio` hook 封装循环逻辑（当前 inline `useEffect` 迁出）

### 4.2 3D 卡牌翻转动画

**现状**：未翻开的公共词显示为半透明灰底 + `?`；AI 卡牌背面显示 `🂠` emoji。翻牌瞬间仅 opacity + scale 变化。

**方案**：

```
未翻开                     翻开
┌─────────┐              ┌─────────┐
│         │   rotateY    │         │
│    ?    │  ────────→   │  CAT    │
│         │  0.6s ease   │  🔊     │
└─────────┘              └─────────┘
```

- 公共词卡牌使用 `perspective(800px)` + `rotateY(0deg → 180deg)` + `backface-visibility`
- 翻转时背面显示 `?` 模糊纹理（CSS 渐变模拟卡背图案），正面显示单词
- 翻牌瞬间播放 `tick` 音效（接入后续音效系统）
- AI 卡牌悬停时显示轻微 3D 倾斜（`rotateX(2deg) rotateY(-2deg)`），跟随鼠标位置

### 4.3 筹码飞入动画

**现状**：下注时金额数字直接变化，底池数字更新无视觉反馈。

**方案**：
- 玩家下注 → 从玩家座位位置生成一个小光点飞向底池区域（`absolute` 动画片 `translate + opacity decaying`）
- 筹码飞行路径为弧形抛物线（`cubic-bezier`），飞行时间 400ms
- 同时底池数字触发 count-up + `scale(1.2)` 脉冲
- 弃牌 → 卡牌收缩后消失（`animate-collapse-out`，已有类）

### 4.4 胜利特效增强

**现状**：胜利时 10 个 `animate-ping` 粒子，略显单薄。

**方案**：
- 粒子数量从 10 增加到 20，使用不同的颜色（金/绿/白）
- 粒子运动使用 `translate` + `opacity`，而非 `animate-ping`（ping 是 scale 脉冲，视觉上所有粒子在同位置膨胀）
- 胜利横幅添加金色渐变边框闪烁（`@keyframes shimmer`）
- 摊牌结果的赢家卡牌添加脉冲光晕（`box-shadow` 动画循环）

### 4.5 视觉一致性修复

| 项目 | 现状 | 修复 |
|------|------|------|
| Lobby 卡牌选中态 | `translateY(-4px)` + 光晕 | 添加微弹性 `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| 对战桌按钮按压态 | `active:scale-95` | 添加 `scale(0.95)` + `filter: brightness(0.9)` |
| Waiting for AI | 纯文字 spinner | 添加「对手正在思考中...」打字机风格文字动画 |
| 摊牌结果渐入 | `scale(0.9 → 1)` + `opacity(0 → 1)` | 添加 `staggerDelay: i × 120ms` 逐卡翻转 |

---

## 5. 移动端补齐

### 5.1 MobileTabBar 导航增强

**现状**：7 个标签（home / courses / clips / favorites / collections / stats / settings），缺少 4 个入口。

**方案**：8 个标签（保持底部紧凑，移除 stats 独立入口，整合到 home）

```
MobileTabBar v2 (9 项 → 8 项, md 隐藏, 增大 touch-target)
┌─────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ 首页 │ 课程 │ 片段 │ 收藏 │ 单词 │ 合集 │ 卡组 │ 德州 │
│ 🏠  │ 🎵  │ 📋  │ ⭐  │ 📖  │ 📦  │ 🃏  │ ♠️  │
└─────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

- 移除独立 `stats` 标签（统计入口放入首页快速操作区）
- 新增 `words`、`cards`、`poker`
- 所有标签增大 `touch-target: min-h-14 min-w-14`
- 活跃标签使用 `text-[var(--accent)]` + 上方 2px 小条指示器（替代当前底部实心背景）

### 5.2 响应式断点统一

**现状**：部分视图使用 `sm:`（640px），部分使用 `md:`（768px），部分使用硬编码像素。

**标准**：

| 断点 | 值 | 用途 |
|------|-----|------|
| `xs` | 480px | 极小屏手机（iPhone SE） |
| `sm` | 640px | 大屏手机 |
| `md` | 768px | 平板竖屏 / 桌面侧栏折叠 |
| `lg` | 1024px | 桌面标准 |

**需修正**：
- `PokerGameView` 中 `sm:grid-cols-4` → `xs:grid-cols-3 sm:grid-cols-4`（手机 3 列更合适）
- `PokerGameView` 中 `sm:w-24 sm:h-[132px]` → 改用 CSS 变量 `--card-width`，响应式调整
- `PokerLobby` 中 `max-w-xs` 说明文字 → `max-w-sm`，在平板上阅读更舒适

### 5.3 桌面窗口最小尺寸调整

**现状**：`tauri.conf.json` 中 `minWidth: 900, minHeight: 600`，但 PokerTableView 在 900×600 下拥挤。

**建议**：`minWidth: 960, minHeight: 660`，给牌桌更多呼吸空间。

---

## 6. 音效系统接入点

### 6.1 音效资源准备

当前项目已有完整音频播放管线（`useWordAudio` + `audioStore`），但缺乏短音效支持。

**方案**：新增 `frontend/src/hooks/useSoundEffect.ts`

```typescript
// 轻量级音效管理器，使用 Web Audio API 生成/播放短音效
function useSoundEffect() {
  const play = (type: 'flip' | 'chip' | 'win' | 'fold' | 'deal') => void;
  return { play };
}
```

音效来源：使用 Web Audio API 合成（无需外部音频文件）：
- `flip`：短白噪声 burst（~80ms），模拟卡牌翻面
- `chip`：高频短「叮」（~120ms），模拟筹码碰撞
- `win`：上升和弦（~400ms），模拟胜利
- `fold`：低频下降音（~200ms），模拟弃牌
- `deal`：展开式音效（~300ms），模拟发牌

Web Audio API 方案无需引入任何外部音频文件，代码量约 80 行。

### 6.2 接入点

| 场景 | 音效 | 触发时机 |
|------|------|---------|
| 翻公共词 | `flip` | `useEffect` 检测 `cw.revealed` 从 false → true |
| 下注/chip | `chip` | `doAction('bet')` 时触发 |
| 弃牌 | `fold` | `doAction('fold')` 时触发 |
| 胜利 | `win` | `game.status === 'completed'` + `isWin` |
| 发牌/游戏开始 | `deal` | `game.round === 1` 且 `game.phase === 'betting'` |

---

## 7. 变更范围总结

### 🔴 P0 — 架构重构

| 任务 | 文件 | 内容 |
|------|------|------|
| 拆分 PokerGameView | 1 拆 7 | 6 个子组件迁至 `components/game/poker/` |
| 统一 RarityConfig | 3 文件 | 新增 `constants/rarity.ts`，修改 2 个消费方 |
| 提取 Spinner 组件 | 18 处替换 | 新增 `components/ui/Spinner.tsx`，全局替换 |

### 🟡 P1 — 视觉与交互

| 任务 | 影响范围 | 内容 |
|------|---------|------|
| 公共词播报指示器 | PokerTableView | 倒计时、暂停/继续、波形动效 |
| 3D 卡牌翻转 | PokerTableView | `perspective` + `rotateY` CSS 翻转 |
| 筹码飞入动画 | PokerTableView | 抛物线筹码 + 底池脉冲 |
| 胜利特效增强 | ShowdownResult | 20 粒子、shimmer 边框、脉冲光晕 |
| 音效系统 | 全局 | `useSoundEffect` hook + 5 个接入点 |

### 🟢 P2 — 移动端 & 代码整洁

| 任务 | 影响范围 | 内容 |
|------|---------|------|
| MobileTabBar 扩展 | 1 文件 | 新增 3 标签，移除 1 标签 |
| 响应式断点统一 | 2-3 视图 | 修正不一致断点 |
| 窗口最小尺寸调整 | `tauri.conf.json` | 960×660 |
| ActionButton CSS 化 | 1 文件 | inline styles → 类名 |

---

## 8. 不变范围

以下内容在 v0.3.6 中**不做改动**：

| 模块 | 原因 |
|------|------|
| 后端 API / 数据库 | 纯前端版本 |
| 游戏逻辑 / AI 决策 | 玩法不变 |
| 数据流 / pokerStore | 接口不变，仅消费方改名 |
| 主题系统 CSS 变量 | 不新增变量，仅消费已存在的 |
| 视图路由 / ContentPanel | Sidebar / MobileTabBar 路由映射不变 |
| 音频播放管线 | `useWordAudio` / `audioStore` 不变 |

---

## 9. 工作量估算

| 优先级 | 任务 | 预估文件数 | 预估行变动 |
|--------|------|-----------|-----------|
| 🔴 P0 | 拆分 PokerGameView | 7 个新文件 + 2 个修改 | ~+400 / -900 |
| 🔴 P0 | 统一 RarityConfig | 1 新 + 2 改 | ~+60 / -90 |
| 🔴 P0 | 提取 Spinner | 1 新 + 18 改 | ~+30 / -90 |
| 🟡 P1 | 公共词播报指示器 | 1 改 | ~+80 / -20 |
| 🟡 P1 | 3D 卡牌翻转 | 2 改 (CSS + TSX) | ~+60 / -10 |
| 🟡 P1 | 筹码飞入动画 | 1 改 | ~+50 / -0 |
| 🟡 P1 | 胜利特效增强 | 1 改 | ~+30 / -10 |
| 🟡 P1 | 音效系统 | 1 新 + 1 改 | ~+120 / -0 |
| 🟢 P2 | MobileTabBar 扩展 | 1 改 | ~+20 / -10 |
| 🟢 P2 | 响应式断点统一 | 2-3 改 | ~+15 / -10 |
| 🟢 P2 | 窗口最小尺寸 | `tauri.conf.json` | ~+1 / -1 |

**预估总计**：~+866 行 / ~-1136 行，净减 ~270 行。

---

## 10. 验收标准

1. ✅ `PokerGameView.tsx` 缩减至 50 行以下
2. ✅ 所有引入 `constants/rarity.ts` 的消费者使用同一数据源
3. ✅ 18 处 inline spinner 统一为 `<Spinner size={...} />`
4. ✅ 公共词自动播报有可视化的状态指示器和暂停控制
5. ✅ 公共词翻牌使用 `rotateY` CSS 3D 翻转动画
6. ✅ 下注时有筹码飞入底池的视觉反馈
7. ✅ 胜利时粒子动画覆盖整个横幅区域而非局部
8. ✅ 5 个游戏事件触发对应音效（Web Audio API 合成）
9. ✅ MobileTabBar 包含 `words` / `cards` / `poker` 入口
10. ✅ 响应式断点在 PokerGameView 中一致使用
11. ✅ 桌面窗口最小尺寸调整为 960×660
12. ✅ 无后端代码改动，API 调用零变更
