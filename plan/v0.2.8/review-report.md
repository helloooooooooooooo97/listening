# v0.2.8 Review Report — 单词词典表 + 考试标签

> 17 files changed, 1857 insertions(+), 329 deletions(-)
> 注：本次提交合并了 v0.2.6（今日听词系统）和 v0.2.8（词典表 + 考试标签）两部分工作。

---

## 核心变化

### 🎯 词典表 & 词库导入脚本（P0）

从 6 个开源考试词库下载、解析、聚合，建立统一词典查询。

| 文件 | 改动 |
|------|------|
| `backend/app/import_word_tags.py` | **新建** — 345 行词库导入脚本，未提交（untracked） |
| `backend/app/database.py` | 新增 `dictionary` 表（word PK, pronunciation, part_of_speech, definition, tags JSON） |

**支持的考试标签：**

| 标签 | 来源 | 词数（预估） |
|------|------|-------------|
| CET-4 | mahavivo/english-wordlists: CET4_edited.txt | ~4600 |
| CET-6 | mahavivo/english-wordlists: CET6_edited.txt | ~2200 |
| TEM-4 | 英语专业四八级词汇表.txt - TEM-8 | ~8800 |
| TEM-8 | 英语专业星标八级词汇.txt | ~4000 |
| IELTS | fanhongtao/IELTS: IELTS Word List.txt | ~3700 |
| TOEFL | mahavivo/english-wordlists: TOEFL.txt | ~4500 |

**合并规则：**
- 同一单词跨多个词库出现 → `tags` JSON 数组聚合
- 释义/音标/词性取第一个非空值（CET-4 优先）
- 运行方式：`cd backend && python3 -m app.import_word_tags`

**状态：** ⚠️ `import_word_tags.py` 已创建但未提交到 git；词典数据未导入（`dictionary` 表为空），需要手动运行导入脚本。

