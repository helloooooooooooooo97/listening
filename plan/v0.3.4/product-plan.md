# v0.3.4 产品计划 — 词牌对决 (Vocabulary Hold'em)

**日期**: 2026-06-12
**状态**: 规划中

---

## 1. 动机

现有抽卡系统积累了卡牌收藏和灵感值，但缺少一个 **可重复玩的策略玩法** 来消耗灵感值并强化英语学习。德州扑克式的押注机制天然适合：

- **策略决策** → 根据己方牌力和对手行为决策，训练英语思维
- **词汇曝光** → 每轮翻开的单词卡反复强化记忆
- **代币消耗** → 灵感值有了新的有意义的出口
- **收藏价值** → 卡牌稀有度影响牌力，让收藏更有意义

---

## 2. 核心玩法

### 2.1 一句话概括

> 每人一张角色牌（卡库），场上有五张单词牌逐轮翻开，押灵感值竞牌，匹配词多者赢全池。

### 2.2 游戏流程

```
┌─────────────────────────────────────────────────┐
│  底池                                           │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │  ??  │ │  ??  │ │  ??  │ │  ??  │ │  ??  │     │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘     │
│  Round 1   Round 2   Round 3   Round 4   Round 5 │
│  (已翻)    (已翻)    (已翻)    (刚翻)    (未翻)  │
├─────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │
│  │ 你的牌  │  │ AI-1   │  │ AI-2   │  │ AI-3   │ │
│  │ Coco   │  │ (扣牌)  │  │ (扣牌)  │  │ (扣牌)  │ │
│  │ Chanel │  │        │  │        │  │        │ │
│  └────────┘  └────────┘  └────────┘  └────────┘ │
└─────────────────────────────────────────────────┘
```

#### 第 0 步：准备
- 你的卡库中必须有 ≥ 3 张已收藏的卡牌
- 选择参与本局的角色牌（从你已收藏的卡中选 1 张）
- 自动匹配 3 名 AI 对手，各随机分配 1 张角色牌（隐藏）
- 每人自动下底注：**10 IP**
- 初始底池 = 4 × 10 = **40 IP**

#### 第 1-5 步：逐轮翻牌
每一轮：
1. **翻牌** → 翻开 1 张单词牌（第 1 轮翻第 1 张，第 2 轮翻第 2 张…）
2. **展示** → 显示单词本身 + 中文释义 + 读音按钮
3. **押注** → 你选择：
   - **过牌**（Check）— 不下注，但保留赢牌资格
   - **下注**（Bet 5-50 IP）— 投入灵感值到池中
   - **弃牌**（Fold）— 放弃本局，已下注的 IP 不退回
4. **AI 决策** → 3 名 AI 依次决策（Check / Call / Raise / Fold）
5. **刷新状态** → 底池金额、各人已下注总额

#### 第 5 轮后：摊牌 (Showdown)
- 翻开所有未翻的单词牌
- 计算**匹配度**（见下文）
- 匹配度最高者赢得底池全部 IP
- 平局 → 稀有度裁决（UR > SSR > SR > R）→ 仍平则平分底池

---

## 3. 牌力系统

### 3.1 匹配规则

你的角色牌的 **keywords**（5 个关键词）就是你的"手牌"。
每张单词牌翻开后，如果它**出现在你的角色牌 keywords 列表里**，计为 **1 匹配**。

| 角色 | keywords | 翻开的单词 | 匹配？ |
|------|----------|-----------|--------|
| Coco Chanel | fashion, elegance, luxury, freedom, style | **fashion** | ✅ 匹配 |
| Coco Chanel | fashion, elegance, luxury, freedom, style | **cubism** | ❌ 不匹配 |
| Andy Warhol | pop, media, culture, fame, creativity | **culture** | ✅ 匹配 |

### 3.2 牌力计算

```
最终匹配数 = 匹配的单词牌数量（0-5）

胜者 = max(匹配数)
平局 = 稀有度比拼: UR(4) > SSR(3) > SR(2) > R(1)
再平局 = 平分底池
```

### 3.3 信息透明度

| 信息 | 你看到 | AI 看到 |
|------|--------|---------|
| 你的角色牌（keywords） | ✅ 自己底牌 | ❌ 隐藏 |
| 你的 IP 余额 | ✅ 自己余额 | ❌ 隐藏 |
| AI 的角色牌 | ❌ 隐藏 | ✅ 自己底牌 |
| 已翻开的单词牌 | ✅ 所有人可见 | ✅ 所有人可见 |
| 底池金额 | ✅ 所有人可见 | ✅ 所有人可见 |
| 各人已下注 IP | ✅ 所有人可见 | ✅ 所有人可见 |
| 各人是否弃牌 | ✅ 可见 | ✅ 可见 |

---

## 4. 数据库变更

### 4.1 新表: poker_games

