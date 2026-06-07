# 版本历史

> 每个版本的详细评审见对应目录下的 `review-report.md`
>
> 当前最新：**v0.0.8** ← 你在这里

## v0.0.8 — 课程导入 + 播放列表 + 学习提醒

**日期**: 2026-06-07 · [📋 产品计划](v0.0.8/product-plan.md)

**主题**：补齐课程导入管线，增强播放列表管理，添加学习提醒功能。

| 优先级 | 功能 |
|---|---|
| 🔴 P0 | 课程导入 UI（拖拽上传 + WhisperX 转写）、播放列表/队列 |
| 🟡 P1 | 学习提醒（每日目标 + 通知）、收藏批量管理 |
| 🟢 P2 | 统计图表增强、移动端响应式 |

---

## v0.0.7 — 波形可视化 + Notion 色彩体系 + 歌词交互痕迹

**日期**: 2026-06-06 · [📋 产品计划](v0.0.7/product-plan.md)

**主题**：提升听力练习核心体验，补齐课程导入功能。

| 优先级 | 功能 |
|---|---|
| 🔴 P0 | 音频波形可视化、课程导入 UI、收藏计数实时同步 |
| 🟡 P1 | audioStore 拆分、大组件拆分、设置默认值同步、播放体验优化 |
| 🟢 P2 | 收藏导出管理、统计图表增强、移动端响应式 |

---

## v0.0.6 — 代码架构优化

**日期**: 2026-06-06 · [📋 产品计划](v0.0.6/product-plan.md) · [🏗️ 技术架构](v0.0.6/technical-architecture.md)

**主题**：零功能变更，纯代码架构优化。

| 优先级 | 类别 | 内容 |
|---|---|---|
| 🔴 P0 | 后端 | 数据库连接单例、单词缓存、streak优化、异常中间件 |
| 🔴 P0 | 前端 | API 客户端层统一、消除 any 类型 |
| 🟡 P1 | 前端 | audioStore 拆分为 3 模块、5 个大组件拆分为 15+ 子组件 |
| 🟡 P1 | 前端 | ErrorBoundary、TypeScript strict 模式 |
| 🟢 P2 | 后端 | 清理误入文件、代码整洁 |

---

## v0.0.5 — 后端完善 + 课程导入 + 进度统计

**日期**: 2026-06-06 · [📋 产品计划](v0.0.5/product-plan.md) · [🏗️ 技术架构](v0.0.5/technical-architecture.md)

**主题**：单词API后端化、课程导入UI、学习进度统计、错误处理。

| 优先级 | 功能 |
|---|---|
| 🔴 P0 | 单词API、课程导入UI、学习进度统计页 |
| 🟡 P1 | 全局错误处理、听写增强、设置扩展、骨架屏 |
| 🟢 P2 | 跟读模式、移动端响应式、学习提醒 |

---

## v0.0.4 — 听写模式 + 工程质量

**日期**: 2026-06-06 · [📋 产品计划](v0.0.4/product-plan.md) · [🏗️ 技术架构](v0.0.4/technical-architecture.md) · [📋 评审报告](v0.0.4/review-report.md)

**主题**：听写模式、组件拆分、课程导入UI、动画打磨。

| 优先级 | 功能 |
|---|---|
| 🔴 P0 | 听写模式MVP、ContentPanel拆分为6个View、过渡动画 |
| 🟡 P1 | 课程导入UI、学习进度持久化、单词API优化、错误处理 |
| 🟢 P2 | 移动端响应式、跟读模式、骨架屏 |

---

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
