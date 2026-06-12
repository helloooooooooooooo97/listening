# v0.3.4 代码评审报告 — 日志系统 + Poker 修复 + UI 重设计

**评审日期**: 2026-06-12
**分支**: v0.3.1
**范围**: 后端日志系统、Poker 服务 bug 修复、词牌对决 UI 重设计、摊牌数据增强

---

## 1. 实现概览

| 模块 | 状态 | 文件数 |
|------|------|--------|
| 日志模块 (`log_config.py`) | ✅ 新增 | 1 |
| 日志接入 main.py / 全局异常处理 | ✅ | 1 |
| 日志接入 database.py (print → logger) | ✅ | 1 |
| uvicorn.access / uvicorn.error 日志接入 | ✅ | 1 |
| config.yaml 日志配置 | ✅ | 1 |
| Poker stale players bug 修复 | ✅ | 1 |
| Poker all-AI-folded 不结束 bug 修复 | ✅ | 1 |
| Poker 全链路日志 | ✅ | 1 |
| 侧边栏「游戏」→「听了个听」 | ✅ | 1 |
| stats 根路由防 404 | ✅ | 1 |
| 摊牌返回所有玩家底牌 + 最终得分 (后端) | ✅ | 1 |
| 摊牌 UI 重设计 (4列网格) | ✅ | 1 |
| 对局中 UI 重设计 (2×2 网格 + 紧凑公共词) | ✅ | 1 |
| 抽卡消耗 300→1 IP (测试用) | ✅ | 1 |
| 日志目录路径修复 | ✅ | 1 |

---

## 2. 严重缺陷 (必须修复)

### 🐛 B1. `communityWords` 未从 props 解构

`ShowdownResult` 组件的类型定义中有 `communityWords` 字段，但函数参数解构中遗漏了它，导致运行时 `communityWords is not defined` 报错。

- 位置：`frontend/src/views/PokerGameView.tsx:410`
- 修复：将 `communityWords` 加入解构 `{ showdown, pot, onPlayAgain, communityWords }`

### 🐛 B2. 日志目录路径计算错误

`log_config.py` 中计算项目根目录时多了一层 `.parent`：

```python
# 错误：4 次 .parent 到了 Desktop/
_LOG_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "logs"
# 正确：3 次 .parent 到 english/
_LOG_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "logs"
```

- 后果：日志写到了 `~/Desktop/data/logs/` 而非 `~/Desktop/english/data/logs/`
- 修复：减少一次 `.parent` 调用

### 🐛 B3. `_compute_showdown` 仅计算 active_players

摊牌时只计算未弃牌玩家的匹配数，弃牌玩家不包含在结果中。用户要求展示所有玩家（含弃牌）的理论最终得分。

- 位置：`poker_service.py:_compute_showdown`
- 修复：改为遍历 `players`（含弃牌），新增 `folded` 和 `card_png` 字段

---

## 3. 警告与改进建议

### ⚠️ W1. 摊牌 UI 冗余

初始重设计的 `ShowdownResult` 将 4 名玩家纵向堆叠，每人展示完整卡图 + 关键词列表 + 大号得分，导致：
- 整个画面超过一屏，需要滚动
- 赢家信息在标题和列表中重复出现 4 次
- 关键词标签空间利用率低（4 人 x 4 关键词 = 16 个小标签）

修复：改为 4 列网格布局，每人一小格含缩略卡图 + 得分 X/5，弃牌半透明。关键词折叠到「公共词」详情中。

### ⚠️ W2. 对局中 UI 臃肿

初始布局：
- 5 个社区词各占 `w-20 h-24`（大方块）
- 4 名玩家水平排列，每人 `max-w-[100px]` + 大卡图
- 关键词在一整行中展示
- 三段分离导致视口被占满，操作区推到底部

修复：
- 社区词改为紧凑 chip 标签，一行排开
- 玩家改为 2×2 网格，卡图缩小到 `w-14`
- 关键词缩小为小标签仅显示匹配状态
- 布局统一，操作区固定在底部

