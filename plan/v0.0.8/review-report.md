# v0.0.8 评审报告

> 日期：2026-06-07 · 主题：课程导入 + 播放列表 + 学习提醒
>
> 评审范围：`v0.0.7` → `HEAD`

## 📊 变更概览

| 维度 | 数据 |
|---|---|
| 修改文件 | 16 files |
| 新增代码 | +833 |
| 新增文件 | `import_api.py`, `playlistStore.ts`, `PlaylistView.tsx`, `ImportView.tsx` |
| 外部依赖 | `python-multipart` (文件上传) |

---

## 🎯 交付清单

### P0 — 全部完成 ✅

#### 1. 播放队列/列表
- `playlistStore` (Zustand)：`addToQueue` / `playNext` / `playPrev` / `removeFromQueue` / `reorder` / `clearQueue`
- `PlaylistView`：队列管理界面 + 播放历史（最多 50 条）
- `audioStore`：`ended` 事件自动触发 `playNext()`，实现连续播放
- `PlayerBar`：➕ 按钮将当前音频添加到队列
- 侧边栏新增「播放队列」导航

#### 2. 课程导入 UI
- **后端**：`import_api.py`
  - `POST /api/lessons/import` — 接收 MP3 文件 + 标题/副标题/难度/来源
  - `GET /api/lessons/import/{task_id}` — 轮询导入进度（pending→transcribing→aligning→completed）
  - 后台线程调用 `.venv-whisperx/bin/whisperx` 进行转写 + 词对齐
  - 自动生成标准 lesson JSON 格式
- **前端**：`ImportView.tsx`
  - 拖拽/点击上传 MP3/WAV 文件
  - 元数据表单（标题/副标题/难度 A1-C2/来源 URL）
  - 实时进度条 + 状态文字 + 旋转加载动画
  - 导入完成后提示刷新
- `Sidebar`：新增「导入」导航项

### P1 — 全部完成 ✅

#### 3. 收藏批量管理
- `FavoritesView`：选择模式（「选择」按钮切换）
- 多选复选框 + 已选计数
- 全选/取消 + 批量取消收藏
- 选中状态视觉反馈（accent ring + 背景色）

#### 4. 每日学习目标
- `settingsStore`：新增 `dailyGoalMinutes` 字段
- `SettingsView`：目标按钮组（关闭/5/10/15/30/60 分钟）
- 开启时自动请求浏览器通知权限
- `HomeView`：今日进度条（已听分钟 / 目标分钟）
- 达到目标显示绿色 ✓ 完成标记

---

## 🔍 架构决策

### 导入流程架构
```
用户拖拽 MP3 → POST /api/lessons/import
  → 保存文件到 data/lessons/
  → 后台线程运行 WhisperX
    → 生成 JSON → 完成
  → 前端每 1.5s 轮询 GET /api/lessons/import/{id}
```

### 播放队列架构
```
audioStore.ended
  → playlistStore.playNext()
    → audioStore.playLesson() 或 playClip()
  → addToHistory() 记录历史

队列和音频状态完全解耦，队列只负责「播什么」，音频状态负责「怎么播」
```

---

## 📈 量化评估

| 维度 | 评分 | 说明 |
|---|---|---|
| 功能完整性 | ⭐⭐⭐⭐⭐ | P0+P1 全部交付 |
| 代码质量 | ⭐⭐⭐⭐ | TypeScript strict 零错误 |
| 架构设计 | ⭐⭐⭐⭐ | 队列/导入/收藏各模块职责清晰 |
| 用户体验 | ⭐⭐⭐⭐ | 导入进度条、队列管理、批量操作 |
| 可维护性 | ⭐⭐⭐⭐ | 每个功能模块独立文件 |

---

## ✅ 准出建议

**建议通过**，关闭 v0.0.8。

---

*评审人：Claude Code · 2026-06-07*
