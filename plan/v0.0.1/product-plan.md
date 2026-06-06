# 产品计划 v0.0.1

> 初始版本：项目骨架搭建、WhisperX 管线、基础前后端

## 目标

构建一个英语听力 App，将短音频课程转化为互动学习会话。

## 已完成

- [x] 项目目录结构确定（frontend/ + backend/ + tools/）
- [x] WhisperX 环境搭建（.venv-whisperx/）
- [x] tools/align_with_whisperx.py 对齐脚本
- [x] 示例课程 fox-grapes（LibriVox Aesop's Fables）
- [x] 后端 FastAPI 骨架
  - GET /api/lessons/ — 课程列表
  - GET /api/lessons/{id} — 课程详情
  - GET /api/lessons/{id}/audio — 音频流
- [x] 前端 Vite + React + TailwindCSS 脚手架
- [x] 基础听力播放页面（音频播放、句子高亮、词级同步）
- [x] 课程导入检查清单（plan/lesson-import-checklist.md）
- [x] Makefile 快速启动
- [x] .gitignore

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript 6 + Vite 8 + TailwindCSS 4 |
| 后端 | Python 3.11 + FastAPI + Uvicorn |
| 离线 | WhisperX + faster-whisper + PyAnnote |

## 路线图

| 阶段 | 状态 |
|---|---|
| 1. 音频素材准备 | ✅ |
| 2. WhisperX 词对齐 | ✅ |
| 3. 课程 JSON 生成 | ✅ |
| 4. 基础播放 UI | ✅ |
| 5. 精听/听写/跟读 | 🔜 |
