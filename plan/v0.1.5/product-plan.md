# v0.1.5 产品计划 — 合集功能

**日期**: 2026-06-07
**主题**: 添加"合集"（Collection）功能 — 将零散的学习内容组织为可播放的集合，支持动态自动聚合与手动创建。

> **说明**：原 v0.1.5 计划（播放控制增强/收藏 tab 改进/快捷操作/睡眠定时）已被此计划替代。合集功能的优先级更高，且会一并覆盖原计划的收藏 tab 交互改进。

---

## 一、什么是"合集"

合集是一组可播放内容的具名集合。与现有一维"播放队列"区别：

| 维度 | 播放队列 (Queue) | 合集 (Collection) |
|------|------------------|-------------------|
| 生命周期 | 一次会话 | 持久化到数据库 |
| 来源 | 临时添加 | 动态聚合 / 手动搭建 |
| 排序 | 拖拽调整 | 按类型+时间 / 手动排序 |
| 复用 | 用完即弃 | 多次打开 |

**内置动态合集**（数据自动生成，只读）：
| 合集 | 数据来源 | 说明 |
|------|---------|------|
| ⭐ 我的收藏 | `favorites` 表 | 所有收藏的音频 + 片段 |
| 📅 今日练习 | `play_history` 当天记录 | 今天听过的音频列表 |
| ❌ 最近听写错句 | `dictation_history` 低分句 | 最近 score < 80 的句子（去重） |
| 🕐 最近播放 | `play_history` 最近记录 | 最近 N 个听过的音频 |
| 🔤 高频错词 | `dictation_history` 分析 | 听写中频繁出错的单词 |

**用户自定义合集**：
- 用户可以从"我的收藏"或其他来源选取内容，组建自定义合集
- 支持添加 audio / clip / sentence / word 四种类型
- 支持重命名、删除、手动排序

---

## 二、技术设计

### 2.1 数据库变更

在 `database.py` 末尾新增两张表：

```sql
-- 合集
CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'HiQueueList',
    color TEXT DEFAULT '#3b82f6',
    is_dynamic INTEGER DEFAULT 0,          -- 1 = 动态聚合，0 = 手动创建
    dynamic_type TEXT DEFAULT NULL,          -- 'favorites'|'today_practice'|'recent_dictation_errors'|'recent_plays'|'frequent_wrong_words'|null
    item_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 合集条目
CREATE TABLE IF NOT EXISTS collection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK(item_type IN ('audio','clip','sentence','word')),
    item_ref TEXT NOT NULL,                 -- 条目唯一引用 key
    lesson_id TEXT NOT NULL DEFAULT '',
    lesson_title TEXT DEFAULT '',
    title TEXT DEFAULT '',
    subtitle TEXT DEFAULT '',
    start_time REAL DEFAULT 0,
    end_time REAL DEFAULT 0,
    extra_data TEXT DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    added_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ci_collection ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_ci_ref ON collection_items(collection_id, item_ref);
```

启动时自动 seed 5 个内置动态合集（insert or ignore by dynamic_type）。

### 2.2 后端 API

新建 `backend/app/routers/collections_api.py`:

```
GET    /api/collections/                          → 列表（含 item_count）
POST   /api/collections/                          → 创建自定义合集
GET    /api/collections/{id}                      → 详情（已解析的 items）
PUT    /api/collections/{id}                      → 更新名称 / 图标 / 颜色
DELETE /api/collections/{id}                      → 删除合集 + 级联 items
POST   /api/collections/{id}/refresh              → 刷新动态合集（重新计算 items）
POST   /api/collections/{id}/items                → 添加 item
DELETE /api/collections/{id}/items/{item_id}      → 移除 item
PUT    /api/collections/{id}/items/reorder        → 批量重新排序
DELETE /api/collections/{id}/items                → 清空合集
```

**动态合集解析规则**（在 `refresh` 时执行）：

