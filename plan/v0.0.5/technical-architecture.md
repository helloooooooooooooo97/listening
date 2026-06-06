# 技术架构 — 英语听力 App `v0.0.5`

> 继承自 [v0.0.4](../v0.0.4/technical-architecture.md)

## v0.0.5 架构变更

### 新增后端 API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/words` | 去重单词列表 |
| GET | `/api/words?q=hello&sort=freq&limit=100` | 搜索+排序+分页 |
| POST | `/api/lessons/import` | 上传音频+元数据 |
| GET | `/api/lessons/import/{task_id}` | 查询导入进度 |
| GET | `/api/progress` | 学习进度统计 |

### 单词 API 设计

```python
# GET /api/words?sort=freq&limit=100
{
  "total": 2724,
  "words": [
    {
      "word": "the",
      "count": 523,
      "lessons": [
        {"id": "fox-grapes", "title": "The Fox and the Grapes", "occurrences": [24.5, 42.1]}
      ]
    }
  ]
}
```

### 课程导入流程

```
┌─ 前端 ──────────────────────────────────────────┐
│ 1. 用户拖拽/选择 MP3 文件                          │
│ 2. 填写元数据表单（标题/难度/来源）                    │
│ 3. POST /api/lessons/import (multipart/form-data) │
│ 4. 获得 task_id，轮询 GET /api/lessons/import/{id} │
│    ├── pending   → "等待处理"                       │
│    ├── transcribing → "WhisperX 转写中..."          │
│    ├── aligning  → "词对齐中..."                     │
│    ├── completed → "导入完成" + 刷新课程列表           │
│    └── failed    → "导入失败" + 错误信息              │
└──────────────────────────────────────────────────┘

┌─ 后端 ──────────────────────────────────────────┐
│ 1. 接收文件 → 保存到 data/lessons/{id}.mp3         │
│ 2. 后台线程运行 WhisperX                            │
│ 3. 生成 {id}.json                                  │
│ 4. 更新 task 状态                                   │
└──────────────────────────────────────────────────┘
```

### 进度统计存储

```typescript
// localStorage key: 'learning-progress'
interface LearningProgress {
  totalListeningSeconds: number;
  completedLessons: string[];     // lesson IDs
  dictationScores: { date: string; score: number }[];
  listeningHistory: { date: string; seconds: number }[];
  streakDays: number;
  lastActiveDate: string;
}
```

### 新增前端模块

```
frontend/src/
├── views/
│   ├── StatsView.tsx              # 🆕 学习统计
│   └── ImportView.tsx             # 🆕 课程导入
├── components/
│   ├── ErrorBoundary.tsx          # 🆕 错误边界
│   ├── OfflineBanner.tsx          # 🆕 离线横幅
│   ├── Skeleton.tsx               # 🆕 骨架屏组件
│   └── TrendChart.tsx             # 🆕 简单趋势图
├── hooks/
│   └── useOnlineStatus.ts         # 🆕 网络状态
├── stores/
│   ├── progressStore.ts           # 🆕 学习进度
│   └── importStore.ts             # 🆕 导入状态
```

### 骨架屏设计

```tsx
// Skeleton 组件
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.04] rounded-lg ${className}`} />;
}

// 使用示例 — 首页课程网格骨架
<div className="grid grid-cols-5 gap-4">
  {Array.from({length: 5}).map((_,i) => (
    <div key={i} className="space-y-2">
      <Skeleton className="aspect-square rounded-md" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-2 w-1/2" />
    </div>
  ))}
</div>
```

### 错误处理架构

```
┌─ API 请求 ──┐
│ fetch(url)   │
│   .then(ok)  │──→ 正常渲染
│   .catch(err)│──→ toastStore.addToast(err.message, 'error')
│              │     └→ Toast 显示红色错误 + 重试按钮
└──────────────┘

┌─ ErrorBoundary ──────────────────────────────┐
│ <ErrorBoundary fallback={<ErrorView />}>      │
│   <App />                                      │
│ </ErrorBoundary>                               │
│                                                │
│ ErrorView: "出了点问题" + 刷新按钮               │
└────────────────────────────────────────────────┘
```

### 文件变更清单

| 操作 | 文件 |
|---|---|
| 🆕 | `backend/app/routers/words.py` |
| 🆕 | `backend/app/routers/import.py` |
| ✏️ | `backend/app/main.py` — 注册新路由 |
| 🆕 | `views/StatsView.tsx` |
| 🆕 | `views/ImportView.tsx` |
| 🆕 | `components/ErrorBoundary.tsx` |
| 🆕 | `components/OfflineBanner.tsx` |
| 🆕 | `components/Skeleton.tsx` |
| 🆕 | `stores/progressStore.ts` |
| 🆕 | `hooks/useOnlineStatus.ts` |
| ✏️ | `views/WordsView.tsx` — 使用单词 API |
| ✏️ | `views/SettingsView.tsx` — 扩展设置项 |
| ✏️ | `views/DictationView.tsx` — 重新输入+跳过 |
| ✏️ | `components/Sidebar.tsx` — 新增统计导航 |
| ✏️ | `stores/settingsStore.ts` — 扩展设置 |
