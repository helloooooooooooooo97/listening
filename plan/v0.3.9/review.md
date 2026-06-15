# v0.3.9 Review — 单词难度分级 + 按难度筛选复习/游戏

> 分支: v0.3.1 → v0.3.9 | 后端 6 文件 + 前端 6 文件 | 核心目标: 为全量单词建立难度分，并在单词列表、待复习、听了个听中可筛选

---

## 一、变更概览

| 维度 | 文件 | 类型 |
|------|------|------|
| 后端 | `database.py` | schema — 新增 `word_difficulty` 表 |
| 后端 | `services/word_difficulty_service.py` | 新增 — 难度计算、读写、刷新 |
| 后端 | `routers/words.py` | API — `difficulty` 查询参数 + `/words/difficulty` 系列端点 |
| 后端 | `routers/progress.py` | API — 待复习词支持 `level` 筛选 |
| 后端 | `repositories/progress_repo.py` | 数据 — `word_difficulty` JOIN + 分级计数 |
| 后端 | `main.py` | 启动预热 — 单词播放句子缓存 + 难度缓存 |
| 前端 | `lib/api.ts` | 类型/API — 难度类型、查询方法、DueWord 扩展 |
| 前端 | `views/WordsView.tsx` | UI/功能 — 难度 badge、全部单词筛选、待复习筛选 |
| 前端 | `components/game/GameLevelSelect.tsx` | UI — 词汇难度筛选 |
| 前端 | `views/GameView.tsx` | 功能 — 按词源 + 难度取词 |
| 前端 | `stores/gameStore.ts` | 状态 — 保存本局 `difficultyFilter` |
| 前端 | `components/words/ReviewModal.tsx` | UI — 复习弹窗难度色点 |

---

## 二、后端实现

### 2.1 `word_difficulty` 表

新增表结构符合计划要求：

- `word TEXT PRIMARY KEY`
- `score REAL NOT NULL`
- `level TEXT CHECK(level IN ('easy','medium','hard'))`
- `freq` / `length` / `updated_at`
- `idx_wd_level` 支持按难度筛选

该表由 `init_db()` 创建，老数据库启动后会自动补表。

### 2.2 `WordDifficultyService`

新增 `backend/app/services/word_difficulty_service.py`，负责：

- 扫描全量 lesson JSON，统计每个 clean word 的出现频率
- 批量读取 `dictionary.tags`
- 按计划公式计算 `score`
- 按阈值归档 `easy` / `medium` / `hard`
- 写入 `word_difficulty`
- 提供 `ensure_computed()`、`compute_all()`、`get_word_difficulty()`、`get_words_by_level()`

本地 smoke test 结果：

| 项 | 结果 |
|----|------|
| 难度表生成数量 | `10013` |
| hard 总量 | `1093` |
| due hard 数量 | `2` |
| `apple` 难度 | `medium`, score `0.5208` |

> 注：`apple` 在当前本地语料中只有 7 次且词典无 tag，所以分到 medium；这符合当前数据输入，不代表通用英文难度。

### 2.3 Words API

`GET /api/words` 新增：

- `difficulty=easy|medium|hard`
- 返回字段 `difficulty_score` / `difficulty_level`

新增端点：

- `GET /api/words/difficulty`
- `GET /api/words/difficulty/{word}`
- `POST /api/words/difficulty/refresh`

### 2.4 Progress API

`GET /api/progress/words/due` 新增：

- `level=easy|medium|hard`

`GET /api/progress/words/due-count` 新增：

- `level=easy|medium|hard`

仓库层通过 `LEFT JOIN word_difficulty wd ON wd.word = wp.word` 返回：

- `difficulty_score`
- `difficulty_level`

### 2.5 启动预热

`main.py` startup 阶段现在会：

- 预热 `word -> 最佳播放句子` 内存缓存
- 确保 `word_difficulty` 已生成
- 日志输出缓存条目和耗时

这同时解决了此前“播放全部单词时 batch 接口十几秒才返回”的体验问题。

---

## 三、前端实现

### 3.1 API 类型

`frontend/src/lib/api.ts` 新增：

- `WordDifficultyLevel = 'easy' | 'medium' | 'hard'`
- `WordDifficulty`
- `getWordDifficulty()`
- `getWordDifficultyDetail()`
- `getDueWordsByLevel()`

并扩展：

- `WordSummary.difficulty_score`
- `WordSummary.difficulty_level`
- `DueWord.difficulty_score`
- `DueWord.difficulty_level`

### 3.2 WordsView

已实现：

- 全部单词列表展示 Easy / Medium / Hard badge
- 全部单词顶部新增难度筛选：全部 / 简单 / 中等 / 困难
- 待复习 Tab 顶部新增难度筛选
- 待复习筛选显示各档数量
- 待复习行展示难度 badge
- 复习完成后刷新当前难度筛选下的 due words