| dynamic_type | SQL 逻辑 |
|---|---|
| `favorites` | `SELECT item_id as item_ref, item_type, title, subtitle, extra_data FROM favorites WHERE item_type IN ('audio','clip') ORDER BY created_at DESC` |
| `today_practice` | `SELECT DISTINCT audio_id as item_ref, 'audio' as item_type, audio_title as title FROM play_history WHERE date(played_at)=date('now') ORDER BY played_at DESC` |
| `recent_dictation_errors` | `SELECT audio_id || ':' || sentence_index as item_ref, 'sentence' as item_type, audio_title as lesson_title, expected_text as title FROM dictation_history WHERE score < 80 GROUP BY audio_id, sentence_index HAVING MAX(created_at) ORDER BY created_at DESC LIMIT 100` |
| `recent_plays` | `SELECT audio_id as item_ref, 'audio' as item_type, audio_title as title FROM play_history GROUP BY audio_id ORDER BY MAX(played_at) DESC LIMIT 50` |
| `frequent_wrong_words` | `分析 dictation_history.user_input vs expected_text 找出跨多条记录都出错的单词` |

### 2.3 前端 Store

新建 `frontend/src/stores/collectionsStore.ts`：

```typescript
interface CollectionSummary {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_dynamic: boolean;
  dynamic_type: string | null;
  item_count: number;
  sort_order: number;
  created_at: string;
}

interface CollectionItem {
  id: number;
  collection_id: number;
  item_type: 'audio' | 'clip' | 'sentence' | 'word';
  item_ref: string;
  lesson_id: string;
  lesson_title: string;
  title: string;
  subtitle: string;
  start_time: number;
  end_time: number;
  extra_data: string;
  sort_order: number;
  added_at: string;
}

interface CollectionsState {
  collections: CollectionSummary[];
  currentCollection: { summary: CollectionSummary; items: CollectionItem[] } | null;
  loaded: boolean;
  loading: boolean;
  loadCollections: () => Promise<void>;
  loadCollection: (id: number) => Promise<void>;
  create: (name: string, icon?: string, color?: string) => Promise<CollectionSummary>;
  update: (id: number, data: Partial<CollectionSummary>) => Promise<void>;
  delete: (id: number) => Promise<void>;
  refresh: (id: number) => Promise<void>;       // 刷新动态合集
  addItem: (collectionId: number, item: ...) => Promise<void>;
  removeItem: (collectionId: number, itemId: number) => Promise<void>;
  reorderItems: (collectionId: number, orderedIds: number[]) => Promise<void>;
  clearItems: (collectionId: number) => Promise<void>;
}
```

### 2.4 前端 API 层

在 `frontend/src/lib/api.ts` 新增：

```typescript
// ── Collections ──
export interface CollectionSummary { ... }
export interface CollectionItem { ... }

export function getCollections(): Promise<CollectionSummary[]>
export function getCollection(id: number): Promise<{ ... }>
export function createCollection(data: { name; icon?; color? }): Promise<CollectionSummary>
export function updateCollection(id: number, data: Partial<CollectionSummary>): Promise<{ ok }>
export function deleteCollection(id: number): Promise<{ ok }>
export function refreshCollection(id: number): Promise<CollectionItem[]>
export function addCollectionItem(collectionId: number, data: { ... }): Promise<CollectionItem>
export function removeCollectionItem(collectionId: number, itemId: number): Promise<{ ok }>
export function reorderCollectionItems(collectionId: number, itemIds: number[]): Promise<{ ok }>
export function clearCollectionItems(collectionId: number): Promise<{ ok }>
```

### 2.5 前端视图

新增 2 个视图 / 1 个组件：

1. **`CollectionsView`** (`views/CollectionsView.tsx`)
   - 顶部：标题 + 创建合集按钮
   - 内置合集区域（卡片列表，带类型图标 + 数量）
   - 自定义合集区域（可编辑名称、删除）
   - 每个卡片点击 → 进入 `CollectionDetailView`
   - loading / empty / error 状态

2. **`CollectionDetailView`** (`views/CollectionDetailView.tsx`)
   - 头部：返回 + 合集名称 + 编辑/删除/刷新按钮
   - 动态合集：顶部提示"数据自动更新"
   - 条目列表：类似播放队列样式
     - 每行：类型图标 + 标题 + 副标题 + 时长
     - hover: 播放 / 移除
   - 底部固定：**播放全部**按钮（将所有条目加入播放队列）
   - loading / empty 状态

