# 技术架构 — 英语听力 App `v0.0.4`

> 继承自 [v0.0.3](../v0.0.3/technical-architecture.md)

## v0.0.4 架构变更

### 组件拆分

```
frontend/src/components/
├── ContentPanel.tsx           # ✏️ 路由分发器（~30行）
├── views/
│   ├── HomeView.tsx            # 🆕 首页仪表盘
│   ├── CoursesView.tsx         # 🆕 课程网格
│   ├── ClipsView.tsx           # 🆕 片段列表
│   ├── WordsView.tsx           # 🆕 单词面板
│   ├── RecentView.tsx          # 🆕 最近播放
│   └── DictationView.tsx       # 🆕 听写模式
├── PlayerBar.tsx               # ✏️ 增加听写模式按钮
├── Sidebar.tsx                 # 不变
└── (TranscriptView, Toast 等不变)
```

### 听写模式数据模型

```typescript
interface DictationState {
  mode: 'idle' | 'playing' | 'typing' | 'feedback';
  currentSentenceIndex: number;
  userInput: string;
  results: WordResult[];
  scores: number[];  // 每句正确率
}

interface WordResult {
  expected: string;
  actual: string | null;
  status: 'correct' | 'wrong' | 'missing' | 'extra';
}
```

### 听写交互流程

```
idle → 点击开始听写
  ↓
playing → 播放当前句子（单次）
  ↓
typing → 显示输入框，用户输入
  ↓ (提交)
feedback → 逐词对比 + 评分动画
  ↓ (点击下一句)
playing → 循环...
  ↓ (最后一句完成)
idle → 显示总成绩
```

### 后端新 API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/words` | 去重单词列表（?sort=freq&limit=100） |
| POST | `/api/lessons/import` | 上传音频 + 元数据，触发 WhisperX |
| GET | `/api/lessons/import/{task_id}` | 查询导入任务进度 |
| GET | `/api/stats` | ✅ 已有 |

### 课程导入架构

```
前端上传 MP3
    ↓ POST /api/lessons/import (multipart/form-data)
后端接收文件
    ↓ 保存到 data/lessons/
    ↓ 后台线程运行 WhisperX
    ↓ 生成 JSON
    ↓ 返回完成状态
前端轮询进度
    ↓ 完成后刷新课程列表
```

### 动画规范

```css
/* 歌词覆盖层 */
.lyrics-overlay-enter { animation: slide-up 0.4s cubic-bezier(0.16,1,0.3,1); }
.lyrics-overlay-exit  { animation: slide-down 0.3s ease-in; }

/* 视图切换 */
.view-enter { animation: fade-in 0.3s ease-out; }

/* 听写词反馈 */
.word-correct { animation: pop-in 0.2s ease-out; }
.word-wrong   { animation: shake 0.3s ease-out; }
```

### 文件变更清单

| 操作 | 文件 |
|---|---|
| 🆕 | `views/HomeView.tsx` |
| 🆕 | `views/CoursesView.tsx` |
| 🆕 | `views/ClipsView.tsx` |
| 🆕 | `views/WordsView.tsx` |
| 🆕 | `views/RecentView.tsx` |
| 🆕 | `views/DictationView.tsx` |
| 🆕 | `hooks/useSearch.ts` |
| 🆕 | `hooks/useStats.ts` |
| ✏️ | `components/ContentPanel.tsx` → 路由分发器 |
| ✏️ | `components/PlayerBar.tsx` → 增加听写按钮 |
| ✏️ | `stores/audioStore.ts` → 增加 dictationState |
| 🆕 | `stores/dictationStore.ts` |
| 🆕 | `backend/app/routers/words.py` |
| 🆕 | `backend/app/routers/import.py` |
