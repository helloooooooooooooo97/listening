# v0.3.8 产品计划 — 德州听词玩法重构

**日期**: 2026-06-13
**状态**: 规划中 📋

---

## 1. 概述

保留 **4 人对战** 的德州框架，但**卡牌机制重构**：每人不再只拿 1 张卡，而是随机抽 **5 张**，配 5 个公共词汇形成「手牌」，按牌型大小比胜负。

---

## 2. 新玩法流程

```
┌──────────────────────────────────────────────────────────┐
│                     一局流程（10 回合）                     │
├──────────────────────────────────────────────────────────┤
│  每回合：                                                 │
│    ① 抽牌   → 每人从自己卡牌池随机抽 5 张（不重复）         │
│    ② 听词   → 播报 5 个公共词汇                             │
│    ③ 计数   → 每张卡统计命中了几个词（0~5）                 │
│    ④ 比牌   → 4 人按 5 个命中数组成的牌型比大小              │
│    ⑤ 结算   → 最大者赢走底池                                │
│    ⑥ 下一回合（共 10 回合）                                │
├──────────────────────────────────────────────────────────┤
│  整局结束：统计 10 回合总收益，评级展示                      │
└──────────────────────────────────────────────────────────┘
```

- **无需手选卡牌**：每人每回合自动从已拥有卡牌中随机抽 5 张
- **保留对战的刺激感**：看牌型、比大小

---

## 3. 命中计数

**规则**：5 个公共词汇逐一播放，对每张卡牌检查该词是否在卡的 `keywords` 或 `vocab_signature` 中。每张卡的命中数 = 命中的词汇数量（0~5）。

```python
def count_hits(words: list[str], card: CardMeta) -> int:
    """返回词汇列表命中了这张卡几次"""
    return sum(
        1 for w in words
        if w in card.keywords or stem(w) in card.vocab_signature
    )

def player_hand(words: list[str], cards: list[CardMeta]) -> list[int]:
    """每人5张卡 → 5个命中数"""
    return [count_hits(words, c) for c in cards]
```

---

## 4. 牌型定义（大小规则）

每人 5 张卡的命中数（0~5）构成一手牌。按以下从大到小排序：

| 排名 | 牌型名称 | 条件 | 图示 |
|------|----------|------|------|
| 🥇 1 | **五福临门** | 5 张全部命中 5 次 | `[5,5,5,5,5]` |
| 🥇 2 | **一条龙** | 命中数连续递增 | `[0,1,2,3,4]` 或 `[1,2,3,4,5]` |
| 🥈 3 | **四喜临门** | 4 张命中数相同 | `[5,5,5,5,2]` |
| 🥉 4 | **葫芦** | 3 张相同 + 2 张相同 | `[4,4,4,2,2]` |
| 🏅 5 | **三花聚顶** | 3 张命中数相同 | `[3,3,3,1,5]` |
| 🏅 6 | **两对** | 2 张 + 2 张相同 | `[4,4,2,2,0]` |
| 🏅 7 | **一对** | 2 张命中数相同 | `[5,5,3,2,1]` |
| 8 | **散牌** | 无任何 pattern | `[4,3,2,1,0]` |

**同牌型比较（踢脚）**：
1. 先比牌型排名
2. 同牌型：比命中数之和（sum）
3. 仍相同：最高单卡命中数
4. 再相同：平手，平分底池

---

## 5. 每回合胜负

- 4 名玩家各抽 5 张卡
- 5 个公共词汇播报
- 各自形成手牌，**牌型最大者赢下本回合底池**
- 每人每回合固定投入 5 IP，底池 = 20 IP
- 赢家拿走 20 IP（净赚 +15）

---

## 6. 整局胜负

每局 **10 回合**，统计总净收益：

| 评级 | 条件（累计净收益） |
|------|-------------------|
| 🏆 **传奇** | ≥ +300 IP |
| 🥇 **金牌** | ≥ +150 IP |
| 🥈 **银牌** | ≥ +50 IP |
| 🥉 **铜牌** | ≥ 0 IP（回本） |
| 💔 **再接再厉** | < 0 IP |

---

## 7. 交互流程

### 7.1 前端 UI

```
┌──────────────────────────────────────────────────────┐
│ 回合 3/10                 ✨ 320      底池: 20 IP   │
│ [🔊 word1] [🔊 word2] [🔊 word3] [🔊 word4] [🔊 word5] │
├──────────────────────────────────────────────────────┤
│ 你: 🏅 两对！                    ┌──────────────────┐│
│ ┌──┐┌──┐┌──┐┌──┐┌──┐           │   公共词         ││
│ │×4││×4││×2││×2││×1│           │ fashion         ││
│ └──┘└──┘└──┘└──┘└──┘           │ elegance        ││
│                                  │ freedom         ││
│ 玩家A: 散牌                      │ style           ││
│ 玩家B: 一对                      │ luxury          ││
│ 玩家C: 🏆 三花聚顶 ← 胜出      └──────────────────┘│
├──────────────────────────────────────────────────────┤
│               [ 🎲 下一回合 ]                        │
└──────────────────────────────────────────────────────┘
```

### 7.2 每回合状态

```
IDLE → DRAWING(每人抽5张) → LISTENING(5词逐一播报)
  → REVEALING(逐家揭示牌型)
  → SHOWDOWN(宣布赢家+结算) → IDLE
```

---

## 8. 后端变更

