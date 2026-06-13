# v0.3.8 产品计划 — 德州听词玩法重构

**日期**: 2026-06-13
**状态**: 规划中 📋

---

## 1. 概述

将「德州听词」从**对战式扑克**改为**单人听词机玩法**——抽 5 张卡 → 播 5 个词 → 看每张卡命中几个词 → 出牌型 → 结算。降低操作门槛，强化「听词 + 集卡」的闭环感受。

---

## 2. 新玩法流程

```
┌──────────────────────────────────────────────────────────┐
│                     一回合流程                            │
├──────────────────────────────────────────────────────────┤
│  ① 抽牌   → 从已有卡牌池随机抽 5 张                       │
│  ② 播 5 词 → 逐一播报 5 个词汇（原课音频 / TTS）          │
│  ③ 命中   → 统计每张卡命中了几次（0~5）                    │
│  ④ 出牌型 → 5 个命中数组成特定牌型                        │
│  ⑤ 结算   → 按牌型排名发放灵感值奖励                      │
└──────────────────────────────────────────────────────────┘
```

- **无需手选卡牌**：每次自动从已拥有卡牌中随机抽取 5 张
- **无需下注**：每回合固定消耗一定灵感值（如 5 IP）
- **无对手**：单人玩法，不断挑战更高牌型

---

## 3. 命中计数

**规则很简单**：对于 5 个词汇中的每个词，检查它在不在每张卡牌的 `keywords` 或 `vocab_signature` 里。在就 +1。

```python
def count_hits(word: str, card: CardMeta) -> bool:
    stemmed = stem(word)
    return (
        word in card.keywords or
        stemmed in card.keywords or
        stemmed in card.vocab_signature
    )

def calc_card_scores(words: list[str], cards: list[CardMeta]) -> list[int]:
    return [sum(1 for w in words if count_hits(w, card)) for card in cards]
```

**示例**：播了 `[fashion, elegance, freedom, style, luxury]`，抽到 Chanel + Dior + Picasso + Dali + Da Vinci

| 卡牌 | 命中的词 | 命中数 |
|------|---------|--------|
| Coco Chanel | fashion, elegance, style | **3** |
| Christian Dior | fashion, style, luxury | **3** |
| Pablo Picasso | elegance | **1** |
| Salvador Dali | (none) | **0** |
| Leonardo da Vinci | (none) | **0** |

→ 结果数组 `[3, 3, 1, 0, 0]` → **两对**（一对 3 + 一对 0）

**词的选择策略**：为保证游戏体验，尽量选与抽到卡牌相关的高频词（即至少匹配 1 张卡），避免全员 0 分。

---

## 4. 牌型定义（大小规则）

5 个命中数（0~5）构成一手牌。按以下从大到小排序：

| 排名 | 牌型名称 | 条件 | 图示 | 奖励倍数 |
|------|----------|------|------|----------|
| 🥇 1 | **五福临门** | 5 张全部命中 5 次 | `[5,5,5,5,5]` | ×50 |
| 🥇 2 | **一条龙** | 5 张命中数连续递增 | `[0,1,2,3,4]` 或 `[1,2,3,4,5]` | ×30 |
| 🥈 3 | **四喜临门** | 4 张命中数相同 | `[5,5,5,5,2]` | ×10 |
| 🥉 4 | **葫芦** | 3 张相同 + 2 张相同 | `[4,4,4,2,2]` | ×6 |
| 🥉 5 | **三花聚顶** | 3 张命中数相同 | `[3,3,3,1,5]` | ×3 |
| 🏅 6 | **两对** | 2 张 + 2 张相同 | `[4,4,2,2,0]` | ×2 |
| 🏅 7 | **一对** | 2 张命中数相同 | `[5,5,3,2,1]` | ×1 |
| 8 | **散牌** | 无任何 pattern | `[4,3,2,1,0]` | ×0.5 |

**平局规则**（仅多人模式预留，单人模式不适用）：
1. 先比较牌型排名
2. 同牌型：按命中数之和（sum）比较
3. 仍平局：按最高单卡命中数比较
4. 再平局：平手，各拿一半

---

## 5. 胜负判定

### 5.1 每回合胜负

每回合消耗 **5 灵感值**，根据牌型拿到奖励。**盈亏分界线 = 葫芦（第 4 名）**：

