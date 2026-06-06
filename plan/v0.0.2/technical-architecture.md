# 技术架构 — 英语听力 App `v0.0.2`

## 项目结构

```
english/
├── frontend/                # React SPA
│   ├── src/
│   │   ├── App.tsx          # 主应用组件
│   │   ├── main.tsx         # 入口
│   │   ├── components/      # 可复用组件
│   │   ├── hooks/           # 自定义 Hook
│   │   └── types/           # TypeScript 类型定义
│   ├── package.json
│   └── vite.config.ts
├── backend/                 # FastAPI 服务
│   ├── app/
│   │   ├── main.py          # 应用入口 + CORS
│   │   ├── models/          # Pydantic 数据模型
│   │   ├── routers/         # API 路由
│   │   ├── services/        # 业务逻辑
│   │   └── data/lessons/    # 课程 JSON + MP3
│   ├── requirements.txt
│   └── .venv/
├── tools/                   # 离线工具
│   ├── align_with_whisperx.py
│   └── requirements-whisperx.txt
├── .venv-whisperx/          # WhisperX 独立 venv
└── plan/                    # 设计文档
    ├── product-plan.md
    └── technical-architecture.md
```

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
| --- | --- | --- |
| React | 19.2 | UI 框架（函数组件 + Hooks） |
| TypeScript | 6.0 | 类型安全 |
| Vite | 8.0 | 构建工具与 HMR 开发服务器 |
| TailwindCSS | 4.3 | 原子化 CSS 框架 |
| ESLint | 10.3 | 代码检查 |

**开发命令**：`npm run dev` → `http://localhost:5173`

### 后端

| 技术 | 版本 | 用途 |
| --- | --- | --- |
| Python | 3.11 | 运行环境 |
| FastAPI | 0.128 | Web 框架（自动 OpenAPI 文档） |
| Uvicorn | 0.39 | ASGI 服务器 |
| Pydantic | 2.13 | 数据校验与序列化 |

**开发命令**：`uvicorn app.main:app --reload`（从 `backend/app/` 目录运行）→ `http://localhost:8000`

### 离线工具（WhisperX）

| 技术 | 用途 |
| --- | --- |
| WhisperX | 语音识别 + 词级时间对齐 |
| faster-whisper | CTranslate2 推理引擎 |
| PyAnnote | 说话人分离（VAD） |

**独立 venv**：`.venv-whisperx/`（与后端分离，避免依赖冲突）

## 系统架构

```
┌─────────────────────────┐     HTTP/JSON      ┌──────────────────────┐
│   React SPA (Vite)      │ ◀───────────────▶  │   FastAPI (Uvicorn)  │
│   localhost:5173        │                     │   localhost:8000     │
│                         │                     │                      │
│  ┌───────────────────┐  │  GET /api/lessons   │  ┌────────────────┐  │
│  │ LessonList        │◀─┼─────────────────────┼──│ lesson_service │  │
│  │ LessonPlayer      │  │  GET /api/lessons/  │  │                │  │
│  │ TranscriptView    │  │       {id}          │  │ list_lessons() │  │
│  │   └─ ClipToolbar  │  │                     │  │ get_lesson()   │  │
│  │ ClipsPage         │  │  GET /api/lessons/  │  │ get_audio_path │  │
│  │ ClipReviewMode    │  │       {id}/audio    │  └───────┬────────┘  │
│  └───────────────────┘  │                     │          │           │
│           │             │                     │  ┌───────▼────────┐  │
│     localStorage        │                     │  │ data/lessons/  │  │
│     audio-clips         │                     │  │ *.json  *.mp3  │  │
└─────────────────────────┘                     │  └────────────────┘  │
                                                │  │ data/lessons/  │  │
                                                │  │ *.json  *.mp3  │  │
                                                │  └────────────────┘  │
                                                └──────────────────────┘
```

## 数据模型

### ListeningLesson（顶层结构）

```typescript
interface ListeningLesson {
  id: string;            // 课程唯一标识，如 "fox-grapes"
  title: string;         // 标题，如 "The Fox and The Grapes"
  subtitle: string;      // 副标题/来源，如 "Aesop's Fables, Volume 01"
  level: string;         // 难度等级，如 "A2-B1"
  duration: number;      // 音频总时长（秒）
  audioFileName: string; // 音频文件名，如 "fox-grapes.mp3"
  sourceURL: string;     // 音频来源 URL
  textSourceURL: string; // 文本来源 URL
  transcript: TranscriptLine[];
  words: TranscriptWord[];
}
```

### TranscriptLine（句子级）

```typescript
interface TranscriptLine {
  id: string;     // "line-000"
  start: number;  // 起始时间（秒）
  end: number;    // 结束时间（秒）
  text: string;   // 句子文本
  note: string;   // 教学注释（可选）
}
```

