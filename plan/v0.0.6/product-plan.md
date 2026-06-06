# 产品计划 — 英语听力 App `v0.0.6`

> 继承自 [v0.0.5](../v0.0.5/product-plan.md) · 基于 [v0.0.5 评审报告](../v0.0.5/review-report.md)
>
> **v0.0.6 主题：代码架构优化（零功能变更）**

## 目标

不添加任何新功能，纯粹优化代码架构：消除重复、提升性能、增强类型安全、改善可维护性。

---

## 后端优化

### 1. 数据库连接单例化

> **问题**：`get_conn()` 每次请求新建连接，高并发下频繁 open/close 文件。

- [ ] 改为模块级单例连接，`init_db()` 时创建，复用至进程退出
- [ ] 连接异常时自动重连

### 2. 单词 API 缓存

> **问题**：`words.py` 每次请求遍历全部 18 个课程 JSON（~2MB），O(n) 构建词表。

- [ ] 启动时预计算词表索引，存入内存缓存
- [ ] 搜索改为对缓存的 O(1) 查找
- [ ] 课程 JSON 变更时自动刷新缓存（watchdog 或手动触发）

### 3. 统计 streak 算法优化

> **问题**：`streak_days` 从今天往前逐日 SQL 查询，最多 365 次。

- [ ] 改为单次 SQL 查询全部有记录日期，前端计算连续天数

### 4. 全局异常处理中间件

> **问题**：API 异常直接返回 500 HTML，前端收到非 JSON 无法解析。

- [ ] FastAPI exception handler 统一返回 `{"error": str(e)}` JSON
- [ ] 区分 4xx（参数错误）和 5xx（服务端错误）

### 5. 代码整洁

- [ ] `services/__init__.py` `get_stats()`：`import re` 移到文件顶部
- [ ] `word_occurrences` 表不存在的 fallback 逻辑统一
- [ ] 移除 `backend/app/package.json` / `package-lock.json`（误入）

---

## 前端优化

### 6. API 客户端层统一

> **问题**：23 处散落的 `fetch()` 调用，无公共错误处理、无请求去重、URL 硬编码。

- [ ] 创建 `lib/api.ts`，集中全部 API 调用
- [ ] 每个 API 函数返回 typed response
- [ ] 统一 `.catch()` → toast 错误提示
- [ ] 消除 `fetch lesson → playLesson` 的 4 处重复（提取为 `playLessonById(id)` ）

```typescript
// lib/api.ts
export async function getOverview(): Promise<Overview> { ... }
export async function getDailyTime(days: number): Promise<DailyDay[]> { ... }
export async function getDictationRecords(limit: number): Promise<AudioGroup[]> { ... }
// ... 所有 API 调用集中于此
```

### 7. 消除 `any` 类型

- [ ] `clipsStore.ts:4` `apiClipsToAudioClips(items: any[])` → 定义 `ClipApiRow` 接口
- [ ] `App.tsx:51,59` `activeSection as any` → 改用正确的 `NavSection` 类型

### 8. audioStore 拆分

> **问题**：300 行，混合了 Audio 元素管理、播放控制、历史追踪、句子导航。

- [ ] 提取 `audioEngine.ts`：Audio 元素生命周期 + `switchSource` + `waitForReady`
- [ ] `audioStore.ts` 保留 Zustand state + public actions
- [ ] `playHistory.ts`：`_trackStart` + `flushTrack` 独立模块

### 9. 大组件拆分

| 组件 | 行数 | 拆分方案 |
|---|---|---|
| `StatsView.tsx` | 272 | 5 个子组件已是内部定义 → 提取为独立文件 |
| `DictationView.tsx` | 249 | 提取 `SentenceSelector`、`TypingPhase`、`FeedbackPhase` |
| `DictationHistoryView.tsx` | 237 | 提取 `AudioGroupCard`、`SentenceRow` |
| `WordsView.tsx` | 231 | 提取 `WordRow`、`SearchBar`、`Pagination` |
| `PlayerBar.tsx` | 219 | 提取 `ProgressBar`、`PlayControls`、`SpeedSelector` |

### 10. 错误边界

- [ ] `<ErrorBoundary>` 包裹 `<App />`，渲染失败时显示友好提示 + 刷新按钮

### 11. TypeScript 严格模式

- [ ] `tsconfig.json` 开启 `"strict": true`
- [ ] 修复所有 strict 错误（主要是 null check）

---

## 不变更

- ❌ 不添加新功能
- ❌ 不改变 UI 外观
- ❌ 不修改数据库 schema
- ❌ 不改变 API 端点路径或响应格式

---

## 里程碑

| 里程碑 | 内容 |
|---|---|
| M1 | 后端 5 项全部完成 |
| M2 | 前端 6-8 项（API 层 + any 消除 + audioStore 拆分） |
| M3 | 前端 9-11 项（组件拆分 + error boundary + strict） |

## v0.0.5 → v0.0.6 对比

| 维度 | v0.0.5 | v0.0.6 |
|---|---|---|
| 数据库连接 | 每次请求新建 | 单例复用 |
| 单词查询 | 每次遍历全部 JSON | 内存缓存 |
| streak 计算 | 逐日 SQL 循环 | 单次查询 |
| API 调用 | 23 处散落 fetch | 统一 api.ts |
| any 类型 | 3 处 | 0 处 |
| audioStore | 300 行单体 | 3 模块 |
| 大组件 | 5 个 >200 行 | 拆分为 15+ 子组件 |
| 错误处理 | 无边界 | ErrorBoundary + 统一 toast |
| TypeScript | 非 strict | strict: true |