### ⚠️ W3. `_next_round_phase` 中传参 `game` 为旧连接获取

`player_action` 中 `_next_round_phase(game)` 传入的 `game` 是从函数顶部获取的 dict。如果在此之前有其他路由修改了同一局的数据，`game` 中的信息（如 round, revealed_mask）可能已过期。

但当前逻辑中 `_next_round_phase` 只读取 `game["round"]` 和 `game["revealed_mask"]` 来计算新值，并用 `game["id"]` 作为 WHERE 条件。由于 `@locked` 保证了单线程执行，这一局在 `player_action` 执行期间不会被其他请求修改，所以实际无风险。

### ⚠️ W4. AI 决策将 "call" 降级为 "check"

当 `current_bet == 0` 时，AI 若返回 `action: "call"`，代码将其记录为 `check`：

```python
if current_bet == 0:
    _record_action(game_id, ai["id"], "check", 0, round_num)
else:
    _record_action(game_id, ai["id"], "call", current_bet, round_num)
```

语义上正确（无需跟注时 call = check），但 AI 决策引擎中 `"call"` 和 `"check"` 的返回值混用，可统一为 `"check"` 以避免困惑。

### ⚠️ W5. `compute_showdown` 与 `_run_showdown` 的 showdown 数据重复构建

`_run_showdown` 在更新数据库状态后调用 `get_game_state(game_id)`，后者内部调用 `_compute_showdown` 生成 showdown 数据。随后 `_run_showdown` 又用自己的逻辑覆盖 `result_state["showdown"]`。两处构建逻辑几乎相同，可合并。

---

## 4. 代码质量观察

### 👍 优点

- **日志模块解耦清晰**：`log_config.py` 独立于业务代码，通过 `get_logger("模块名")` 获取带模块名的子 logger
- **修复彻底**：stale players 问题从根上解决（AI 循环后重新 fetch），而非 patch
- **API 向前兼容**：showdown 新增 `card_png`、`folded` 字段为可选追加，旧前端不会崩溃
- **UI 信息密度提升**：摊牌从纵向 400px+ 堆叠压缩为 4 格网格 (<200px)，一屏可见全部信息

### 🤔 可改进

- **AI 出牌日志**：目前只记录 AI 做了什么动作，不记录 AI 决策的理由（匹配数、随机概率）。调试时可加 `logger.debug`
- **摊牌动画**：目前从对局直接切换到摊牌结果，缺少过渡。可增加卡牌翻转动画
- **公共词发音**：对局中公共词 chip 有点击发音按钮，摊牌结果中的公共词回顾没有发音功能

---

## 5. 修复优先级

| 优先级 | 问题 | 操作 |
|--------|------|------|
| P0 | B1 communityWords 未解构 | 已修复 |
| P0 | B2 日志路径错误 | 已修复 |
| P0 | B3 弃牌玩家不包含在摊牌中 | 已修复 |
| P1 | W1 摊牌 UI 冗余 | 已修复 (4列网格) |
| P1 | W2 对局中 UI 臃肿 | 已修复 (2×2网格+chip) |
| P2 | W4 AI call/check 混用 | 后续迭代 |
| P2 | W5 showdown 重复构建 | 后续迭代 |

---

## 6. 提交范围

本次提交包含所有 P0/P1 修复：

- `backend/app/log_config.py` — 新增日志模块
- `backend/app/main.py` — 日志初始化 + 全局异常日志 + print→logger
- `backend/app/database.py` — print→logger
- `backend/app/config.yaml` — 日志配置 + 抽卡 300→1
- `backend/app/routers/stats.py` — 根路由防 404
- `backend/app/services/poker_service.py` — stale players bug + all-fold bug + 全链路日志 + 摊牌全玩家数据 + card_png
- `frontend/src/components/Sidebar.tsx` — 游戏→听了个听
- `frontend/src/lib/api.ts` — showdown 类型增加 card_png, folded
- `frontend/src/views/PokerGameView.tsx` — UI 重设计 + communityWords 解构修复
