# v0.3.3 产品计划 — 代币经济系统

**日期**: 2026-06-12
**状态**: 实现中

---

## 1. 动机

目前抽卡系统除了"复习新词数 ≥ 1"外没有任何消耗门槛，用户可以无限抽卡。需要建立一个**统一的学习代币系统**，让学习行为（听音频、复习单词、听写、掌握单词）产生价值，消耗在抽卡上，形成完整的"学习 → 赚币 → 抽卡"循环。

---

## 2. 代币设计

### 2.1 核心概念

**代币名称**: ✨ 灵感值 (Inspiration Points, IP)

**基本原则**:
- **1 秒听音频 = 1 IP**，所有奖励以此锚定
- 学习行为的 IP 价值与其时间投入/认知负荷成正比
- 各来源有每日上限，防止单一行为刷量

### 2.2 获得

| 行为 | IP | 等价于 | 每日上限 | 说明 |
|------|----|--------|----------|------|
| 🎧 听音频 | **1 IP / 秒** | — | 3600 IP (60 min) | `play_history.duration_seconds` 累计，短听不浪费 |
| 📝 复习单词（低分 < 80） | **5 IP / 词** | 5 s 音频 | 500 IP (100 词) | `review_history` 逐词累计 |
| 📝 复习单词（高分 ≥ 80） | **10 IP / 词** | 10 s 音频 | 500 IP (50 词) | 正确翻倍，鼓励高质量复习 |
| ✍️ 听写（低分 < 80） | **15 IP / 句** | 15 s 音频 | 300 IP (20 句) | `dictation_history` 逐句累计 |
| ✍️ 听写（高分 ≥ 80） | **30 IP / 句** | 30 s 音频 | 300 IP (10 句) | 正确翻倍 |
| ✅ 掌握单词 | **5 IP / 词** | 5 s 音频 | 无上限 | `word_progress.known=1` 触发 |
| 🌅 每日活跃奖励 | **10 IP / 天** | 10 s 音频 | 1 次/天 | 每天首次活跃自动发放 |

### 2.3 消耗

| 行为 | 消耗 IP | 等价于 | 说明 |
|------|---------|--------|------|
| 🎲 抽卡 | **10000 IP** | ~2.8 h 音频 / 1000 个高分复习 | 每次 `POST /api/cards/draw` 时扣除 |
| （未来）重置候选 | **500 IP** | ~8 min 音频 | 刷新抽卡候选词列表 |

### 2.4 每日收益上限

| 来源 | 每日上限 | 换算 |
|------|----------|------|
| 听音频 | 3600 IP | 60 min 专注听 |
| 复习单词 | 500 IP | 50-100 个词 |
| 听写 | 300 IP | 10-20 句 |
| 每日奖励 | 10 IP | — |

**每日总获取上限**: 4410 IP（不包含掌握单词的无上限奖励）
**每日最低抽卡消耗**: 300 IP（≈ 7% 的总上限）

---

## 3. 数据库变更

### 3.1 新表: `currency`

```sql
CREATE TABLE IF NOT EXISTS currency (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    balance   INTEGER NOT NULL DEFAULT 0,        -- 当前灵感值余额
    earned    INTEGER NOT NULL DEFAULT 0,         -- 历史累计获得
    spent     INTEGER NOT NULL DEFAULT 0          -- 历史累计消耗
);
```

单用户模式，只有一行记录。

### 3.2 新表: `currency_transactions`

```sql
CREATE TABLE IF NOT EXISTS currency_transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    amount      INTEGER NOT NULL,                 -- 正＝获得，负＝消耗
    balance_after INTEGER NOT NULL,               -- 交易后余额
    source      TEXT NOT NULL,                     -- 'listen' | 'review' | 'dictation' | 'word_mastery' | 'daily_bonus' | 'draw'
    ref_id      TEXT DEFAULT '',                   -- 关联记录的唯一标识（用于去重）
    ref_summary TEXT DEFAULT '',                   -- 可读描述（如 "听了 52 秒音频"）
    created_at  INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_ct_source ON currency_transactions(source);
CREATE INDEX IF NOT EXISTS idx_ct_date  ON currency_transactions(created_at);
```

### 3.3 时间戳统一

所有 `created_at`、`played_at`、`reviewed_at`、`updated_at`、`added_at` 等时间字段从 `TEXT DEFAULT (datetime('now'))` 统一为 **`INTEGER DEFAULT (unixepoch())`**，消除时区歧义，前端直接用 `new Date(ts * 1000).toLocaleString()` 显示本地时间。

涉及表: `play_history`, `review_history`, `dictation_history`, `word_progress`, `clips`, `favorites`, `collections`, `collection_items`, `audio_progress`, `translations`, `card_collection`, `card_draw_log`, `currency_transactions`

---

## 4. API 变更

### 4.1 新增端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/currency/balance` | 返回余额、今日已获取、历史累计 |
| `GET` | `/api/currency/transactions` | 交易流水（分页，支持 `?source=` 过滤） |
| `GET` | `/api/currency/earning-today` | 今日各来源已获取明细 |
| `POST` | `/api/currency/sync` | **手动触发**扫描当日 play/review/dictation/word_progress 记录，补发遗漏代币（幂等） |

