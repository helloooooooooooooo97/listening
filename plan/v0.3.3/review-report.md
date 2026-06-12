# v0.3.3 代码评审报告 — 代币经济系统

**评审日期**: 2026-06-12
**分支**: v0.3.1 → v0.3.3
**范围**: 后端代币引擎 + 前端余额展示 + 时间戳统一迁移

---

## 1. 实现概览

| 模块 | 状态 | 文件数 |
|------|------|--------|
| 数据库表 (`currency`, `currency_transactions`) | ✅ | 1 |
| 时间戳统一 (INTEGER `unixepoch()`) | ✅ | 8+ |
| 代币结算引擎 (`settle()`) | ✅ | 1 |
| 余额/流水 API | ✅ | 1 |
| 活动接口实时 `settle()` 调用 | ✅ | 1 |
| 抽卡余额检查 + 扣除 | ✅ | 1 |
| `draw/status` 增加 balance 字段 | ✅ | 1 |
| 配置 `config.yaml` | ✅ | 1 |
| `CurrencyBadge` 组件 | ✅ | 1 |
| `TransactionPanel` 组件 | ✅ | 1 |
| 抽卡区余额不足态处理 | ✅ | 1 |
| 统计页灵感值趋势 | ❌ 未实现 | — |
| 全流程冒烟测试 | ❌ 未实现 | — |

---

## 2. 严重缺陷 (必须修复)

### 🐛 B1. 抽卡消耗值三处不一致

| 位置 | 值 | 
|------|-----|
| 产品计划 (product-plan.md) | **300 IP** |
| config.yaml `draw.cost` | **10000 IP** |
| 前端 cardsStore 默认 `drawCost` | **30 IP** |

产品计划明确定义每日总获取上限 ≈ 4410 IP，300 IP/次抽卡 ≈ 7% 上限，符合"每天能抽约 14 次"的设计目标。

- `config.yaml` → 改为 `cost: 300`
- `cardsStore.ts` → 默认值改为 `drawCost: 300`

### 🐛 B2. `settle()` 调用缺少线程锁保护

`progress.py` 中的 5 个路由（`add_dictation`, `add_history`, `set_word_known`, `submit_review`, `submit_batch_review`）调用了 `settle(get_conn())`，但这些路由**没有 `@locked` 装饰器**。

问题：两个并发请求同时到达时，`settle()` 会扫描**相同的未结算记录**，各自计算 IP，然后都尝试写入 `currency_transactions`。虽然 `UNIQUE(source, ref_id)` 约束会阻止重复行，但 `INSERT OR IGNORE` 静默跳过第二条，**第二条的 balance 更新丢失**。

修复：给所有调用了 `settle()` 的 progress 路由加上 `@locked`。

### 🐛 B3. 统计概览缺少 `currency_balance`

产品计划要求 `GET /api/stats/overview` 返回 `currency_balance` 字段，但实际未实现。这会使得前端无法在统计页显示灵感值余额。

### 🐛 B4. `unixepoch('now', '-1 day')` SQLite 版本兼容性

`progress_repo.py:188`:
```sql
AND wp.reviewed_at >= unixepoch('now', '-1 day')
```

`unixepoch(timestring, modifier...)` 需要 **SQLite ≥ 3.43.0**（2023 年发布）。macOS 自带 SQLite 3.4x 可支持，但低版本环境下会崩溃。

修复：改为 `unixepoch() - 86400`，兼容所有 SQLite 版本且语义等价。

---

## 3. 警告与改进建议

### ⚠️ W1. 抽卡扣款 `ref_id` 使用时间戳，存在碰撞风险

`currency_service.py:148`:
```python
_add_tx(conn, "draw", f"draw:{int(datetime.now().timestamp())}", -cost, "抽卡消耗")
```

同一秒内两次抽卡会生成相同 `ref_id`，第二条被 `INSERT OR IGNORE` 静默吞掉。

**建议**: 使用抽卡 session 的 `draw_id` 作为 ref_id（需将 draw_id 传入 `deduct_for_draw`）。

### ⚠️ W2. 交易总数查询低效

`routers/currency.py:38`:
```python
"total": len(get_transactions(conn, source=source, limit=99999)),
```

无条件全表扫描所有行只是为了计数。

**建议**: 改为 `SELECT COUNT(*) FROM currency_transactions` 单独查询。

### ⚠️ W3. `locked` 导入后未使用

`progress.py` 导入了 `locked` 但所有路由都未使用该装饰器。建议要么使用 `@locked`（解决 B2），要么移除未使用的引入。

### ⚠️ W4. 前端默认 drawCost 与实际值不符

`cardsStore.ts` 的 `drawCost: 30` 即使按旧计划（300）也差了 10 倍。虽然运行时会被后端返回的真实值覆盖，但首次加载闪现 30 会造成困惑。

### ⚠️ W5. 未实现的计划项

| 计划项 | 状态 |
|--------|------|
| 统计页·灵感值趋势图（近 7 天收入/支出） | ❌ |
| 全流程冒烟测试 | ❌ |
| `POST /api/cards/draw` 检查余额 ≥ 300 后扣除 | ✅ |

---

## 4. 代码质量观察

### 👍 优点

- **幂等设计**：`UNIQUE(source, ref_id)` 约束 + `INSERT OR IGNORE` 保证 `settle()` 可安全重复调用
- **实时结算**：每次学习操作立即 settle()，用户即时看到积分变化，正反馈强
- **前端组件拆分清晰**：`CurrencyBadge` / `TransactionPanel` / `currencyStore` 各自职责明确
- **时间戳迁移完整**：几乎所有 `datetime('now')` 都被替换为 `unixepoch()`，前端对应 `string`→`number` 类型同步调整

### 🤔 可改进

- **当前余额查询链路**：每次 `GET /api/currency/balance` 都调用 `settle()` 全表扫描，性能可优化为懒加载或周期结算
- **错误提示**：余额不足返回 402，但前端 `catch` 直接 `set({ canDraw: false })`，未区分"余额不足"和"其他错误"
- **UI/UX**：`TransactionPanel` 加载中状态用的 spinner 很小，交易记录列表无上拉加载更多

---

## 5. 修复优先级

| 优先级 | 问题 | 操作 |
|--------|------|------|
| P0 | B1 抽卡消耗值不一致 | 立即修复 |
| P0 | B2 settle() 缺少锁保护 | 立即修复 |
| P0 | B4 SQLite 兼容性 | 立即修复 |
| P1 | B3 缺少 currency_balance | 规划修复 |
| P2 | W1-W5 | 后续迭代优化 |

---

## 6. 修复后提交范围

计划在修复 **B1** 和 **B2** 后进行提交，B4 一并处理。其余问题记录为后续迭代任务。
