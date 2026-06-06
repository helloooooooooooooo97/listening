# v0.0.5 评审报告

> 日期：2026-06-06 · 主题：后端完善 + 课程导入 + 进度统计
>
> 评审范围：`HEAD` vs `v0.0.4` (1ced1fc)

## 📊 变更概览

| 维度 | 数据 |
|---|---|
| 修改文件 | 20 files |
| 新增代码 | +686 / -187 |
| 新增文件（tracked） | backend: database.py, routers/{clips_api,progress_api,stats_api,words}.py; frontend: StatsView.tsx, DictationHistoryView.tsx |
| 新增课程数据 | 13 个 IELTS 课程 JSON |
| 删除 | DictationPanel.tsx（已回退：改为嵌入式视图） |

---

## 🎯 计划 vs 交付

| 计划项 | 状态 | 说明 |
|---|---|---|
| 🔴 P0 单词 API 后端化 | ✅ 完成 | `GET /api/words` 含搜索/排序/分页 |
| 🔴 P0 课程导入 UI | ❌ 未做 | 仅手动导入 13 个 IELTS JSON（tools/ 脚本产出） |
| 🔴 P0 学习进度统计 | ✅ 完成 | StatsView + 6 个 API 端点 + 控制面板 |
| 🟡 P1 全局错误处理 | ⚠️ 部分 | Toast 组件存在但未全局集成；无 ErrorBoundary |
| 🟡 P1 听写增强 | ✅ 超预期 | 句子选择器 + 跳过/切换 + 详细历史面板 + 逐句播放 |
| 🟡 P1 设置扩展 | ✅ 完成 | 播放速度/循环/主题/快捷键提示 |
| 🟡 P1 骨架屏 | ❌ 未做 | 未新增 Skeleton 组件 |
| 🟢 P2 跟读模式 | ❌ 未做 | — |
| 🟢 P2 移动端响应式 | ❌ 未做 | — |

**总体完成度**：P0 2/3，P1 2.5/4，P2 0/3。核心统计和听写增强超预期，课程导入 UI 是最大缺口。

---

## 🏗️ 架构评审

### 后端 — SQLite 持久化 ✅ 良好

```
backend/app/
├── database.py          # SQLite 连接 + 自动建表 + 迁移
├── routers/
│   ├── clips_api.py      # 片段 CRUD (SQLite)
│   ├── progress_api.py   # 播放历史 + 听写记录 + 单词进度
│   ├── stats_api.py      # 统计聚合 (6 endpoints)
│   └── words.py          # 单词列表 API
```

**好评**：
- SQLite 取代 localStorage 作为持久层，数据结构清晰（5 张表 + 索引）
- 迁移机制实用：`try ALTER TABLE` 容错已存在列
- API 设计 RESTful，query parameter 做分页/排序/过滤

**关注点**：
1. `database.py` 每次请求 `get_conn()` 新建连接 — 高并发下会频繁打开/关闭文件。建议后续引入连接池或单例复用。
2. `words.py` 每次请求遍历全部课程 JSON 文件构建词表 — 14 节课时还行，100+ 节课时应缓存或预建索引表。
3. `stats_api.py` 中 `streak_days` 循环查询每一天 — 连续 365 天无记录会执行 365 次 SQL。建议用窗口函数或先查有记录的所有日期再计算。

### 前端 — 状态管理 ✅ 良好

```
新增:
├── views/StatsView.tsx          # 统计面板（概览卡片 + 图表区 + 进度列表 + 活动时间线）
├── views/DictationHistoryView.tsx  # 听写历史（按课程分组 + 展开详情 + 逐句播放）
├── stores/dictationStore.ts     # 扩展：prevSentence / goToSentence / skip
```

**好评**：
- 听写状态管理扩展干净，`goToSentence` 正确处理 scores 截断
- StatsView 数据 fetching 清晰（5 个并行 fetch）
- DictationHistoryView 使用 `lessonCache` useRef 避免重复 fetch

**关注点**：
1. DictationView 中 `handleSubmit` 用 `setTimeout(100ms)` 等 store 更新后再 POST — 有竞态风险。建议改为在 `submit()` 中返回 score 后直接 POST。
2. StatsView 5 个并行 fetch 无 `Promise.allSettled` — 任一失败不会阻塞整体，但也没有重试或降级展示。

---

## 🔍 代码质量逐项评审

### 1. Makefile — `clear` 目标

```makefile
clear:
	@echo "⚠️  即将清空数据库: backend/data/app.db"
	@rm -f backend/data/app.db
	@echo "✅ 数据库已删除，重启后端将自动重建空数据库"
```

✅ 简洁有效。无确认步骤（用户明确要求 `make clear` 即执行，合理）。

### 2. 听写 Store 扩展 (`dictationStore.ts`)

```typescript
prevSentence: () => set(s => {
    if (s.sentenceIndex <= 0) return {};
    const newScores = s.scores.slice(0, -1);
    return { ... };
}),
skip: () => set(s => ({
    scores: [...s.scores, 0],  // ← 记 0 分
    ...
})),
```

✅ `prevSentence` 正确移除最后一条得分。`skip` 记 0 分逻辑合理。
⚠️ `goToSentence` 向前跳转后再次 `prevSentence` 会丢失最后得分（scores 截断到 `idx`）。这在重新听写场景下是预期行为，但需在 UI 中提示用户"跳转会丢弃已有得分"（当前未提示）。

### 3. DictationView — 句子选择器