| 结果 | 条件 | 奖励 | 净收益 |
|------|------|------|--------|
| 🏆 **大胜** | 五福临门 / 一条龙 | ×30~50 | +145 ~ +245 |
| 🎉 **胜** | 四喜临门 | ×10 | +45 |
| 👍 **小胜** | 葫芦 | ×6 | +25 |
| ➖ **回本** | 三花聚顶 | ×3 | +10 |
| 👎 **小亏** | 两对 | ×2 | +5（略亏） |
| ❌ **亏** | 一对 | ×1 | 0（纯亏 5） |
| 💀 **大亏** | 散牌 | ×0.5 | -2.5（亏最多） |

> 回本线 = 三花聚顶及以上（奖励 ≥ 成本）。
> 散牌/一对/两对 都是净亏损。

### 5.2 整局胜负

每局 **10 回合**，结束后按累计净收益定胜负：

| 评级 | 条件 | 展示 |
|------|------|------|
| 🏆 **传奇** | 净收益 ≥ +500 | 金色传说动画 |
| 🥇 **金牌** | 净收益 ≥ +200 | 金色牌框 |
| 🥈 **银牌** | 净收益 ≥ +50 | 银色牌框 |
| 🥉 **铜牌** | 净收益 ≥ 0 | 回本 |
| 💔 **再接再厉** | 净收益 < 0 | 亏损 |

**净收益 = 10 回合总奖励 - 50（总成本）**

### 5.3 提前终止

- 灵感值不足 5 时无法开始新回合，自动结束并结算
- 玩家可在任意回合后主动「结束本局」

---

## 6. 交互流程

### 6.1 前端 UI

```
┌─────────────────────────────────────────────────────────┐
│               回合 3/10                          ✨ 320  │
├─────────────────────────────────────────────────────────┤
│  [🔊 fashion] [🔊 elegance] [🔊 freedom] [🔊 style] [🔊 luxury] │
│            ← 5 个词逐一播报，可点重新听                       │
├─────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  ✨×3  │ │  ✨×3  │ │  ✨×1  │ │  ✨×0  │ │  ✨×0  │ │
│  │ Chanel │ │  Dior  │ │Picasso │ │  Dali  │ │Da Vinci│ │
│  │fashion │ │fashion │ │elegance│ │   —    │ │   —    │ │
│  │elegance│ │ luxury │ │        │ │        │ │        │ │
│  │ style  │ │ style  │ │        │ │        │ │        │ │
│  │        │ │        │ │        │ │        │ │        │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │
│  ← 每张卡显示命中数 + 命中了哪些词                        │
├─────────────────────────────────────────────────────────┤
│  牌型: 🏅 两对！         奖励: +10 ✨                    │
├─────────────────────────────────────────────────────────┤
│               [ 🎲 下一回合 ]                            │
└─────────────────────────────────────────────────────────┘
```

### 6.2 每回合状态

```
IDLE → DRAWING(抽牌动画) → LISTENING(5 词逐一播报)
  → REVEALING(逐张揭示命中数)
  → SHOWDOWN(展示牌型+结算) → IDLE
```

### 6.3 音效

- **抽牌**：保留现有 `deal` 音效
- **听词**：调用现有 `useWordAudio` 播词（5 词逐个播放）
- **揭晓**：逐张翻牌翻转音效（复用 `flip`）
- **牌型揭晓**：按好坏分级音效（复用 `win`/`fold`）

---

## 7. 后端变更

### 7.1 新 API

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/poker/v2/round` | 开始新回合：抽 5 张卡、选 5 词、计匹配数、评牌型、结算 |
| `GET`  | `/api/poker/v2/state` | 获取当前回合状态 |

### 7.2 请求/响应

**`POST /api/poker/v2/round`** — 请求：
```json
{}
```

响应：
```json
{
  "cards": [
    {"card_id": "chanel", "name": "Coco Chanel", "rarity": "R", "png": "coco_chanel"},
    {"card_id": "dior", "name": "Christian Dior", "rarity": "R", "png": "christian_dior"},
    {"card_id": "picasso", "name": "Pablo Picasso", "rarity": "SSR", "png": "picasso"},
    {"card_id": "dali", "name": "Salvador Dali", "rarity": "SSR", "png": "dali"},
    {"card_id": "davinci", "name": "Leonardo da Vinci", "rarity": "UR", "png": "davinci"}
  ],
  "words": ["fashion", "elegance", "freedom", "style", "luxury"],
  "scores": [3, 3, 1, 0, 0],
  "hand": {
    "rank": 6,
    "name": "两对",
    "description": "2张命中3次 + 2张命中0次"
  },
  "reward": 10,
  "balance_after": 320
}
```

### 7.3 后端逻辑

```python
ROUND_COST = 5   # 每回合消耗 5 灵感值

