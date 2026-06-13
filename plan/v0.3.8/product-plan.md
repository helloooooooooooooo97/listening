# v0.3.8 产品计划 — 德州听词玩法重构

**日期**: 2026-06-13
**状态**: 规划中 📋

---

## 1. 概述

将「德州听词」从**对战式扑克**（选一张卡 vs AI/比匹配数/下注）改为**听词机/老虎机式**（抽 5 张卡 → 听词 → 出牌型 → 结算）。降低操作门槛，强化「听词 + 集卡」的闭环感受。

**核心改变**：不再需要玩家选卡、下注、跟注、弃牌，每回合就是「听一个词 → 看牌型 → 拿奖励」。

---

## 2. 新玩法流程

```
┌──────────────────────────────────────────────────────────┐
│                     一回合流程                            │
├──────────────────────────────────────────────────────────┤
│  ① 抽牌   → 从已有卡牌池随机抽 5 张                       │
│  ② 听词   → 播报一个词汇（原课音频 / TTS）                 │
│  ③ 命中   → 该词对 5 张卡各产生「命中等级」1–5             │
│  ④ 出牌型 → 5 个等级组合成特定牌型                         │
│  ⑤ 结算   → 按牌型排名发放灵感值 + 额外奖励                │
└──────────────────────────────────────────────────────────┘
```

- **无需手选卡牌**：每次自动从已拥有卡牌中随机抽取 5 张
- **无需下注**：每回合固定消耗一定灵感值（如 5 IP）
- **无对手**：单人玩法，不断挑战更高牌型

---

## 3. 命中等级（Hit Level）定义

对于被播词汇 W 和每张卡牌 C，按以下规则计算命中等级：

| 等级 | 条件 | 示例 |
|------|------|------|
| ⭐⭐⭐⭐⭐ **Lv 5** | W 与卡牌的关键词 *精确匹配* | "fashion" → Coco Chanel（关键词含 fashion） |
| ⭐⭐⭐⭐ **Lv 4** | W 的词干 *包含于* 卡牌的 `vocab_signature` | "freedom" → Chanel（motto 含 freedom） |
| ⭐⭐⭐ **Lv 3** | W 与卡牌共享考试标签（exam tag） | "cat" → IELTS 卡牌 |
| ⭐⭐ **Lv 2** | W 在词典中与卡牌主题相关 | "elegant" → 时尚类卡牌 |
| ⭐ **Lv 1** | 无直接匹配 | 默认值 |

**实现方案**：

```python
def calc_hit_level(word: str, card: CardMeta) -> int:
    stemmed = stem(word)
    # Level 5: keyword exact match
    if word in card.keywords or stemmed in card.keywords:
        return 5
    # Level 4: vocab_signature match
    if stemmed in card.vocab_signature:
        return 4
    # Level 3: shared exam tag (如果卡牌有关联考试标签)
    # Level 2: word2vec / 词典近义词关联
    # Level 1: fallback
    return 1
```

> **初始 MVP** 可实现 Lv 5 + Lv 4 + Lv 1 三级，Lv 3/Lv 2 后续补充。

---

## 4. 牌型定义（大小规则）

5 张卡牌的命中等级（1–5）构成一手牌。按以下从大到小排序：

| 排名 | 牌型名称 | 条件 | 图示 | 奖励倍数 |
|------|----------|------|------|----------|
| 🥇 1 | **五福临门** | 5 张卡全部命中 Lv 5 | `[5,5,5,5,5]` | ×50 |
| 🥇 2 | **一条龙** | Lv 1–5 各出现一次 | `[1,2,3,4,5]` | ×30 |
| 🥈 3 | **五彩祥云** | 5 张卡全部同一等级（Lv 1–4） | `[4,4,4,4,4]` | ×20 |
| 🥈 4 | **四喜临门** | 4 张卡同一等级 | `[5,5,5,5,2]` | ×10 |
| 🥉 5 | **葫芦** | 3 张同等级 + 2 张同等级 | `[4,4,4,2,2]` | ×6 |
| 🥉 6 | **顺子** | 3 个以上连续等级 | `[2,3,4,4,5]` | ×4 |
| 🏅 7 | **三花聚顶** | 3 张卡同一等级 | `[3,3,3,1,5]` | ×3 |
| 🏅 8 | **两对** | 2 张 + 2 张同等级 | `[4,4,2,2,1]` | ×2 |
| 🏅 9 | **一对** | 2 张卡同一等级 | `[5,5,3,2,1]` | ×1 |
| 10 | **散牌** | 无任何 pattern | `[4,3,2,1,1]` | ×0.5 |

**平局规则**：
1. 先比较牌型排名
2. 同牌型：按命中等级之和（sum of levels）比较
3. 仍平局：按最高单卡等级比较
4. 再平局：平手，各拿一半