### 🎯 考试标签 API（P0）

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /api/dictionary/{word}` | 新增 | 返回 pronunciation / partOfSpeech / definition / tags |
| `GET /api/words` | 改造 | 返回值增加 `tags` 字段，新增 `exam` 查询参数 |
| `GET /api/words/{word}` | 改造 | 返回值增加 `tags` 字段 |

**`GET /api/words` 标签批量查询优化：**
```
1. 分页后，收集 page_words 列表
2. WHERE word IN (?,?,...) 一次批量查询 dictionary 表
3. json.loads(row["tags"]) 反序列化为 list
4. 合并到返回值：{"word": w, "count": c, "tags": [...]}
```

**`exam` 查询参数实现：**
```
LIKE '%"CET-4"%' 模糊匹配 → exam_words set → 交集过滤
支持单一考试筛选，不支持 OR 多选（计划中）
```

### 🎯 前端考试标签展示（P0）

**TagBadge 组件（内联于 WordsView）**

| 标签 | 颜色 |
|------|------|
| CET-4 | `bg-blue-500/15 text-blue-400` 🟦 |
| CET-6 | `bg-emerald-500/15 text-emerald-400` 🟩 |
| TEM-4 | `bg-purple-500/15 text-purple-400` 🟪 |
| TEM-8 | `bg-red-500/15 text-red-400` 🟥 |
| IELTS | `bg-orange-500/15 text-orange-400` 🟧 |
| TOEFL | `bg-pink-500/15 text-pink-400` 🩷 |

**单词列表行：**
```
abandon [CET-4] [CET-6] [IELTS]    5次  ☆
```
- 每个单词名称右侧显示所属考试标签气泡
- 多个标签水平排列

**单词详情面板：**
```
abandon  [CET-4] [CET-6]
/əˈbændən/  vt. 丢弃；放弃，抛弃
出现 5 次 · 覆盖 3 课时
```
- 标签 + 发音 + 词性 + 中文释义完整展示
- API 取数失败时降级显示 AI 分析（fallback）

**考试筛选器：**
- 筛选面板新增「按考试」分组，6 个标签按钮
- 点击切换 `examFilter` 状态，调用 `getWords({ exam })`
- 有 active filter 时显示清除按钮
- **未实现**：每个标签显示对应词数

---

## 文件变更清单

### 后端（4 文件，+191 / -0 行）

| 文件 | 行数 | 说明 |
|------|------|------|
| `backend/app/database.py` | +15 | `dictionary` 表定义 |
| `backend/app/import_word_tags.py` | +345 **(new, untracked)** | 词库导入脚本 |
| `backend/app/routers/words.py` | +78 / -33 | `GET /api/dictionary/{word}`、exam 参数、tags 批量查询 |
| — | — | 以下为 v0.2.6 内容（合并提交） |
| `backend/app/repositories/progress_repo.py` | +57 | listened_words 操作 |
| `backend/app/routers/progress.py` | +25 | daily-words API |
| `backend/app/services/collection_service.py` | +16 | today_words 动态合集 |
| `backend/app/text_utils.py` | +11 **(new)** | clean_word 工具函数 |

### 前端（5 文件，+847 / -295 行）

| 文件 | 行数 | 说明 |
|------|------|------|
| `frontend/src/views/WordsView.tsx` | +732 / -236 | TagBadge 组件、exam 筛选、词典详情面板、以及 v0.2.6 WordsView 重构 |
| `frontend/src/lib/api.ts` | +47 | `WordDictionary` 类型、`getDictionaryEntry()`、`WordSummary.tags`、`WordDetail.tags` |
| `frontend/src/stores/audioStore.ts` | +36 / -8 | 含 v0.2.6 trackPlay/flushTrack 改造 |
| `frontend/src/views/HomeView.tsx` | +46 / -15 | 含 v0.2.6 今日单词卡片 |
| `frontend/src/lib/playTracking.ts` | -30 | **(delete)** 合并到 audioStore |
| `frontend/src/components/TranscriptView.tsx` | +2 / -2 | 小幅修复 |
| `frontend/src/components/dictation/WordBadges.tsx` | +4 / -4 | 小幅调整 |
| `frontend/src/index.css` | +1 / -1 | 小幅调整 |

### 文档（3 文件，+787 行）

| 文件 | 说明 |
|------|------|
| `plan/v0.2.6/product-plan.md` | +376 |
| `plan/v0.2.6/review.md` | +123 |
| `plan/v0.2.7/product-plan.md` | +288 |

---

## 完成度评估

### 按 v0.2.8 计划对比

| 模块 | 计划内容 | 状态 | 说明 |
|------|----------|------|------|
| **二、数据来源** | 6 个词库下载解析合并 | ✅ | import_word_tags.py 完整实现，但数据未导入 |
| **三、词典表设计** | dictionary 表 | ✅ | 完全按计划建表 |
| **4.1 导入脚本** | download_text / parse / main | ✅ | 345 行，6 个解析器 + 聚合 + 入库 |
| **4.2 API 端点** | `GET /api/dictionary/{word}` | ✅ | 包含 clean_word 入参清理 |
| | `GET /api/words` 增加 tags | ✅ | batch query 优化 |
| | `GET /api/words` 增加 exam 参数 | ✅ | LIKE 模糊匹配 |
| | `GET /api/words/{word}` 增加 tags | ✅ | 单行查询 |
| | **exam 多选 OR** (exam=IELTS&exam=TOEFL) | ❌ 延后 | 当前只支持单一 exam 筛选 |
| **4.3a TagBadge 组件** | 6 色徽章 | ✅ | 内联实现 |
| **4.3b 单词列表标签** | 行内显示 tags 气泡 | ✅ |  |
| **4.3c 详情面板词典信息** | 发音/词性/释义 | ✅ | 带 fallback 至 AI 分析 |
| **4.3d 筛选「按考试」** | 考试筛选分组 | ✅ | 内联实现，缺词数统计 |
| | **FilterDrawer 独立组件** | ❌ 延后 | 与 v0.2.7 的 FilterDrawer 拆分同属一个任务 |
| **六、验证** | `npx tsc --noEmit` | ⏳ 未验证 |  |

### 累计 (v0.2.6 + v0.2.7 合并提交中)

本次提交同时包含了 **v0.2.6 今日听词系统**的全部内容：
- `listened_words` 表 + 播放埋点 + 上报
- WordsView 四 Tab 重构（今日单词 / 全部 / 待复习 / 已掌握）
- 今日复习弹窗（填空听写）
- HomeView 今日单词卡片
- flushTrack 标准化（合并 playTracking.ts → audioStore.ts）
- 多项 Bug 修复（标点、循环依赖、正则边界等）

以及 **v0.2.7** 部分内容：
- `safePlay` 浏览器兼容（bdccc9aa 独立提交）
- 播放列表状态持久化

### 未完成（后续版本）

| 未完成项 | 计划版本 | 优先级 |
|----------|----------|--------|
| `import_word_tags.py` 提交 + 手动运行一次导入数据 | v0.2.9 | P0 |
| 考试筛选显示各标签对应词数 | v0.2.9 | P1 |
| 考试筛选多选 OR（exam=IELTS&exam=TOEFL） | v0.2.9 | P1 |
| FilterDrawer 提取为独立组件 | v0.2.9 | P1 |
| 播放端「本课单词」面板 (PlaybackDetailTabs) | v0.2.7 未完成 | P0 |
| WordsView 拆分（WordList / ReviewModal / WordDetailPanel / FilterDrawer） | v0.2.7 未完成 | P1 |
| 每日单词目标设置 | v0.2.7 未完成 | P1 |
| flushTrack 防双发 `_trackFlushed` | v0.2.7 未完成 | P1 |
| 已掌握 Tab 无限滚动分页 | v0.2.7 未完成 | P1 |

---

## 架构评价

### 亮点

1. **导入脚本设计合理** — 6 个解析器各司其职，`defaultdict` 按 word 聚合，最后统一入库。支持断点续传（缓存已下载文件）。
2. **批量查询优化** — `WHERE word IN (...)` 一次查询替代 N 次单行查询，适合分页场景。
3. **数据与展示分离** — `tags` 作为 dictionary 表的元数据字段，不侵入已有 `word_progress` / `word_occurrences` 表。
4. **降级友好** — 词典查询失败时降级为 AI 分析，不影响核心单词功能。

### 可改进

1. **import_word_tags.py 未提交** — 未加入 git 追踪，需要 `git add` 后再运行导入。
2. **筛选内联** — TagBadge、exam 筛选器、FilterDrawer 都内联在 1002 行的 WordsView.tsx 中，模块化不足（与 v0.2.7 的拆分任务重叠）。
3. **dictionary 表无索引** — `tags LIKE '%..."%'` 走全表扫描，词库全量导入后（~28000 词）可能变慢。
4. **词库导入硬编码路径** — `DB_PATH` 直接指向 `data/audio.db`，当多环境或测试数据库时需手动修改。
5. **验证步骤未执行** — 未运行 `npx tsc --noEmit` 和 `python3 -m app.import_word_tags`。

---

## 数据流

```
用户操作                    后端处理                              前端展示
─────────                  ────────                              ────────
                            import_word_tags.py
                               ↓
                            download 6 word lists
                               ↓
                            parse & aggregate by word
                               ↓
                            INSERT OR REPLACE → dictionary 表
                               ↓
GET /api/dictionary/abandon → SELECT * FROM dictionary         发音 / 词性 / 释义 / 标签
                               ↓
GET /api/words?exam=CET-4  → SELECT word FROM dictionary        仅返回 CET-4 标签的单词
                               WHERE tags LIKE '%"CET-4"%'
                               ↓
                               WHERE word IN (...) → batch      每条返回 tags 数组
                               json.loads(tags)
                               ↓
GET /api/words/{word}      → SELECT tags FROM dictionary        WordDetail.tags
```
