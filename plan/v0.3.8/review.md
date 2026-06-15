# v0.3.8 Review — 德州听词多项体验优化

> 分支: v0.3.1 → v0.3.8 | 前端 6 文件 + 后端 2 文件 | +371 / -153 行

---

## 一、变更概览

| 维度 | 文件 | 类型 |
|------|------|------|
| 后端 | `routers/poker.py` | refactor — pydantic 模型 + ANTE 常量 |
| 后端 | `services/poker_service.py` | 功能 — 牌组关键词 / fold即时结算 / tie检测 |
| 前端 | `card-preview-modal.tsx` | redesign — 与卡组详情样式对齐 |
| 前端 | `player-seat.tsx` | 功能 — 牌尺寸增大 / 命中间叠层 / revealedIndices |
| 前端 | `poker-lobby.tsx` | redesign — 氛围感牌桌大厅 |
| 前端 | `poker-table-view.tsx` | 功能 — 再来一局 / 单词自动播 / button嵌套修复 |
| 前端 | `api.ts` | 类型 — round_bets / keywords / tie |
| 前端 | `PokerGameView.tsx` | 修复 — key强制重挂 + onRestart |

---

## 二、后端变更

### 2.1 `routers/poker.py` — 类型安全

- **改用 `PokerActionRequest(BaseModel)`** 替代盲 `dict.get()`，Pydantic 自动校验类型，消除 `action` 缺省时的 KeyError 隐患。
- **`ANTE` 常量引用**：`balance >= 10` → `balance >= ANTE`，消除 magic number，未来改底注只需改一处。

### 2.2 `services/poker_service.py` — 三项增值

| 改动 | 说明 |
|------|------|
| **返回值带 `keywords`** | `_card_data` 返回 `keywords: [kw.lower() for kw in c.get("keywords", [])]`，前端无需再根据 card_id 二次查表 |
| **Human fold 即时结算** | 人 folds 后不再让 AI 空玩，直接标记 AI 胜出，更新 DB 状态。此前全 fold 场景走到 `_compute_showdown` 会因 `active` 为空访问 `active[0]` 而抛异常 — 第 84 行的空检查 `if not active: return ...` 已封闭此路径。 |
| **Tie 检测** | `_compute_showdown` 返回 `tie: bool`，前端可据此展示平局态而非第一玩家无条件胜出 |
| **`total_actions`** | 返回已执行操作数，便于前端轮次判断 |

---

## 三、前端变更

### 3.1 `card-preview-modal.tsx` — 全面重写

- **Props 扁平→结构化**：`name, rarity, png, keywords` 收束为 `card` 对象；新增 `matchedWords` + `title`/`motto`。
- **布局重构**：桌面横排 (左图右文)，移动端竖排。`fixed inset-0 z-50` 替代 `absolute inset-0`，确保全屏覆盖。
- **视觉对齐卡组界面**：使用 `glow.border` / `glow.gradient` / `var(--bg-primary)` 等 CSS 变量，与 CardDetailModal 一致。
- **交互细节**：点击蒙层关闭、右上角 `HiXMark` 关闭按钮、`HiSparkles` 收藏标记。

### 3.2 `player-seat.tsx` — 牌面信息增强

- **尺寸放大**：60×84 → `76×106` (mobile) / `110×154` (sm+)，牌面可读性提升。
- **命中间叠层 (matched words overlay)**：牌底渐变半透明背景 + `emerald-300` 热词标签，结算时一目了然。
- **`revealedIndices` 过滤**：未主动翻牌的单词不计入匹配，防止"偷看"。
- **分值颜色统一红色**：此前 `sc >= 4 ? green : sc >= 2 ? yellow : gray`，改为全局 `#ef4444` 红色，更醒目且消除色盲隐患。
- **AI 牌仅在结算时显示分数**：游戏进行中 AI 分数默认隐藏，只展示牌背。

### 3.3 `poker-lobby.tsx` — 沉浸式大厅重设计

最显著的 UI 变更 (398 行重写)：

- **氛围层**：径向渐变装饰点 + z-index 分层，营造桌游感。
- **Hero 区**：集中展示标题 / 文案 / 开始按钮，按钮使用 `var(--accent-gradient)` 渐变色 + 阴影。
- **统计卡片**：余额 / 胜率 / 对局数三列卡片，hover 上浮动画。
- **规则 2×2 网格**：此前为纵向列表，视觉更紧凑。
- **角色卡池 4 列网格**：每张卡片显示缩略图 + 名称 + 稀有度标签（含 `RARITY_STYLES` 发光影子）。
- **对局历史增强**：胜/负圆点自带发光 (0 0 6px)、IP 数值按胜负着色。
- **加载态**：Spinner 外环 `animate-ping` + 进度条使用 `var(--accent-gradient)` + 文字更简洁。

> ⚠️ **问题**：CSS 变量 `var(--accent-gradient)` 需确认是否在所有 theme 中定义；若不存在，出 progress bar 会回退到透明 — 建议 fallback。

