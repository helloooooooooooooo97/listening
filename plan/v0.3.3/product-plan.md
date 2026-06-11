# v0.3.3 产品计划 — 代币经济系统

**日期**: 2026-06-11
**状态**: 规划中

---

## 1. 动机

目前抽卡系统除了"复习新词数 ≥ 1"外没有任何消耗门槛，用户可以无限抽卡。需要建立一个**统一的学习代币系统**，让学习行为（听音频、复习单词）产生价值，消耗在抽卡上，形成完整的"学习 → 赚币 → 抽卡"循环。

---

## 2. 代币设计

### 2.1 核心概念

**代币名称**: ✨ 灵感值 (Inspiration Points, IP)

| 行为 | 获得 IP | 说明 |
|------|---------|------|
| 听音频 | `+2 IP / 分钟` | 按 `play_history.duration_seconds` 累计，每日上限 120 IP |
| 复习单词 | `+1 IP / 词` | 按 `review_history` 逐词累计，正确 `score ≥ 80` 翻倍 |
| 听写 | `+3 IP / 句` | 按 `dictation_history` 逐句累计，正确 `score ≥ 80` 翻倍 |
| 首次登录日 | `+5 IP / 天` | 每天 0 点后首次活跃自动发放 |

### 2.2 消耗

| 行为 | 消耗 IP | 说明 |
|------|---------|------|
| 抽卡 | `-30 IP` | 每次调用 `POST /api/cards/draw` 时扣除 |
| （未来）重置匹配 | `-10 IP` | 刷新候选词列表 |

### 2.3 代币获取上限

| 来源 | 每日上限 | 目的 |
|------|----------|------|
| 听音频 | 120 IP (60 min) | 鼓励但不过度堆时长 |
| 复习单词 | 100 IP | 防刷量 |
| 听写 | 60 IP | 防刷量 |

每日总获取上限：**280 IP**
每日基础消耗（1 抽）：30 IP

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
    source      TEXT NOT NULL,                     -- 'listen' | 'review' | 'dictation' | 'daily_bonus' | 'draw'
    ref_id      TEXT DEFAULT '',                   -- 关联表 id（可选，如 play_history.id）
    ref_summary TEXT DEFAULT '',                   -- 可读描述（如 "听了 5 分钟"）
    created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ct_source ON currency_transactions(source);
CREATE INDEX IF NOT EXISTS idx_ct_date  ON currency_transactions(created_at);
```

### 3.3 已有表无需变更

- `play_history`、`review_history`、`dictation_history` — 仅需查询已有记录来计算应得代币
- `card_draw_log` — 抽卡记录里可增加 `cost` 字段（可选）

---

## 4. API 变更

### 4.1 新增端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/currency/balance` | 返回余额、今日已获取、历史累计 |
| `GET` | `/api/currency/transactions` | 交易流水（分页，支持 `?source=` 过滤） |
| `GET` | `/api/currency/earning-today` | 今日各来源已获取明细 |
| `POST` | `/api/currency/sync` | **手动触发**扫描当日 play/review/dictation 记录，补发遗漏代币（幂等） |

### 4.2 已有端点变更

| 方法 | 路径 | 变更 |
|------|------|------|
| `GET` | `/api/cards/draw/status` | 增加 `balance`、`draw_cost`、`can_afford` 字段 |
| `POST` | `/api/cards/draw` | 检查余额 ≥ `draw_cost`，**扣除后再执行抽卡**，余额不足返回 402 |
| `GET` | `/api/stats/overview` | 增加 `currency_balance` 字段 |

### 4.3 自动结算（被动）

不在每个 API 请求中实时计算代币 —— `GET /api/currency/balance` 和 `GET /api/cards/draw/status` 时自动扫描当日尚未结算的 play/review/dictation 记录，一次性批量入账。`POST /api/cards/draw` 前也会先结算。

**结算规则**：
- 只结算当日（00:00 至今）的未结算记录
- 通过 `currency_transactions.source` + `ref_id` 去重，确保幂等
- 结算后写入 `currency_transactions`，更新 `currency.balance`

---

## 5. 前端变更

### 5.1 灵感值展示

| 位置 | 内容 |
|------|------|
| 全局顶栏 / 侧栏 | 灵感值余额（图标 + 数字），始终可见 |
| 抽卡区 | 显示余额 / 抽卡消耗，余额不足时按钮禁用并显示"灵感值不足" |
| 统计页 | 灵感值趋势图（近 7 天收入/支出） |

### 5.2 抽卡按钮状态

| 状态 | 按钮 |
|------|------|
| 余额 ≥ 30 IP + 词汇达标 | 🎲 抽卡 (30 ✨) — 可点击 |
| 余额 < 30 IP | ❌ 灵感值不足 — 灰色禁用 |
| 词汇未达标 | 📖 还需 X 词 — 灰色禁用 |

### 5.3 组件新增

- `CurrencyBadge.vue` / `CurrencyBadge.tsx` — 灵感值余额胶囊（全局复用）
- 交易流水面板（在设置或统计页中）

### 5.4 对 CardsStore 的变更

```typescript
export interface CardsStore {
  // ... 已有字段
  balance: number;          // 当前灵感值余额
  drawCost: number;         // 单次抽卡消耗 (30)
  canAfford: boolean;       // balance >= drawCost
  todayEarned: number;      // 今日已获得
}
```

---

## 6. 配置 (config.yaml) 新增

```yaml
currency:
  earn:
    listen_per_minute: 2        # 每分钟听音频
    listen_daily_cap: 120       # 听音频每日 IP 上限
    review_per_word: 1          # 每复习一个词
    review_bonus_threshold: 80  # 得分 ≥ 80 翻倍
    review_daily_cap: 100       # 复习每日 IP 上限
    dictation_per_sentence: 3   # 每句听写
    dictation_daily_cap: 60     # 听写每日 IP 上限
    daily_bonus: 5              # 每日首次活跃
  draw:
    cost: 30                    # 每次抽卡消耗
```

---

## 7. 实现步骤

| # | 模块 | 内容 | 预估 |
|---|------|------|------|
| 1 | 数据库 | 创建 `currency` + `currency_transactions` 表 | 0.5h |
| 2 | 后端 | 代币结算引擎（扫描 play/review/dictation → 写入交易） | 2h |
| 3 | 后端 | 余额/流水 API 端点 | 1h |
| 4 | 后端 | 修改 draw 端点：检查余额、扣除后再抽卡 | 0.5h |
| 5 | 后端 | draw/status 增加 balance 字段 | 0.5h |
| 6 | 配置 | config.yaml 新增 currency 段 | 0.5h |
| 7 | 前端 | 全局灵感值余额展示 (CurrencyBadge) | 1h |
| 8 | 前端 | 抽卡区余额不足态处理 | 1h |
| 9 | 前端 | 统计页灵感值趋势 | 1h |
| 10 | 测试 | 全流程冒烟测试 | 1h |

**总计**: ~9.5h

---

## 8. 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 实时算 vs 预结算 | **被动结算**：访问接口时自动扫描当日未结算记录 | 实现简单，无后台定时任务依赖 |
| 单用户表 vs 多用户 | **单行表** | 平台是单用户，一行记录足矣 |
| 交易去重 | `source + ref_id` 唯一约束 | 防止重复结算 |
| 每日上限 | 各来源独立上限 | 防止单一行为刷量，鼓励多样化学习 |
