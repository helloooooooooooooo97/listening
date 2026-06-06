# 技术架构 v0.0.1

## 项目结构

```
english/
├── frontend/          # React SPA (Vite)
│   └── src/
│       ├── App.tsx, main.tsx
│       ├── components/
│       │   ├── LessonCard.tsx
│       │   ├── LessonList.tsx
│       │   ├── LessonPlayer.tsx
│       │   └── TranscriptView.tsx
│       ├── hooks/useAudioPlayer.ts
│       └── types/lesson.ts
├── backend/           # FastAPI
│   └── app/
│       ├── main.py
│       ├── models/, routers/, services/
│       └── data/lessons/*.json, *.mp3
├── tools/             # WhisperX 脚本
├── .venv-whisperx/    # WhisperX 独立 venv
└── plan/              # 设计文档
```

## 数据模型

- `ListeningLesson` → id, title, subtitle, level, duration, transcript[], words[]
- `TranscriptLine` → id, start, end, text, note
- `TranscriptWord` → id, text, start, end

## API

| Method | Path | 说明 |
|---|---|---|
| GET | /api/health | 健康检查 |
| GET | /api/lessons/ | 课程摘要列表 |
| GET | /api/lessons/{id} | 课程详情 |
| GET | /api/lessons/{id}/audio | 音频流 |

## 状态管理

- 课程数据：fetch API + React useState
- 播放状态：useAudioPlayer Hook（local state，不同步）
- 无全局状态管理