```sql
CREATE TABLE IF NOT EXISTS poker_games (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    status          TEXT NOT NULL DEFAULT 'waiting',  -- waiting | active | showdown | completed
    pot             INTEGER NOT NULL DEFAULT 0,
    round           INTEGER NOT NULL DEFAULT 0,       -- 0-5 (0=preflop, 1-4=mid, 5=final+showdown)
    community_words TEXT NOT NULL DEFAULT '[]',        -- JSON: 5 words
    revealed_mask   INTEGER NOT NULL DEFAULT 0,        -- bit 0-4: 1 = revealed
    winner_player_id INTEGER DEFAULT NULL,
    winner_match_count INTEGER DEFAULT 0,
    created_at      INTEGER DEFAULT (unixepoch()),
    completed_at    INTEGER DEFAULT NULL
);
```

### 4.2 新表: poker_players

```sql
CREATE TABLE IF NOT EXISTS poker_players (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id         INTEGER NOT NULL REFERENCES poker_games(id) ON DELETE CASCADE,
    player_type     TEXT NOT NULL DEFAULT 'human',     -- human | ai
    card_id         TEXT NOT NULL,                     -- card_collection.card_id
    balance_before  INTEGER NOT NULL DEFAULT 0,        -- game-start IP balance (for reference)
    total_bet       INTEGER NOT NULL DEFAULT 0,        -- total IP bet this game
    folded          INTEGER NOT NULL DEFAULT 0,
    is_winner       INTEGER NOT NULL DEFAULT 0,
    match_count     INTEGER DEFAULT NULL,              -- computed at showdown
    created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pp_game ON poker_players(game_id);
```

### 4.3 新表: poker_actions

```sql
CREATE TABLE IF NOT EXISTS poker_actions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id     INTEGER NOT NULL REFERENCES poker_games(id) ON DELETE CASCADE,
    player_id   INTEGER NOT NULL REFERENCES poker_players(id),
    action      TEXT NOT NULL,                        -- check | bet | call | raise | fold
    amount      INTEGER NOT NULL DEFAULT 0,
    round       INTEGER NOT NULL,                     -- 0-5
    created_at  INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pa_game ON poker_actions(game_id);
```

---

## 5. API 变更

### 5.1 新增端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/game/poker/status` | 检查是否可以开始一局（卡库数 ≥ 3？余额？） |
| `POST` | `/api/game/poker/create` | 开始新一局：选角色牌，自动创建 3 个 AI 对手，发牌 |
| `GET` | `/api/game/poker/{id}` | 获取游戏当前状态（掩藏 AI 底牌信息） |
| `POST` | `/api/game/poker/{id}/action` | 执行操作：`{ action: "check" \| "bet" \| "fold", amount?: number }` |
| `GET` | `/api/game/poker/{id}/result` | 摊牌后获取完整结果（显示所有底牌、匹配明细） |
| `GET` | `/api/game/poker/history` | 历史对局记录（最近 20 局） |

### 5.2 AI 对手逻辑（后端实现）

```python
def ai_decision(player, game_state) -> Action:
    """Simple AI strategy based on partial knowledge."""
    my_card_keywords = load_keywords(player.card_id)
    revealed_words = game_state.get_revealed_words()
    matches = sum(1 for w in revealed_words if w in my_card_keywords)
    current_bet = game_state.get_current_bet()
    
    if matches >= 3:
        # Strong hand → raise
        return Action("raise", min(50, current_bet * 2))
    elif matches == 2:
        # Decent hand → call or small bet
        return Action("bet", random.randint(5, 20))
    elif matches == 1:
        # Weak → check or call small
        return Action("call", current_bet) if current_bet <= 10 else Action("fold", 0)
    else:
        # No match → bluff 20% or fold
        return Action("bet", 15) if random.random() < 0.2 else Action("fold", 0)
```

---

## 6. 前端变更

### 6.1 路由

```
/game/poker → PokerGameView
```

在 `ContentPanel.tsx` 中添加路由检测（检测 `section === 'game'` 下的子路径）。

### 6.2 新增组件

| 组件 | 说明 |
|------|------|
| `PokerGameView` | 主视图（替代 GameView 的新入口） |
| `PokerTable` | 赌桌布局背景（椭圆形桌面 + 4 个座位） |
| `PokerCommunityCards` | 5 张单词牌（已翻/未翻状态） |
| `PokerPlayerHand` | 角色牌展示（你可见 / AI 背面） |
| `PokerBetControls` | 操作按钮组（过牌 / 下注 / 弃牌 + 金额滑块） |
| `PokerChipStack` | IP 筹码堆显示 |
| `PokerResultModal` | 摊牌结果弹窗（显示所有底牌 + 匹配明细 + 奖励） |
| `PokerLobby` | 大厅（开始新局 / 历史记录入口） |

### 6.3 游戏状态 (gameStore 扩展)

```typescript
interface PokerState {
  // 大厅
  lobbyMode: 'lobby' | 'playing';
  
  // 游戏
  gameId: number | null;
  round: number;           // 0-5
  pot: number;
  communityWords: PokerWord[];
  players: PokerPlayerState[];
  currentPlayerIndex: number;
  lastActions: PokerAction[];
  phase: 'betting' | 'showdown' | 'result';
  
  // UI
  selectedBet: number;
  isAiThinking: boolean;
}
```