### 4.2 已有端点变更

| 方法 | 路径 | 变更 |
|------|------|------|
| `GET` | `/api/cards/draw/status` | 增加 `balance`、`draw_cost`、`can_afford` 字段 |
| `POST` | `/api/cards/draw` | 检查余额 ≥ 300，**扣除后再执行抽卡**，余额不足返回 402 |
| `GET` | `/api/stats/overview` | 增加 `currency_balance` 字段 |

### 4.3 实时结算（主动触发）

**不同于原始设计的被动结算，改为实时触发**——每次用户执行学习操作后立即调用 `settle()`：

| 触发点 | 结算来源 |
|--------|----------|
| `POST /api/progress/play-history` | `listen` |
| `POST /api/progress/dictation` | `dictation` |
| `POST /api/progress/words` (标记掌握) | `word_mastery` |
| `POST /api/progress/words/review` | `review` |
| `POST /api/progress/review/batch` | `review` |
| `GET /api/currency/balance` | 全部（兜底） |
| `GET /api/currency/transactions` | 全部（兜底） |

**结算规则**：
- 只结算当日（`00:00 UTC` 至今）的未结算记录
- 通过 `currency_transactions.source + ref_id` 唯一约束去重，确保幂等
- 每条结算写入 `currency_transactions`，更新 `currency.balance`

---

## 5. 前端变更

### 5.1 灵感值展示

| 位置 | 内容 |
|------|------|
| 侧栏底部 | 灵感值余额胶囊，始终可见 |
| 抽卡区 | 显示余额 / 抽卡消耗，余额不足时按钮禁用 |
| 统计页 | 灵感值趋势图（近 7 天收入/支出） |

### 5.2 抽卡按钮状态

| 状态 | 按钮 |
|------|------|
| 余额 ≥ 300 IP + 词汇达标 | 🎲 抽卡 (300 ✨) — 可点击 |
| 余额 < 300 IP | ❌ 灵感值不足 — 灰色禁用 |
| 词汇未达标 | 📖 还需 X 词 — 灰色禁用 |

### 5.3 组件新增

- `CurrencyBadge.tsx` — 灵感值余额胶囊（侧栏底部）
- `TransactionPanel.tsx` — 交易流水弹窗（从余额胶囊点击打开）

### 5.4 对 CardsStore 的变更

```typescript
export interface CardsStore {
  balance: number;
  drawCost: number;      // 300
  canAfford: boolean;
  todayEarned: number;
}
```

---

## 6. 配置 (config.yaml)

```yaml
currency:
  earn:
    listen_per_second: 1        # 每秒听音频 → 1 IP
    listen_daily_cap: 3600      # 听音频每日 IP 上限 (60 min)
    review_per_word: 5          # 每复习一个词基础值
    review_bonus_threshold: 80  # 得分 ≥ 80 翻倍
    review_daily_cap: 500       # 复习每日 IP 上限
    dictation_per_sentence: 15  # 每句听写基础值
    dictation_daily_cap: 300    # 听写每日 IP 上限
    word_mastery_bonus: 5       # 掌握一个新单词
    daily_bonus: 10             # 每日首次活跃奖励
  draw:
    cost: 300                   # 每次抽卡消耗
```

---

## 7. 实现步骤

| # | 模块 | 内容 | 状态 |
|---|------|------|------|
| 1 | 数据库 | 创建 `currency` + `currency_transactions` 表 | ✅ |
| 2 | 数据库 | 时间戳统一改为 INTEGER `unixepoch()` | ✅ |
| 3 | 后端 | 代币结算引擎（扫描 → 写入交易） | ✅ |
| 4 | 后端 | 余额/流水 API 端点 | ✅ |
| 5 | 后端 | 活动接口实时调用 settle() | ✅ |
| 6 | 后端 | 修改 draw 端点：检查余额、扣除后再抽卡 | |
| 7 | 后端 | draw/status 增加 balance 字段 | |
| 8 | 配置 | config.yaml 更新 | ✅ |
| 9 | 前端 | 全局灵感值余额展示 (CurrencyBadge) | ✅ |
| 10 | 前端 | 交易流水面板 (TransactionPanel) | ✅ |
| 11 | 前端 | 抽卡区余额不足态处理 | |
| 12 | 前端 | 统计页灵感值趋势 | |
| 13 | 测试 | 全流程冒烟测试 | |

---

## 8. 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 计价锚点 | **1 s 音频 = 1 IP** | 直观、可预期；用户能直接感知"我听 5 分钟就能抽一次卡" |
| 结算时机 | **实时结算** | 每次学习操作后立即 settle()，用户立刻看到积分变化，正反馈更强 |
| 每日上限 | 各来源独立上限 | 防止单一行为刷量，鼓励多样化学习 |
| 交易去重 | `source + ref_id` 唯一约束 | 幂等安全，重复调用 settle() 不会重复加分 |
| 时间戳格式 | **INTEGER unixepoch** | 统一时区问题；前端 `new Date(ts*1000)` 直接显示本地时间 |
| 高分翻倍 | review ≥ 80、dictation ≥ 80 | 激励学习质量，不只看数量 |
| 掌握单词奖励 | 与复习独立 | 标记已掌握的单词也产生价值，鼓励整理词库 |