def new_round(user_id) -> RoundResult:
    # 1. 费用检查
    deduct_currency(user_id, ROUND_COST)

    # 2. 抽 5 张卡（从已拥有的卡中随机选）
    owned = get_owned_cards(user_id)
    cards = random.sample(owned, min(5, len(owned)))

    # 3. 选 5 个词（优先选与这些卡相关的词）
    words = pick_words_for_cards(cards, count=5)

    # 4. 算每张卡的命中数
    scores = [count_matches(words, card) for card in cards]

    # 5. 评牌型
    hand = evaluate_hand(scores)

    # 6. 结算
    reward = hand.reward_multiplier * ROUND_COST
    add_currency(user_id, reward)

    return RoundResult(cards, words, scores, hand, reward, ...)
```

### 7.4 牌型评估引擎

```python
def evaluate_hand(scores: list[int]) -> Hand:
    counts = Counter(scores)               # {score: frequency}
    values = sorted(counts.values(), reverse=True)

    if values == [5]:                      # e.g. [5,5,5,5,5] or [3,3,3,3,3]
        if all(s == 5 for s in scores):    # [5,5,5,5,5]
            return Hand(1, "五福临门", 50)
        return Hand(3, "四喜临门", 10)     # [4,4,4,4,4] etc → 用四喜临门兜底

    if sorted(scores) == [0,1,2,3,4] or sorted(scores) == [1,2,3,4,5]:
        return Hand(2, "一条龙", 30)

    if values == [4, 1]:                   # e.g. [5,5,5,5,2]
        return Hand(3, "四喜临门", 10)

    if values == [3, 2]:                   # e.g. [4,4,4,2,2]
        return Hand(4, "葫芦", 6)

    if values == [3, 1, 1]:                # e.g. [3,3,3,1,5]
        return Hand(5, "三花聚顶", 3)

    if values == [2, 2, 1]:                # e.g. [4,4,2,2,0]
        return Hand(6, "两对", 2)

    if values == [2, 1, 1, 1]:             # e.g. [5,5,3,2,1]
        return Hand(7, "一对", 1)

    return Hand(8, "散牌", 0.5)
```

---

## 8. 前端变更

| 文件 | 改动 |
|------|------|
| `stores/pokerStore.ts` | 新增 `v2Round()`、`v2State`、`scores`/`hand` 状态 |
| `components/game/poker/poker-table-view.tsx` | 重构为新 UI（5 卡展示 + 命中数 + 牌型 + 5 词播放） |
| `components/game/poker/poker-lobby.tsx` | 改为「开始听词」按钮，不再需要选卡 |
| `hooks/useWordAudio.ts` | 复用播词逻辑（5 词连续播放） |
| `hooks/useSoundEffect.ts` | 复用音效 |
| `lib/api.ts` | 新增 `pokerV2Round()` API 方法 |
| `views/PokerGameView.tsx` | 引用调整 |

---

## 9. 关键指标

| 指标 | 目标 |
|------|------|
| 每回合耗时 | ≤ 15s（含 5 词播报 ~10s） |
| 牌型分布（预估） | 散牌 35% / 一对 35% / 两对 15% / 三条 8% / 葫芦 4% / 四喜 2% / 一条龙 0.6% / 五福 0.4% |
| 灵感值消耗 | 5 IP/回合 |
| 期望回报率 | ~4 IP/回合（长期略亏，消耗灵感值） |

---

## 10. 实施顺序

| 阶段 | 内容 | 预估 |
|------|------|------|
| **Phase 1** | 后端：`/poker/v2/round` API + 选词策略 + 牌型引擎 | 1 天 |
| **Phase 2** | 前端：新 poker-table-view UI + store + API 对接 | 1 天 |
| **Phase 3** | 动画：抽牌动画、5 词播放、逐张揭晓、牌型展示 | 1 天 |
| **Phase 4** | 打磨：牌型分布 tuning、边缘 case、bug | 0.5 天 |

---

## 11. 不在此版本范围

- 多人对战（保持单人）
- 卡牌合成/升级
- 排行榜
- 牌型历史记录