### 6.4 游戏大厅界面

```
┌────────────────────────────────┐
│  「词牌对决」  →  游戏规则说明   │
│                                │
│  ┌─ 你的卡库 ────────────────┐ │
│  │  [Coco] [Dior] [Warhol]  │ │
│  │  选择本局要用的角色牌...   │ │
│  └──────────────────────────┘ │
│                                │
│  底注: 10 IP · 匹配 3 名 AI   │
│                                │
│  [🎴 开始对决]                 │
│                                │
│  余额: 1,250 ✨                │
│  历史战绩: 3胜 2负 总收益 120IP │
└────────────────────────────────┘
```

### 6.5 对局界面 (核心)

```
┌──────────────────────────────────────────┐
│  Round 3/5 · 底池: 85 ✨                  │
│                                          │
│    ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│    │style │ │fame │ │  ??  │ │  ??  │      │
│    │ 已翻  │ │ 已翻  │ │ 未翻  │ │ 未翻  │      │
│    └─────┘ └─────┘ └─────┘ └─────┘      │
│                   ┌─────┐                │
│                   │  ??  │                │
│                   │ 未翻  │                │
│                   └─────┘                │
│                                          │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐        │
│  │你  │  │AI-1│  │AI-2│  │AI-3│        │
│  │Coco│  │ 🂠  │  │ 🂠  │  │ 🂠  │        │
│  │已下│  │已下│  │弃牌│  │已下│        │
│  │ 20 │  │ 15 │  │  —  │  │ 10 │        │
│  └────┘  └────┘  └────┘  └────┘        │
│                                          │
│  你的操作:                                │
│  [✓ 过牌] [▲ 下注 ——— 20] [✗ 弃牌]    │
│                                          │
│  单词: elegance 优美雅致  [🔊]            │
│  匹配检查: ✨ style → 你有关键词!         │
│           ✨ fame  → 你没有此关键词        │
└──────────────────────────────────────────┘
```

---

## 7. 灵感值经济

| 操作 | 金额 | 说明 |
|------|------|------|
| 底注 (Ante) | 10 IP/人 | 每局自动扣除 |
| 最低下注 | 5 IP | 每次加注至少 5 |
| 最高下注 | 50 IP | 每次加注最多 50 |
| 赢家奖励 | 全部底池 | 扣除平台抽成（如有） |
| 平台抽成 | 0%（一期） | 后续可加 5% 燃烧通胀 |

---

## 8. 实现步骤

| # | 模块 | 内容 | 预估 |
|---|------|------|------|
| 1 | 数据库 | 创建 poker_games / poker_players / poker_actions 表 | 小 |
| 2 | 后端 | poker_game_service — 创建游戏、发牌、翻牌、AI 决策 | 中 |
| 3 | 后端 | poker_game_service — 匹配计算、底池结算 | 小 |
| 4 | 后端 | poker API 端点（create/state/action/result） | 中 |
| 5 | 后端 | 游戏大厅 API（status / history） | 小 |
| 6 | 后端 | 灵感值结算（每局结束加赢钱到 balance） | 小 |
| 7 | 前端 | PokerLobby 大厅（选角色牌、开始游戏） | 中 |
| 8 | 前端 | PokerTable 主对局界面 | 大 |
| 9 | 前端 | PokerCommunityCards + PokerPlayerHand | 中 |
| 10 | 前端 | PokerBetControls + 状态管理 | 中 |
| 11 | 前端 | PokerResultModal 摊牌结果弹窗 | 中 |
| 12 | 前端 | 游戏历史记录 | 小 |
| 13 | 测试 | 全流程冒烟测试 + AI 逻辑测试 | 中 |

---

## 9. 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 对手数量 | **3 名 AI** | 4 人桌最经典，计算简单，UI 布局清晰 |
| 匹配规则 | **关键词精确匹配** | 简单直观，和现有 card.keywords 直接对应 |
| AI 难度 | **规则驱动 + 随机化** | 无神经网络成本，开发快，行为可预期 |
| 底注大小 | **10 IP** | 接近每日活跃奖励额度，入门门槛低 |
| 最大下注 | **50 IP** | 一局最大输赢 ≈ 150-200 IP，约半天学习量 |
| 单词池 | **union of all card keywords** | 与卡牌系统强绑定，每张单词都一定有某角色匹配 |
| 牌力平局 | **稀有度裁决** | 稀有卡价值体现，鼓励收藏 |
| 弃牌不退 | 已下注 IP 归入底池 | 符合德州扑克规则，增加决策权重 |
| 单词学习 | 每局展示单词释义 + 发音 | 每局至少接触 5 个新/复习单词 |

---

## 10. 未来扩展

- **多人对战**：WebSocket 实时匹配，朋友之间对战
- **赛季排行榜**：按胜率/IP 收益排名
- **特殊牌型**：同花（全部匹配）、顺子（连续单词）、三条等
- **道具系统**：翻倍卡、透视对手一张牌、免除额外抽成
- **学习模式**：正式下注前可进入"练习模式"不消耗 IP
