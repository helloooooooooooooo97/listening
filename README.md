# 英语听力 App

基于 WhisperX 词对齐的英语听力学习工具，支持逐句播放、词级高亮、片段收藏和循环复习。

## 目录结构

```
english/
├── README.md                    # 本文件
├── Makefile                     # 开发命令（make dev / make build 等）
├── .gitignore
│
├── frontend/                    # 前端 — React SPA
│   ├── src/
│   │   ├── App.tsx              # 主布局（左右分栏 + 底部播放栏）
│   │   ├── components/
│   │   │   ├── Sidebar.tsx      # 左侧栏（课程列表 / 片段列表 + 搜索）
│   │   │   ├── PlayerPanel.tsx  # 右侧主内容（文本 / 上下文）
│   │   │   ├── PlayerBar.tsx    # 底部播放栏（进度 / 控制 / 变速）
│   │   │   └── TranscriptView.tsx  # 逐词高亮文本 + 拖拽选词
│   │   ├── hooks/               # 自定义 Hook（待清理）
│   │   ├── stores/              # Zustand 全局状态
│   │   │   ├── audioStore.ts    # 音频播放状态（全局单例 Audio）
│   │   │   └── clipsStore.ts    # 片段收藏状态（localStorage）
│   │   └── types/lesson.ts      # TypeScript 类型定义
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # 后端 — FastAPI
│   ├── app/
│   │   ├── main.py              # FastAPI 入口 + CORS
│   │   ├── models/              # Pydantic 数据模型
│   │   ├── routers/             # API 路由
│   │   ├── services/            # 业务逻辑
│   │   └── data/lessons/        # 课程 JSON + MP3 文件
│   ├── requirements.txt
│   └── .venv/                   # 后端 Python 虚拟环境
│
├── tools/                       # 离线工具
│   ├── align_with_whisperx.py   # WhisperX 词对齐脚本
│   └── requirements-whisperx.txt
│
├── .venv-whisperx/              # WhisperX 独立虚拟环境
│
└── plan/                        # 设计文档（版本化）
    ├── VERSIONS.md              # 版本历史与变更记录
    ├── v0.0.1/                  # 初始版本：项目骨架 + 基础前后端
    │   ├── product-plan.md
    │   └── technical-architecture.md
    └── v0.0.2/                  # 当前版本：UI 重构 + 全局状态 + 底部播放栏
        ├── product-plan.md
        ├── technical-architecture.md
        └── lesson-import-checklist.md
```

## 快速开始

```bash
# 安装依赖
make install

# 启动开发服务器（前后端同时）
make dev

# 仅启动后端 → http://localhost:8000
make backend

# 仅启动前端 → http://localhost:5173
make frontend
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 · TypeScript 6 · Vite 8 · TailwindCSS 4 · Zustand |
| 后端 | Python 3.11 · FastAPI · Uvicorn |
| 离线 | WhisperX · faster-whisper |

## 当前版本

**v0.0.2** — 查看 [plan/VERSIONS.md](plan/VERSIONS.md) 了解版本历史。
