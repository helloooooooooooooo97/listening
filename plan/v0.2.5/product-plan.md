# v0.2.5 Product Plan — 单词复习系统 + API 迁移收尾

> 目标：学习工具箱 + 后端架构迁移收尾

---

## 一、总览

| 维度 | 占比 | 内容 |
|------|------|------|
| 功能 | 60% | 单词复习系统、听写错词高亮、首页增强 |
| 技术 | 40% | progress/stats/import API 迁移、死代码清理、API 客户端类型 |

---

## 二、功能

### 2.1 单词复习系统

**现状：** 只有"标记掌握"（`known=True/False`），没有区分"学过但需复习"的状态。

**改动：**

- `word_progress` 表扩展 `last_score` 列 — 记录最近一次复习得分
- `ProgressRepository` 新增方法：
  - `add_review(word, score)` — 记录复习
  - `get_due_words(limit)` — 按 低分优先 → 长时间未复习优先 排序
  - `get_due_words_count()` — 首页卡片用
- API 端点：
  - `POST /progress/words/review`
  - `GET /progress/words/due`
  - `GET /progress/words/due-count`
- 前端 `WordsView` 筛选增加"待复习"模式，显示每个单词的得分，hover 出现"复习"按钮
- 前端 `HomeView` 增加渐变紫色待复习卡片，点击跳转单词页

### 2.2 听写错词高亮

**现状：** 后端 `dictation-sentences` API 已返回 `wrong_indices`，前端未消费。

**改动：**

- `TranscriptView` 渲染单词时检测 `sentData?.wrong_indices?.includes(wordIdx)`
- 错词通过 CSS class `dictation-wrong` 显示为红色波浪下划线 + 浅红背景

### 2.3 首页增强

- 新增待复习卡片（线性渐变紫色背景）显示待复习单词数
- 点击跳转 `/words` 页

---

## 三、后端 API 迁移收尾

### 已完成迁移（v0.2.4）

| 模块 | Repository | Router |
|------|-----------|--------|
| Clips | `ClipRepository` | `routers/clips.py` |
| Favorites | `FavoriteRepository` | `routers/favorites.py` |
| Collections | `CollectionService` | `routers/collections.py` |
| Translation | `TranslationRepository` | `routers/translation.py` |

### v0.2.5 完成迁移

| 旧文件 | 新文件 | 方案 |
|--------|--------|------|
| `progress_api.py` | `routers/progress.py` | 复用 `ProgressRepository`，Depends 注入 |
| `stats_api.py` | `routers/stats.py` | 保留直接 SQL（聚合查询复杂），增加 `due_words` 字段 |
| `import_api.py` | `routers/import_route.py` + `services/import_service.py` | 逻辑抽到 service，router 只做 HTTP |

### 死代码清理

| 文件 | 原因 |
|------|------|
| `collections_api.py` | 已被 `routers/collections.py` 替代 |
| `favorites_api.py` | 已被 `routers/favorites.py` 替代 |
| `clips_api.py` | 已被 `routers/clips.py` 替代 |

---

## 四、Bug 修复

| 问题 | 根因 | 修复 |
|------|------|------|
| **单词页闪屏** | skeleton 网格 DOM 置换 + observer 依赖 11 个 state 导致重建循环 | 去掉 skeleton 用 mini spinner；callback ref 替代 useEffect observer |
| **无限滚动失效** | loader 元素首次渲染时不在 DOM，effect 无法绑定 | callback ref 元素挂载时自动创建 observer |
| **中文翻译不显示** | auto-translate effect 有 `!hasProvider` 守卫，即使后端 DB 有缓存也跳过 | 移除守卫，`aiStore.translate()` 始终先查后端缓存再调 AI |
| **合集详情崩溃** | `CollectionDetailView` 缺少 `useMemo` 导入 | 补 import |
| **单词 API 慢** | 列表 API 返回完整 `occurrences` 数组 | 轻量响应 `{word, count}`，详情按需加载 |
| **翻译路由 404** | `POST /api/translations/` 带斜杠/不带斜杠不一致 | 补充 `@router.post("")` |

---

## 五、验证

- Backend: `PYTHONPATH=app python3 -c "from app.main import app"` ✅
- Routes: 46 条 API 路由全部正常注册 ✅
- Frontend: `cd frontend && npx tsc --noEmit` 无错误 ✅