### 8.1 新 API

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/poker/v2/round` | 执行一回合：每人抽 5 张、选 5 词、计命中、评牌型、判胜负 |

### 8.2 请求/响应

**请求**：
```json
{}
```

**响应**：
```json
{
  "round": 3,
  "words": ["fashion", "elegance", "freedom", "style", "luxury"],
  "players": [
    {
      "type": "human",
      "cards": [
        {"card_id": "chanel", "name": "Coco Chanel", "rarity": "R"},
        {"card_id": "dior", "name": "Christian Dior", "rarity": "R"},
        {"card_id": "mcqueen", "name": "Alexander McQueen", "rarity": "SR"},
        {"card_id": "lagerfeld", "name": "Karl Lagerfeld", "rarity": "SR"},
        {"card_id": "warhol", "name": "Andy Warhol", "rarity": "SR"}
      ],
      "scores": [4, 4, 2, 2, 1],
      "hand": {"rank": 6, "name": "两对"}
    },
    {
      "type": "ai",
      "name": "玩家A",
      "scores": [1, 1, 0, 0, 0],
      "hand": {"rank": 7, "name": "一对"}
    },
    {
      "type": "ai",
      "name": "玩家B",
      "scores": [2, 1, 0, 0, 0],
      "hand": {"rank": 8, "name": "散牌"}
    },
    {
      "type": "ai",
      "name": "玩家C",
      "scores": [3, 3, 3, 1, 5],
      "hand": {"rank": 5, "name": "三花聚顶"}
    }
  ],
  "winner_index": 3,
  "pot": 20,
  "reward": 20,
  "balance_after": 330
}
```

### 8.3 后端逻辑

```python
ROUND_COST = 5

def new_round(user_id) -> RoundResult:
    # 1. 每个玩家抽5张卡
    players = []
    for p in get_all_players(user_id):  # 1 human + 3 AI
        cards = random.sample(p.card_pool, 5)
        players.append({"id": p.id, "cards": cards})

    # 2. 选5个公共词汇
    words = pick_community_words(players, count=5)

    # 3. 每人算手牌
    for p in players:
        p.scores = [count_hits(words, c) for c in p.cards]
        p.hand = evaluate_hand(p.scores)

    # 4. 比大小决出赢家
    winner = max(players, key=lambda p: hand_sort_key(p.hand, p.scores))
    pot = ROUND_COST * 4
    add_currency(winner.id, pot)
    deduct_currency(user_id, ROUND_COST)  # 只扣人类

    return RoundResult(players, words, winner, pot, ...)
```

### 8.4 牌型评估引擎

```python
from collections import Counter

def evaluate_hand(scores: list[int]) -> dict:
    """scores = [4,4,2,2,1] → {rank: 6, name: '两对'}"""
    freq = sorted(Counter(scores).values(), reverse=True)

    if freq == [5]:
        if all(s == 5 for s in scores):
            return {"rank": 1, "name": "五福临门"}
        return {"rank": 3, "name": "四喜临门"}

    if sorted(scores) in ([0,1,2,3,4], [1,2,3,4,5]):
        return {"rank": 2, "name": "一条龙"}

    if freq[0] == 4:
        return {"rank": 3, "name": "四喜临门"}

    if freq == [3, 2]:
        return {"rank": 4, "name": "葫芦"}

    if freq[0] == 3:
        return {"rank": 5, "name": "三花聚顶"}

    if freq == [2, 2, 1]:
        return {"rank": 6, "name": "两对"}

    if freq[0] == 2:
        return {"rank": 7, "name": "一对"}

    return {"rank": 8, "name": "散牌"}

def hand_sort_key(hand: dict, scores: list[int]) -> tuple:
    """用于比大小的排序key"""
    return (hand["rank"], sum(scores), max(scores))
```

### 8.5 AI 卡牌池

- **人类**：从真实已拥有卡牌中抽
- **AI**：从全部卡牌池中随机抽（模拟对手）

---

## 9. 前端变更

| 文件 | 改动 |
|------|------|
| `stores/pokerStore.ts` | 新增 v2 状态（4 人牌型/胜负/底池） |
| `components/game/poker/poker-table-view.tsx` | 重构：4 人各 5 卡 + 公共词 + 比牌展示 |
| `components/game/poker/poker-lobby.tsx` | 改为「开始对决」，不再选卡 |
| `lib/api.ts` | 新增 `pokerV2Round()` |
| `views/PokerGameView.tsx` | 引用调整 |

---

## 10. 关键指标

| 指标 | 目标 |
|------|------|
| 每回合耗时 | ≤ 15s（含 5 词播报） |
| IP 消耗 | 5 IP/回合 |
| 整局收益期望 | ~0（零和博弈，长期持平） |

---

## 11. 实施顺序

| 阶段 | 内容 | 预估 |
|------|------|------|
| **Phase 1** | 后端：`/poker/v2/round` API + 选词 + 牌型 + 比大小 | 1 天 |
| **Phase 2** | 前端：4 人对战 UI + store + API 对接 | 1 天 |
| **Phase 3** | 动画：抽牌/听词/翻牌/比牌 | 0.5 天 |
| **Phase 4** | 打磨：AI 卡牌池、分布 tuning | 0.5 天 |

---

## 12. 不在此版本范围

- 复杂下注（加注/全下等）
- 弃牌机制
- 卡牌合成/升级
- 排行榜