### 3.3 听了个听

`GameLevelSelect` 新增“词汇难度”筛选：

- 全部
- 简单
- 中等
- 困难

`GameView.handleStart()` 根据来源选择不同数据路径：

| 来源 | 无难度筛选 | 有难度筛选 |
|------|------------|------------|
| 今日单词 | `getTodayWords()` | `getWords({ collection: 'today_words', difficulty })` |
| 待复习 | `getDueWords(200)` | `getDueWords(200, difficulty)` |
| 全部单词 | 本地预加载 `allWords` | `getWords({ difficulty, limit: 500 })` |

`gameStore` 保存 `difficultyFilter`，重开同局时沿用。

### 3.4 ReviewModal

复习弹窗顶部展示当前词难度色点：

- Easy: emerald
- Medium: amber
- Hard: rose

---

## 四、验证结果

已执行：

```bash
python3 -m py_compile backend/app/database.py backend/app/main.py backend/app/routers/words.py backend/app/routers/progress.py backend/app/repositories/progress_repo.py backend/app/services/word_difficulty_service.py
npm run build
```

后端 smoke test：

```text
computed 10013
hard sample total 1093
due all count 119
due hard count 2
```

前端构建通过，`WordsView` / `GameView` bundle 正常生成。

---

## 五、发现的问题与修复

### ✅ 已修复：batch 单词句子接口返回空

根因：`words.py::_build_cache()` 没有声明 `global _cache_by_word`，导致反向索引未写回模块全局。

修复：

- `_cache_by_word` 正确全局写入
- 新增 `_best_sentence_cache_by_word`
- batch 接口改为 O(1) 从缓存取最佳句子

### ✅ 已修复：播放全部单词等待过久

根因：batch 接口此前对每个词临时扫描所有候选句子。

修复：

- 启动时预计算 `word -> 最佳播放句子`
- batch 只查内存缓存
- 实测预热后 200 词 batch 约 `0.0001s`

### ✅ 已修复：听了个听底部工具栏与播放栏重叠

根因：桌面端 `PlayerBar` 是 `fixed bottom-0`，`SlotBar` 没有预留高度。

修复：

- `GameView` 进行态和结束态底部增加 `md:pb-28`
- 只影响桌面端，移动端保持原布局

---

## 六、风险与建议

### R1. 难度公式依赖语料质量

当前难度主要由本地 lesson 频率决定。若语料偏 IELTS，常见词也可能因出现次数不高而偏难。

建议后续加入：

- 通用英文频率表
- CEFR 等级
- 用户历史错误率权重

### R2. 无 tag 单词默认 `exam_score=0.3`

这能避免无 tag 单词全部过低，但会让部分基础词被推到 medium。

建议后续根据词典覆盖率调整默认值，或对高频短词做额外 easy bias。

### R3. `compute_all()` 当前会 `DELETE` 后全量重写

当前数据量约 1 万词，成本可接受；未来词库显著扩大后可考虑增量更新。

### R4. Game 难度命名存在双重含义

听了个听现在同时有：

- 游戏关卡难度：简单 / 中等 / 困难
- 词汇难度：全部 / 简单 / 中等 / 困难

UI 已分区展示，但用户可能仍混淆。建议后续文案固定为“关卡难度”和“词汇难度”。

### R5. 本地 smoke test 更新了 `audio.db`

由于执行了 `compute_all()`，本地 `backend/app/data/audio.db` 和 WAL 文件发生变化。这是预期的数据写入，但提交前需确认是否纳入版本。

---

## 七、测试建议

| 场景 | 预期 |
|------|------|
| 首次启动后请求 `/api/words?difficulty=hard` | 返回 hard 单词，含 `difficulty_level` |
| 请求 `/api/words/difficulty?level=medium` | 返回 medium 列表和 total |
| 待复习选择“困难” | 只显示 hard due words，计数同步变化 |
| 全部单词选择“简单” | 列表刷新，只出现 easy 单词 |
| 听了个听选择“今日单词 + 困难” | 用 `today_words + hard` 作为词源，不足时提示换来源/降难度 |
| 听了个听选择“待复习 + 中等” | 只从 medium due words 开局 |
| 复习弹窗打开 | 当前词顶部显示对应难度色点 |
| 播放全部单词 | 队列应快速生成，不再等待十几秒 |
| 桌面端听了个听 | SlotBar/工具栏不与底部 PlayerBar 重叠 |

---

## 八、小结

v0.3.9 完成了从 **难度计算 → 后端 API → 前端展示 → 复习筛选 → 游戏筛选** 的主链路。

这个版本的价值不只是给单词打标签，而是让用户能主动选择练习强度：想快速过基础词可以选 easy，想冲刺 IELTS/TEM 难词可以直接进入 hard。后续若把错误率和通用词频加入公式，难度分会更贴近真实学习体验。
