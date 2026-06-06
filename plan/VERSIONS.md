# 版本历史

> 每个版本的详细评审见对应目录下的 `review-report.md`
>
> 当前最新：**v0.0.3** ← 你在这里

## v0.0.3 — 精听控制 + 体验打磨

**日期**: 2026-06-06 · [📋 产品计划](v0.0.3/product-plan.md) · [🏗️ 技术架构](v0.0.3/technical-architecture.md)

**主题**：补齐精听控制能力，打磨交互细节。

### 范围

| 优先级 | 功能 |
|---|---|
| 🔴 P0 | 逐句导航（⏮⏭）、循环模式（全部/单句/片段）、键盘快捷键、清理技术债 |
| 🟡 P1 | Toast通知、拖拽优化、片段排序、播放记忆、过渡动画 |
| 🟢 P2 | 听写MVP、基础统计、移动端适配 |

---

## v0.0.2 — UI 重构 + 全局音频 + 底部播放栏

**日期**: 2026-06-06 · [📋 评审报告](v0.0.2/review-report.md)

### 新增
- 🎨 统一左右分栏布局（Sidebar 50% + PlayerPanel 50%）
- 🎵 底部播放栏（PlayerBar），类似音乐播放器，始终可见
- 🔄 Zustand 全局音频状态管理（`stores/audioStore.ts`）
- 📌 片段收藏全局状态（`stores/clipsStore.ts`，修复多组件状态不同步）
- 🔍 侧边栏搜索框，实时过滤课程/片段
- 🏷️ 侧边栏播放按钮与底部播放栏完全同步（▶/⏸）

### 变更
- 播放控制从 PlayerPanel 移到 PlayerBar（底部固定栏）
- `useClips` Hook → `useClipsStore` Zustand Store（修复片段失效 Bug）
- `useAudioPlayer` Hook → `useAudioStore` Zustand Store（全局单例 Audio）
- LessonList / LessonPlayer / ClipsPage / ClipReviewMode → Sidebar + PlayerPanel（统一布局）
- 移除路由式页面跳转，改为单页左右分栏

### 修复
- 🐛 片段收藏失效：TranscriptView 添加片段后 Sidebar 不可见 → Zustand 全局状态解决
- 🐛 播放按钮不同步：Sidebar 和 PlayerPanel 各自管理状态 → Zustand 单例 Audio 解决

---

## v0.0.1 — 项目初始化

**日期**: 2026-06-06 · [📋 回顾评审](v0.0.1/review-report.md)

**日期**: 2026-06-06

### 新增
- 📁 项目结构（frontend/ + backend/ + tools/ + plan/）
- 🎙️ WhisperX 词对齐管线（tools/align_with_whisperx.py）
- 🦊 示例课程 fox-grapes（LibriVox Aesop's Fables, 44.7s, 115词）
- 🔧 后端 FastAPI（课程列表/详情/音频流）
- 🎨 前端 Vite + React + TailwindCSS（基础播放页面）
- 📝 课程导入检查清单
- 🏗️ Makefile 快速启动
- 📋 .gitignore

### 技术栈
- React 19 + TypeScript 6 + Vite 8 + TailwindCSS 4
- Python 3.11 + FastAPI 0.128 + Uvicorn 0.39
- WhisperX 3.8 + faster-whisper
- localStorage（用户数据，无后端数据库）