```tsx
<button onClick={() => setShowSelector(!showSelector)}>
  第 {sentenceIndex + 1}/{sentences.length} 句
  <HiChevronDown ... />
</button>
{showSelector && (
  <div className="absolute ... max-h-64 overflow-y-auto ...">
    {sentences.map(...)}
  </div>
)}
```

✅ 下拉菜单设计好：完成句显示分数颜色，低分标注"需复习"，当前句高亮。绝对定位 + z-50 不会影响布局。
⚠️ 点击菜单外部不会关闭 — 建议添加 `useEffect` + document click listener 或使用 `<dialog>` / onBlur。

### 4. DictationHistoryView — 详细记录展示

```tsx
// 按课程分组 → 点击展开 → 逐句显示：
//   得分 | 正确文本（绿）| 你的输入（红/划线）| 日期 | ▶播放
```

✅ 信息架构清晰。颜色编码一致（绿/黄/红）。逐句播放使用 `lessonCache` ref 避免重复 fetch。
⚠️ `playSentence` 中先 `playLesson(lesson)` 再 `setTimeout(seek, 150)` — 依赖经验值延时，不同网络/设备可能不够。建议改为监听 audio `canplay` 事件后再 seek。

### 5. StatsView — 统计面板

```tsx
const [tab, setTab] = useState<'7d'|'30d'>('7d');
// 5 个并行 fetch: overview / daily-time / dictation-trend / lesson-progress / recent-activity
```

✅ 概览卡片设计好，柱状图纯 CSS 实现（无依赖），活动时间线按类型分组显示图标。
⚠️ 柱状图高度用 `style={{ height: ${pct}% }}` 计算 — 当 `maxSeconds` 为 0 时除零风险（当前已用 `Math.max(1, ...)` 防御）。
⚠️ `recent-activity` 返回 type 为 `play|dictation|clip|word`，但前端未对不同 type 做视觉区分（全部显示相同样式）。

### 6. 播放历史自动记录 (`audioStore.ts`)

```typescript
function flushTrack() {
  const elapsed = Math.round((Date.now() - _trackStart) / 1000);
  if (elapsed < 1) return;  // ← 过滤 <1 秒的播放
  fetch('/api/progress/play-history', { method: 'POST', ... })
}
```

✅ 非侵入式埋点：play/pause/ended/src 切换均触发 `flushTrack`。
⚠️ `_trackStart` 是模块级变量，多标签页同时打开会互相覆盖（但 Single Audio 模式下通常只有一个标签页在播放，实际影响小）。

### 7. 单词 API (`words.py`)

✅ 搜索/排序/分页齐全。`_clean()` 去除标点做归一化。
⚠️ 全量加载所有 JSON 到内存构建 word_map — 每节课约 500-1000 词，14 节课约 1-2MB。100 节课时建议改预计算索引。
⚠️ 搜索未做索引 — `if q not in word` 是 O(n) 遍历。建议后续用 SQLite FTS 或预建反向索引。

---

## 🐛 发现的 Bug

### B1. 跳过句子的后端记录问题
`DictationView` 中点击「跳过」调用 `skip()` 但不触发 POST 到 `/api/progress/dictation`。跳过句不会记录到数据库，历史面板中看不到跳过的句子。

**严重程度**：中等 — 不影响功能但数据不完整。

**修复建议**：`skip()` 中增加 fetch POST（score=0, user_input=''）。

### B2. showSelector 不关闭
句子选择器展开后，点击页面其他区域不会收起。用户必须再次点击标题才能关闭。

**严重程度**：低 — 体验问题，不影响功能。

**修复建议**：添加 `useEffect` 监听 document click 或使用 onBlur。

---

## 📈 量化评估

| 维度 | 评分 | 说明 |
|---|---|---|
| 功能完整性 | ⭐⭐⭐⭐ | P0 核心功能交付，课程导入 UI 缺失 |
| 代码质量 | ⭐⭐⭐⭐ | TypeScript 类型安全，无编译错误，命名规范 |
| 架构设计 | ⭐⭐⭐⭐ | SQLite 持久化清晰，API RESTful，状态管理合理 |
| 用户体验 | ⭐⭐⭐⭐⭐ | 听写增强超预期，统计面板直观，历史面板信息丰富 |
| 错误处理 | ⭐⭐⭐ | Toast 存在但覆盖不全，无 ErrorBoundary |
| 可维护性 | ⭐⭐⭐⭐ | 代码结构清晰，迁移机制好，注释充分 |

**综合评分：4.0/5.0**

---

## 🔧 建议改进项

### 高优先级
1. **补充跳过句的 POST 记录** — 在 `dictationStore.skip()` 或 DictationView 中增加 fetch
2. **修复 showSelector 不关闭** — 添加点击外部关闭逻辑
3. **`playSentence` 延时优化** — 改为事件驱动（audio canplay）+ 兜底超时

### 中优先级
4. **单词 API 缓存** — 课程 JSON 变化不频繁，加 5 分钟内存缓存
5. **stats_api streak 优化** — 先查有记录日期再计算连续天数，避免循环 SQL
6. **StatsView 活动类型视觉区分** — 不同 icon/颜色代表 play/dictation/clip/word

### 低优先级
7. **ErrorBoundary** — 包裹 App 根组件防止白屏
8. **Skeleton 组件** — 首页和统计页加载骨架屏
9. **连接池** — `get_conn()` 改为单例或连接池

---

## ✅ 准出建议

**建议通过**，可以进入 v0.0.6。高优先级 3 项建议在 v0.0.6 首日修复，其余按优先级排期。

---

*评审人：Claude Code · 2026-06-06*