### TranscriptWord（词级，用于高亮同步）

```typescript
interface TranscriptWord {
  id: string;    // "w-0000"
  text: string;  // 词文本
  start: number; // 起始时间（秒）
  end: number;   // 结束时间（秒）
}
```

### AudioClip（片段收藏）🆕

```typescript
interface AudioClip {
  id: string;           // 唯一标识，如 "clip-fox-grapes-001"
  lessonId: string;     // 所属课程 ID
  lessonTitle: string;  // 冗余：课程标题（便于列表展示）
  startWordId: string;  // 起始词 ID
  endWordId: string;    // 结束词 ID
  startTime: number;    // 起始时间（秒）
  endTime: number;      // 结束时间（秒）
  text: string;         // 片段文本（从 startWord 到 endWord 拼接）
  note: string;         // 用户标签/注释
  createdAt: string;    // 创建时间 ISO 8601
}
```

**存储方式**：MVP 阶段使用 `localStorage`，key 为 `audio-clips`，value 为 `AudioClip[]` 的 JSON 序列化。不经过后端 API。

## API 设计

| Method | Path | 返回 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/health` | `{"status":"ok"}` | 健康检查 |
| GET | `/api/lessons/` | `LessonSummary[]` | 课程列表（不含 transcript/words） |
| GET | `/api/lessons/{id}` | `ListeningLesson` | 课程详情（含全部数据） |
| GET | `/api/lessons/{id}/audio` | `audio/mpeg` 流 | 音频文件 |

### LessonSummary（列表轻量版）

```typescript
interface LessonSummary {
  id: string;
  title: string;
  subtitle: string;
  level: string;
  duration: number;
  audioFileName: string;
  sourceURL: string;
  textSourceURL: string;
  sentenceCount: number;  // 句子数
  wordCount: number;      // 词数
}
```

## 音频策略

- **保留完整音频，不做裁剪。** LibriVox 等来源的音频包含开场声明和结尾语，这些内容作为课程一部分保留。
- 音频文件和对应 JSON 放在 `backend/app/data/lessons/` 下。
- 音频格式：MP3（来自 LibriVox / Internet Archive）。
- 不将音频文件纳入 Git（已在 `.gitignore` 中排除 `*.mp3`）。

## 前端组件树（计划）

```
App
├── LessonListPage           # 课程列表首页
│   └── LessonCard           # 单个课程卡片
├── LessonPlayerPage         # 课程播放页
│   ├── AudioPlayer           # 音频播放器（进度条、控制、变速）
│   ├── TranscriptView        # 逐句文本 + 词级高亮 + 拖拽选词
│   │   ├── TranscriptLine    # 单句（可点击跳转）
│   │   └── WordSpan          # 单个词（可拖选高亮）
│   ├── ClipToolbar           # 🆕 选中词语后的浮动操作栏
│   └── DictationPanel        # 听写模式（后续）
├── ClipsPage                 # 🆕 片段收藏列表
│   ├── ClipCard              # 🆕 单个片段卡片（文本、时间、标签、播放按钮）
│   └── ClipReviewMode        # 🆕 复习模式（逐片段循环播放）
└── ShadowPanel               # 跟读模式（后续）
```

## 片段收藏交互流程 🆕

```
TranscriptView 中：
  1. 用户 mousedown 在某个 WordSpan 上 → 标记为 anchorWord
  2. 用户拖动鼠标经过其他 WordSpan → 实时高亮 anchorWord 到当前词的范围
  3. 用户 mouseup → 选中范围确定，弹出 ClipToolbar
  4. ClipToolbar 显示选中文本预览 + [添加标签] 输入框 + [保存] [取消] 按钮
  5. 保存 → 写入 localStorage，Toast 提示成功

ClipsPage 中：
  1. 从 localStorage 读取所有 AudioClip
  2. 按课程分组展示，或按时间排序
  3. 点击片段 → 进入 ClipReviewMode
  4. ClipReviewMode 加载对应课程的音频
  5. 自动跳转到片段时间范围并循环播放
  6. 支持「下一个片段」和「重复当前」控制
```
## 状态管理

- **课程数据**：通过 fetch 从后端 API 获取，使用 React `useState` / `useEffect`。
- **播放状态**：自定义 `useAudioPlayer` Hook，封装 HTML5 `<audio>` 元素。
- **用户进度**：`localStorage` 存储（MVP 阶段不引入数据库）。
- **片段收藏**：`localStorage` 存储，key `audio-clips`，读写通过自定义 `useClips` Hook。
  - 片段不经过后端 API，纯前端管理。
  - 片段列表支持 CRUD：创建（拖选保存）、读取（列表展示）、更新（修改标签）、删除。
  - 复习模式下，通过 `useAudioPlayer.seek()` 跳转到片段时间 + 监听 `currentTime` 在片段结束时自动循环。
