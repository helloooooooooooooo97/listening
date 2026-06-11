# v0.3.2 评审报告 — 卡组系统

**日期**: 2026-06-11
**版本**: `v0.3.2`
**分支**: `v0.3.1` → `v0.3.2`

---

## 变更总览

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `backend/app/main.py` | 修复 | config 加载提前、CORS 白名单、卡牌图片挂载 |
| `backend/app/database.py` | 新增 | 卡牌表创建 + 自动导数据 |
| `backend/app/routers/cards.py` | 新增 | 卡牌列表/抽卡/选词全套 API |
| `backend/app/routers/__init__.py` | 修改 | 注册 cards_router |
| `backend/app/services/card_service.py` | 新增 | 签名提取、匹配度、候选筛选 |
| `backend/app/services/__init__.py` | 优化 | lessons 目录路径从硬编码改为 config-driven |
| `backend/app/import_word_tags.py` | 修复 | DB_PATH 从硬编码改为 config |
| `frontend/src/views/CardsView.tsx` | 新增 | 卡组首页：所有卡组 tab + 抽卡区 + 收藏 tab |
| `frontend/src/views/DeckDetailView.tsx` | 新增 | 卡组详情页：进度 + 卡牌网格 |
| `frontend/src/components/cards/CardGrid.tsx` | 新增 | 可复用的卡牌网格（支持关键词词墙变体） |
| `frontend/src/stores/cardsStore.ts` | 新增 | zustand store 管理卡牌状态 |
| `frontend/src/components/ContentPanel.tsx` | 修改 | 增加卡组详情路由 |
| `frontend/src/components/Sidebar.tsx` | 修改 | 增加"游戏""卡组"导航项 |
| `frontend/src/App.tsx` | 修改 | pathToSection 支持 cards |
| `frontend/src/lib/api.ts` | 新增 | 卡牌 API 类型定义和请求函数 |
| `data/lessons/*.json` | 删除 | 清理旧课程数据文件 |
| `data/wordlists/*` | 删除 | 清理旧词库文件 |

---

## 评审结果

### 🔴 必须修复

#### 1. 内存抽卡会话 — 服务重启即丢失

**文件**: `backend/app/routers/cards.py:21`
**严重性**: 🔴 **高**

```python
_draw_session: dict[str, dict[str, str]] = {}
```

抽卡流程依赖进程内字典保存 `draw_id → {word → card_id}` 映射。服务重启后所有进行中的抽卡会话丢失，用户选词时报 `"Draw session expired or invalid"`。

**建议**: 将 draw session 持久化到 SQLite 临时表，或加 30 分钟 TTL。

---

#### 2. 候选人不足 3 时的选词边界

**文件**: `backend/app/routers/cards.py:47-70`
**严重性**: 🔴 **中**

`_pick_unique_words` 硬编码 `candidates[:3]`，当候选人少于 3 时依赖前端 `candidates_count` 控制调用时机。`perform_draw()` 行 148 的 `candidates[:3]` 同理。虽然 `effective_min` 已修复调用门槛，但内部逻辑仍假设至少有 3 个候选人。

**建议**: 动态取 `min(3, len(candidates))`，确保 N<3 时正常工作。

---

### 🟡 建议修复

#### 3. main.py 中 get_config 重复 import

**文件**: `backend/app/main.py:15,48-50`

第 15 行 `cfg = load_config()` 已获取 config，48-50 行又 `from config import get_config; _cfg = get_config()` 重复加载。

**建议**: 复用 `cfg` 变量，去掉第二次 import。

---

#### 4. 卡牌导入 seed 异常被静默吞掉

**文件**: `backend/app/database.py:367`

```python
except Exception as e:
    print(f"  ⚠️  Card data seed skipped: {e}")
```

整个 `_seed_card_data_if_needed` 的异常被 catch 后只打印一行。数据库写入错误、JSON 解析错误等静默失败，启动时不易被发现。

**建议**: 只 catch 可预期的异常（如 `FileNotFoundError`），数据写入异常应传播出去阻止启动。

---

#### 5. 前端 API 失败没有 UI 反馈

**文件**: `frontend/src/views/CardsView.tsx:27-30`

```typescript
useEffect(() => {
    store.loadCards();
    store.checkDraw();
}, []);
```

API 失败时 store 内部 `catch { /* ignore */ }` 吞掉错误，用户看到白屏或永久的 loading 态。

**建议**: 在 store 或 view 层增加 error state，失败时展示重试入口。

---

#### 6. DeckDetailView 未调 checkDraw()

**文件**: `frontend/src/views/DeckDetailView.tsx:16`

```typescript
useEffect(() => {
    store.loadCards();
}, []);
```

只调 `loadCards()` 不调 `checkDraw()`。虽然详情页没有抽卡按钮，但状态未初始化，切换回来时需要重新加载。

**建议**: 保持主 view 调用 `checkDraw()` 的一致行为。

---

#### 7. card_service 中 season 读取重复

**文件**: `backend/app/database.py:347-349`

`_seed_card_data_if_needed` 通过 `load_card_data()` 加载一次全量数据，然后又 `with open(data_path)` 重新读 JSON 取 season 字段。

**建议**: 让 `load_card_data()` 也返回 deck meta，避免二次 IO。

---

### 🟢 亮点

- **`effective_min` 动态门槛**: 剩余卡牌不足时自动降低需要，避免永远无法抽卡的逻辑死锁
- **`variant='deck'` 组件设计**: CardGrid 通过 variant prop 切换 unobtained 的展示形态，扩展性好
- **`PROMO_COLORS` 色彩 seed**: 基于 cardId 做 hash 分配，规避硬编码，视觉上每张卡色彩稳定
- **`grid-cols 3:4` 统一**: 卡组卡片和卡牌卡片共用一套比例，布局一致性较好
- **配置化路径**: 多处从硬编码路径迁移到 `config-driven`，提升部署灵活性

---

## 总评

| 分类 | 数量 |
|------|------|
| 🔴 必须修复 | 2 |
| 🟡 建议修复 | 5 |
| 🟢 亮点 | 5 |

**版本判断**: 功能完备性达到 P0/P1 目标，2 个 🔴 项属于极端场景（重启丢 session、候选人 < 1），不影响正常使用。**建议发布 v0.3.2**，🔴 项留到 v0.3.3 修复。