3. **`CollectionCard`** (可选拆分组件，或在 view 内联)
   - 合集卡片，带 icon + 名称 + 条目数
   - 动态合集额外显示 🔄 标记

### 2.6 导航集成

**`Sidebar.tsx`** 改动：
- 新增 `nav` 项：`['collections', '合集', HiCollectionIcon, 0]`
- `NavSection` 类型扩展 `'collections'`

**`MobileTabBar.tsx`** 改动：
- 空间有限 — 替换或折叠。建议替换"队列"为"合集"（队列在播放栏可访问）

**`ContentPanel.tsx`** 改动：
- 添加 `section === 'collections'` 分支

**`App.tsx`** 改动：
- collectionsStore 的初始化加载（初始化时 loadCollections）

### 2.7 现有功能集成

**播放栏集成**：
- 展开视图 header 添加"添加到合集"按钮（`+` 下拉选择合集）
- 片段/句子/单词 的 hover 菜单添加"加入合集"选项

**收藏 tab 改进**（原 P1 任务，并入此计划）：
- 在合集详情页中打开"我的收藏"动态合集，获得分组显示能力

**首页推荐**：
- 首页底部展示"学习合集"快捷入口卡片

---

## 三、任务拆分

### 🔴 P0 — 数据库 + 后端

- [ ] **3.1 数据库表**：`collections` + `collection_items` 建表 + seed 5 个动态合集
- [ ] **3.2 合集 API**：`collections_api.py` — CRUD + refresh + items 管理
- [ ] **3.3 动态解析逻辑**：5 种 dynamic_type 的 SQL 查询实现
- [ ] **3.4 注册路由**：在 `main.py` 中 include `collections_api` 路由

### 🔴 P0 — 前端基石

- [ ] **3.5 API 层**：`api.ts` 新增 collections 相关函数
- [ ] **3.6 Store**：`collectionsStore.ts` — 全部状态与方法
- [ ] **3.7 Type 扩展**：`types/lesson.ts` 新增 Collection 类型

### 🟡 P1 — 前端 UI

- [ ] **3.8 CollectionsView**：合集的列表页（内置 + 自定义）
- [ ] **3.9 CollectionDetailView**：合集详情页（条目列表 + 播放全部）
- [ ] **3.10 导航集成**：Sidebar / MobileTabBar / ContentPanel / App.tsx
- [ ] **3.11 创建合集**：弹窗输入名称 + 选择图标颜色
- [ ] **3.12 条目交互**：播放 + 移除 + 添加到队列

### 🟡 P1 — 集成 & 增强

- [ ] **3.13 收藏 tab 并入合集**：收藏页面改为打开"我的收藏"动态合集
- [ ] **3.14 播放栏快捷添加**：展开视图 → "添加到合集"按钮
- [ ] **3.15 动态合集自动刷新**：打开动态合集时自动 refresh（或缓存 5 分钟）
- [ ] **3.16 首页入口**：首页底部展示合集快捷卡片

### 🟢 P2 — 细节打磨

- [ ] **3.17 自定义合集编辑**：长按拖动排序
- [ ] **3.18 空状态引导**：每个动态合集首次打开时的说明
- [ ] **3.19 移动端适配**：合集页在手机上的布局
- [ ] **3.20 实时同步**：收藏/播放/听写产生新数据后，动态合集提示"有新内容"

---

## 四、不涉及

- ❌ 合集之间支持嵌套
- ❌ 合集合集分享/导出
- ❌ 复杂权限/多用户
- ❌ 音频/课程数据结构改动
- ❌ 听写模式核心逻辑改动

---

## 五、预估

| 优先级 | 模块 | 任务数 | 预估 |
|--------|------|--------|------|
| 🔴 P0 | 数据库 + 后端 | 4 | 1 天 |
| 🔴 P0 | 前端基石 | 3 | 0.5 天 |
| 🟡 P1 | 前端 UI | 5 | 1.5 天 |
| 🟡 P1 | 集成 & 增强 | 4 | 1 天 |
| 🟢 P2 | 细节打磨 | 4 | 1 天 |
| **合计** | | **20** | **5 天** |