### 3.4 `poker-table-view.tsx` — 交互流修复

#### 关键修复

| 问题 | 修复 |
|------|------|
| **"再来一局" 先回大厅** | `onBack()` → `onRestart()` + `PokerGameView` 注入 `store.startGame()` |
| **Button 嵌套 `<button>`** | 播报喇叭 `<button>` → `<span>`，消除 HTML 规范违规 |
| **组件不重置** | `PokerTableView` 加 `key={game.game_id}`，新对局强制 unmount/remount |
| **AI 下注类型** | `(aiPlayer as any)?.round_bets` → `aiPlayer?.round_bets`，类型安全 |

#### 新增功能

- **单词自动播报**：新词揭示时自动 `primeWordAudioContext()` + `playWordOnClick(cw.word)`，无需用户手动点喇叭。
- **卡牌预览传递 matchedWords**：`CardPreviewModal` 新增 `matchedWords` prop，动态计算匹配词列表。
- **`revealedIndices` 下传**：`PlayerSeat` 新增 prop，确保只展示已揭示词的匹配。

### 3.5 `api.ts` — 类型对齐

- `PokerPlayerState.cards[]` 新增 `keywords?: string[]`
- `PokerPlayerState` 新增 `round_bets: number[]`
- `PokerGameState.total_actions` 改为 `?` 可选 (向下兼容)
- `PokerGameState.showdown` 新增 `tie: boolean`
- `showdown.winner_player_id` 改为 `number | null` (处理全 fold 场景)

---

## 四、潜在风险 & 建议

1. **`var(--accent-gradient)` 不可靠**：部分主题/浏览器可能未定义此变量。建议 `poker-lobby.tsx:494` 的 progress bar 添加 CSS fallback，或在 Tailwind config 中显式定义。

2. **Auto-play 音频授权时机**：`poker-table-view.tsx` 中 `primeWordAudioContext()` 的调用时机依赖 `useEffect`，在 iOS Safari 下可能因用户未交互而静默失败 — 建议在首次点击"开始对决"时已初始化 AudioContext，确保揭示时无需重新触发手势授权。

3. **全 fold 边界的 UI 展示**：`showdown.winner_player_id` 为 null 时（所有玩家 fold），结算面 `PlayerSeat` / 横幅如何处理？当前 `isCompleted` 分支直接显示 `🏆 +{potSize} IP`，未区分别人/自己fold导致的胜利。建议加 empty state 或文字说明。

4. **Card pool 极限数量**：`poker-lobby.tsx` 仅展示 12 张卡，`+N` 标签折叠余量。若用户拥有 >12 张但无 UR/SSR 高稀有度卡，折叠策略可能埋没其视觉兴趣 — 建议优先展示高稀有度。

5. **RARITY_STYLES 缺少 fallback**：`poker-lobby.tsx:697-704` 中 `RARITY_STYLES[c.rarity]` 之外的稀有度使用默认 `ring: ''`，幽灵阴影缺失 — 建议最低补一个 N/R 等级的柔和阴影。

6. **重复 playWordOnClick**：poker-table-view 中 auto-play 播放 + 单词卡片上的 `<span onClick={playWordOnClick}>` 会让用户再次点击时重复播放 — 这是预期行为（口语练习场景），但应注意 `playWordOnClick` 本身的节流/防抖，避免快速点击触发多个 AudioContext 实例。

---

## 五、测试建议

| 场景 | 预期 |
|------|------|
| 余额 < 10 IP → 点击开始 | 按钮 disabled，显示"余额不足" |
| 点击"再来一局" | 返回大厅 → 自动重新发牌，组件全量重置 |
| Human fold | AI 即时获胜，不再 AI 自玩一回合 |
| 所有词尚未揭示 → 点击卡牌预览 | matchedWords 为空列表，不展示"命中的公共词"区域 |
| 卡牌 keyword 为空 | `keywords: []`，预览区 keywords 部分不渲染 |
| 胜率 0% (无历史) | 显示 `0%`，不抛除零异常 |
| HTML `<button>` 嵌套检测 | 无 browser console warning 关于 button nesting |
| `--accent-gradient` fallback | 系统主题切换时 progress bar 不破相 |

---

## 六、小结

v0.3.8 是一次 **高质量的体验优化版本**：

- **修复了 4 个用户感知 bug**（button 嵌套、再来一局跳转、组件不重置、fold 异常）
- **2 个后端隐患**（all-fold 异常、硬编码底注）
- **2 个 UI 重设计**（大厅沉浸感 + 卡牌预览对齐卡组），视觉一致性显著提升
- **新增 2 个交互增强**（自动播词、matched words 叠层）

**评分**：代码质量 ✅，类型安全改进 ✅，UI/UX 提升显著 ✅。建议在合并前确认 `--accent-gradient` CSS 变量覆盖 + 全 fold 边界态展示。
