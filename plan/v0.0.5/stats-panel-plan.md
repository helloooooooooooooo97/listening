# 统计面板设计计划

> 基于 SQLite 数据库的用户交互数据，构建学习数据统计面板

## 数据来源

当前已有数据库表及其可统计的指标：

| 表 | 数据 | 可统计指标 |
|---|---|---|
| `play_history` | 每次播放记录（课程ID、时长、时间） | 总时长、每日时长、课程播放次数、时段分布 |
| `lesson_progress` | 课程学习进度（完成状态、听写均分） | 完成课程数、完成率、平均分 |
| `dictation_history` | 每次听写记录（课程、句子、分数） | 听写总句数、正确率趋势、薄弱句 |
| `word_progress` | 单词掌握（已知/未知） | 掌握单词数、掌握率、每日新增 |
| `clips` | 片段收藏 | 收藏总数、按课程分布 |

## 统计面板布局

```
┌──────────────────────────────────────────────────────────┐
│  学习统计                                                  │
│                                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│  │ 总时长  │ │ 完成   │ │ 听写   │ │ 单词   │ │ 片段   │ │
│  │ 32分钟  │ │ 5 课程 │ │ 78%   │ │ 127   │ │ 23    │ │
│  │ 📈 +12% │ │ 🎯     │ │ 📊 +3% │ │ 📚 +8  │ │ 📌 +5  │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │
│                                                          │
│  ┌─────────────────────┐ ┌─────────────────────────────┐ │
│  │ 每日听力时长 (7天)    │ │ 听写正确率趋势 (最近20次)     │ │
│  │ ██████              │ │ ████████████████            │ │
│  │ ████████████        │ │ ████████████████████        │ │
│  │ ██████              │ │ ██████████████              │ │
│  │ 一 二 三 四 五 六 日 │ │                              │ │
│  └─────────────────────┘ └─────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────┐ ┌─────────────────────────────┐ │
│  │ 课程完成进度          │ │ 最近活动                     │ │
│  │ Fox and Grapes  ████│ │ 12:30 完成听写 The Fox...   │ │
│  │ Lion and Mouse  ██  │ │ 11:15 收藏片段 jumping...   │ │
│  │ Goose and Eggs  ███ │ │ 10:00 开始学习 Cat and...   │ │
│  │ North Wind & Sun █  │ │ 09:30 掌握单词 "grapes"     │ │
│  └─────────────────────┘ └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## API 设计

### `GET /api/stats/overview`

返回顶部概览数据：

```json
{
  "total_listening_seconds": 1920,
  "completed_lessons": 5,
  "total_lessons": 16,
  "avg_dictation_score": 78,
  "dictation_total_sentences": 45,
  "words_mastered": 127,
  "total_words": 5339,
  "clips_count": 23,
  "streak_days": 3,
  "today_seconds": 180
}
```

### `GET /api/stats/daily-time?days=7`

```json
{
  "days": [
    {"date": "2026-06-01", "seconds": 600},
    {"date": "2026-06-02", "seconds": 0}
  ]
}
```

### `GET /api/stats/dictation-trend?limit=20`

```json
{
  "scores": [
    {"date": "2026-06-06", "lesson": "Fox and Grapes", "score": 85},
    {"date": "2026-06-06", "lesson": "Lion and Mouse", "score": 72}
  ]
}
```

### `GET /api/stats/recent-activity?limit=20`

```json
{
  "activities": [
    {"type": "dictation", "lesson_title": "Fox and Grapes", "time": "2026-06-06T12:30:00", "detail": "完成听写 85%"},
    {"type": "clip", "lesson_title": "Fox and Grapes", "time": "2026-06-06T11:15:00", "detail": "收藏片段"},
    {"type": "word", "time": "2026-06-06T09:30:00", "detail": "掌握单词 grapes"}
  ]
}
```

### `GET /api/stats/lesson-progress`

```json
{
  "lessons": [
    {"id": "fox-grapes", "title": "Fox and Grapes", "completed": 1, "progress_pct": 100, "dictation_score": 85},
    {"id": "lion-mouse", "title": "Lion and Mouse", "completed": 0, "progress_pct": 60, "dictation_score": null}
  ]
}
```

### `GET /api/stats/heatmap?days=90`

返回类似 GitHub 贡献图的每日活跃数据（用于显示学习日历）：

```json
{
  "heatmap": [
    {"date": "2026-06-01", "minutes": 45, "level": 3},
    {"date": "2026-06-02", "minutes": 0, "level": 0}
  ]
}
```

## 前端组件结构

```
views/StatsView.tsx
├── StatsOverview        # 5 个概览卡片（可点击下钻）
├── DailyTimeChart       # 每日听力时长柱状图
├── DictationTrendChart  # 听写正确率折线图
├── LessonProgressList   # 课程完成进度条列表
├── ActivityTimeline     # 最近活动时间线
└── LearningCalendar     # 学习热力图（GitHub 风格）
```

## 交互设计

1. **概览卡片可点击** — 点击「完成课程」→ 下方展开课程进度列表
2. **图表 hover** — hover 柱状图/折线图显示具体数值
3. **时间范围切换** — 7天/30天/90天 按钮切换图表时间范围
4. **活动时间线滚动加载** — 滚动到底部加载更多历史记录
5. **热力图** — 类似 GitHub 贡献图，展示学习频率

## 实施优先级

| 优先级 | 内容 | 依赖 |
|---|---|---|
| P0 | API: overview + daily-time + dictation-trend | 现有 DB 表 |
| P0 | 前端: 概览卡片 + 每日时长图 + 听写趋势图 | API |
| P1 | API: recent-activity + lesson-progress | 活动记录写入逻辑 |
| P1 | 前端: 课程进度列表 + 活动时间线 | API |
| P2 | API: heatmap | 历史数据 |
| P2 | 前端: 学习热力图 | API |

## 数据写入点

为保证统计数据准确，需要在以下操作时写入数据库：

| 操作 | 写入表 | 触发点 |
|---|---|---|
| 开始播放课程 | `play_history` | `audioStore.playLesson()` |
| 完成听写 | `dictation_history` + 更新 `lesson_progress` | `dictationStore.submit()` |
| 标记单词掌握 | `word_progress` | 单词面板「标记掌握」按钮 |
| 创建片段 | `clips` | 拖拽保存片段 |
| 播放结束/暂停 | 更新 `lesson_progress.last_position` | audioStore 定期保存 |