---

## 5. 交互流程

### 5.1 前端 UI

```
┌──────────────────────────────────────┐
│  🔊 当前词汇: "freedom"   [🔊 重听]  │
│  本回合消耗: 5 ✨                     │
├──────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│  │ Lv5│ │ Lv4│ │ Lv3│ │ Lv2│ │ Lv1│ │
│  │ 🌟  │ │ 📖  │ │ 🔗  │ │ 📝  │ │ ➖  │
│  │Chanel│ │Dior │ │Picasso│ │Dali│ │DaVinci│
│  └────┘ └────┘ └────┘ └────┘ └────┘ │
│  ← 每张卡显示: 命中等级 + 匹配说明    │
├──────────────────────────────────────┤
│  牌型: 🥈 四喜临门！                   │
│  奖励: +50 ✨                         │
├──────────────────────────────────────┤
│  [ 🎲 下一回合 ]                      │
└──────────────────────────────────────┘
```

### 5.2 每回合状态

```
IDLE → DRAWING(抽牌动画) → LISTENING(播词) 
  → REVEALING(逐张揭示命中等级) 
  → SHOWDOWN(展示牌型+结算) → IDLE
```

### 5.3 音效

- **抽牌**：保留现有 `deal` 音效
- **听词**：调用现有 `useWordAudio` 播词
- **揭晓命中等级**：逐张翻牌翻转音效（复用 `flip`）
- **牌型揭晓**：按好坏分级音效（复用 `win`/`fold`）

---

## 6. 后端变更

### 6.1 新 API

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/poker/v2/round` | 开始新回合：抽 5 张卡、选词、计算命中等级、返回牌型 |
| `GET`  | `/api/poker/v2/state` | 获取当前回合状态 |

### 6.2 请求/响应

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
    ...
  ],
  "word": "freedom",
  "hit_levels": [5, 4, 3, 2, 1],
  "hand": {
    "rank": 4,
    "name": "四喜临门",
    "description": "4张卡命中Lv5"
  },
  "reward": 50,
  "balance_after": 320
}
```

### 6.3 后端逻辑

```python
def new_round(user_id) -> RoundResult:
    # 1. 费用检查
    deduct_currency(user_id, ROUND_COST)  # 5 IP
    
    # 2. 抽卡
    owned_cards = get_owned_cards(user_id)
    selected = random.sample(owned_cards, min(5, len(owned_cards)))
    # 不足5张的降级处理
    
    # 3. 选词
    word = pick_vocab_word(selected)
    
    # 4. 计算命中等级
    levels = [calc_hit_level(word, card) for card in selected]
    
    # 5. 评估牌型
    hand = evaluate_hand(levels)
    
    # 6. 结算奖励
    reward = compute_reward(hand)
    add_currency(user_id, reward)
    
    return RoundResult(...)
```

---

## 7. 前端变更

| 文件 | 改动 |
|------|------|
| `stores/pokerStore.ts` | 新增 `v2Round()`、`v2State`、`hand`/`hitLevels` 状态 |
| `components/game/poker/poker-table-view.tsx` | 重构为新 UI（5 卡展示 + 命中等级 + 牌型） |
| `components/game/poker/poker-lobby.tsx` | 改为「开始听词」按钮，不再需要选卡 |
| `hooks/useWordAudio.ts` | 复用现有播词逻辑 |
| `hooks/useSoundEffect.ts` | 复用现有音效 |
| `lib/api.ts` | 新增 `pokerV2Round()` API 方法 |
| `views/PokerGameView.tsx` | 引用调整 |

---

## 8. 关键指标

| 指标 | 目标 |
|------|------|
| 每回合耗时 | ≤ 8s（含播词 3–5s） |
| 牌型分布 | 散牌 40% / 一对 30% / 两对 15% / 三条 8% / 葫芦 4% / 四条 2% / 五彩 0.5% / 一条龙 0.4% / 五福 0.1% |
| 灵感值消耗 | 5 IP/回合 |
| 期望回报率 | ~4 IP/回合（长期略亏，消耗灵感值） |

---

## 9. 实施顺序

| 阶段 | 内容 | 预估 |
|------|------|------|
| **Phase 1** | 后端：`/poker/v2/round` API + 命中等级计算 + 牌型评估引擎 | 1 天 |
| **Phase 2** | 前端：新 poker-table-view UI + store + API 对接 | 1 天 |
| **Phase 3** | 动画：抽牌动画、逐张翻牌、牌型揭晓 | 1 天 |
| **Phase 4** | 打磨：牌型分布 tuning、SEO、bug | 0.5 天 |

---

## 10. 不在此版本范围

- 多人对战（保持单人）
- 卡牌合成/升级
- 排行榜
- 牌型历史记录
