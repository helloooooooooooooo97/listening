# v0.2.5 Review Report — 单词复习系统 + API 迁移收尾

> 学习工具箱 + 后端架构迁移收尾 + Bug 修复

---

## 一、目录结构（最终）

```
backend/app/
├── main.py                          # 不变
├── database.py                      # 增加 last_score 列 migration
│
├── models/                          # 不变（v0.2.4 已拆）
│
├── repositories/
│   ├── __init__.py
│   ├── clip_repo.py
│   ├── favorite_repo.py
│   ├── progress_repo.py             # 新增 add_review(), get_due_words(), 等
│   └── translation_repo.py
│
├── services/
│   ├── __init__.py
│   ├── collection_service.py
│   └── import_service.py            # **新建** — 从 import_api.py 抽出
│
└── routers/
    ├── __init__.py                  # 更新 import
    ├── clips.py
    ├── collections.py
    ├── favorites.py
    ├── import_route.py              # **新建** — 取代 import_api.py
    ├── progress.py                  # **新建** — 取代 progress_api.py
    ├── stats.py                     # **新建** — 取代 stats_api.py
    ├── translation.py
    └── words.py                     # 新增 GET /api/words/{word} 详情端点

frontend/src/
├── lib/api.ts                       # 新增 WordSummary/WordDetail, 复习 API, 类型增强
├── components/
│   ├── TranscriptView.tsx            # 听写错词高亮 + 翻译缓存修复
│   └── PlaybackDetailTabs.tsx        # hook 顺序修复
├── views/
│   ├── WordsView.tsx                 # 复习筛选 + 无限滚动优化 + 闪屏修复
│   ├── HomeView.tsx                  # 待复习卡片
│   └── CollectionDetailView.tsx      # 补 useMemo 导入
└── index.css                         # .dictation-wrong 样式
```

---

## 二、功能交付

### 单词复习系统

| 组件 | 状态 |
|------|------|
| `word_progress.last_score` 列 + migration | ✅ |
| `ProgressRepository.add_review()` | ✅ |
| `ProgressRepository.get_due_words()` | ✅ 低分→长时间未复习排序 |
| `ProgressRepository.get_due_words_count()` | ✅ |
| `POST /progress/words/review` | ✅ |
| `GET /progress/words/due` | ✅ |
| `GET /progress/words/due-count` | ✅ |
| WordsView "待复习" 筛选 | ✅ |
| HomeView 待复习卡片 | ✅ |

### 听写错词高亮

| 组件 | 状态 |
|------|------|
| `TranscriptView` 消费 `wrong_indices` | ✅ 红色波浪下划线 + 浅红背景 |
| `.dictation-wrong` CSS class | ✅ |

### 单词 API 优化

| 组件 | 状态 |
|------|------|
| 列表 API 轻量化（只返回 `{word, count}`） | ✅ |
| `GET /api/words/{word}` 详情端点 | ✅ |
| 前端 `WordSummary` / `WordDetail` 类型分离 | ✅ |
| 详情缓存 `detailCache`（避免重复请求） | ✅ |

---

## 三、架构变更

### API 迁移完成度

| 原始文件 | 迁移目标 | 状态 |
|----------|----------|------|
| `clips_api.py` | `routers/clips.py` + `ClipRepository` | v0.2.4 ✅ |
| `favorites_api.py` | `routers/favorites.py` + `FavoriteRepository` | v0.2.4 ✅ |
| `collections_api.py` | `routers/collections.py` + `CollectionService` | v0.2.4 ✅ |
| `translation (in main.py)` | `routers/translation.py` + `TranslationRepository` | v0.2.4 ✅ |
| `progress_api.py` | `routers/progress.py` + `ProgressRepository` | **v0.2.5 ✅** |
| `stats_api.py` | `routers/stats.py` | **v0.2.5 ✅** |
| `import_api.py` | `routers/import_route.py` + `services/import_service.py` | **v0.2.5 ✅** |

### 死代码清理

| 文件 | 操作 |
|------|------|
| `collections_api.py` | 删除（已无引用） |
| `favorites_api.py` | 删除（已被替代） |
| `clips_api.py` | 删除（已被替代） |
| `progress_api.py` | 删除（已被替代） |
| `stats_api.py` | 删除（被 `stats.py` 替代） |
| `import_api.py` | 删除（拆为 route + service） |

---

## 四、Bug 修复清单

| Bug | 诊断 | 修复文件 |
|-----|------|----------|
| 单词页 skeleton → 单词闪烁 | `loading || dueWordsLoading` 条件 | `WordsView.tsx` |
| 切换待复习后无限滚动失效 | callback ref 元素未绑定 | `WordsView.tsx` |
| 单词加载后 observer 反复重建 | 11 个 useEffect deps | `WordsView.tsx` |
| 中文翻译完全不显示 | `!hasProvider` 守卫跳过缓存查 | `TranscriptView.tsx` |
| 合集详情 useMemo is not defined | 漏 import | `CollectionDetailView.tsx` |
| PlaybackDetailTabs hook 顺序错 | useClipAnalysis 在 lessonClips 前 | `PlaybackDetailTabs.tsx` |
| 翻译 POST 路由 404 | 缺尾部斜杠路由 | `translation.py` |

---

## 五、文件变更统计

| 指标 | 数值 |
|------|------|
| Commits | 6 |
| 文件变更 | 20（+16 / -4 新建/删除） |
| 代码行 | +447 / -919 行 |
| 新增 API 端点 | `POST /progress/words/review`, `GET /progress/words/due`, `GET /progress/words/due-count`, `GET /api/words/{word}` |
| 路由总数 | 46 |
| TypeScript 错误 | 0 |

### 按目录

| 目录 | 变更 |
|------|------|
| `backend/app/routers/` | 新增 3 文件，删除 6 文件，修改 2 文件 |
| `backend/app/repositories/` | 修改 1 文件 |
| `backend/app/services/` | 新增 1 文件 |
| `frontend/src/views/` | 修改 3 文件 |
| `frontend/src/components/` | 修改 2 文件 |
| `frontend/src/lib/` | 修改 1 文件 |
| `frontend/` | 修改 index.css |

---

## 六、未完成（后续版本）

- **单词复习历史** — 当前只记录 `last_score`，未建 `word_reviews` 历史表
- **逐句翻译按钮** — 目前依赖 auto-translate，缺少手动"翻译此句"交互
- **听写错词点击添加到复习** — `TranscriptView` 中可点错词但未对接复习 API
- **首页高频错词卡片** — 计划中但未实现（可复用 `frequent_wrong_words` 动态合集）
