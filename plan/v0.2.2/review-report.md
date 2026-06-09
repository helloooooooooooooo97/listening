# v0.2.2 Review Report

> 正在播放 + 播放队列交互打磨

---

## 一、播放队列增强

### 1.1 默认循环模式
- 从 `sequential` 改为 `repeat-all`（全部循环），播放完队列后自动从头开始

### 1.2 自动滚动到当前项
- 当前播放项用 `ref` + `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`
- `currentIndex` 或面板打开时自动滚动

### 1.3 当前项视觉增强
- 当前播放项左侧加 `border-l-2 border-l-[var(--accent)]` accent 条
- 行背景 `bg-[var(--bg-active)]` 保持不变

### 1.4 拖拽排序
- 原生 HTML5 Drag & Drop，无额外依赖
- `draggable` + `onDragStart`/`onDragOver`/`onDrop`
- 拖拽目标位置显示 `border-t-2 border-[var(--accent)]` 插入指示线
- 调用已存在的 `playlistStore.reorder(from, to)` 方法，自动维护 `currentIndex`

### 1.5 队列持久化
- zustand `persist` 中间件 + `localStorage`（key: `playlist-queue`）
- 刷新页面后队列、当前索引、循环模式均恢复

---

## 二、歌词视图增强

### 2.1 当前句左 accent 条
- `.transcript-line.active` 增加 `border-left: 2px solid var(--accent)`
- `.transcript-line:hover` 也增加同色左边条
- 与片段列表 hover/active 的视觉风格统一

---

## 三、颜色编辑持久化

**之前：** `updateClip` 仅更新 zustand store 内存，刷新后颜色/备注丢失。

**修复：**

| 层 | 改动 |
|----|------|
| **后端** | 新增 `ClipUpdate` schema + `PUT /api/clips/{clip_id}` |
| **前端 API** | 新增 `put<T>()` helper + `updateClip(id, data)` 函数 |
| **前端 Store** | `updateClip` 改为 async：乐观更新 store + 异步调后端 API |

---

## 四、影响范围

| 文件 | 变更 |
|------|------|
| `backend/app/routers/clips_api.py` | +28 行，新增 ClipUpdate + PUT 端点 |
| `frontend/src/lib/api.ts` | +14 行，新增 put helper + updateClip |
| `frontend/src/stores/clipsStore.ts` | updateClip 改为 async + 调后端 API |
| `frontend/src/stores/playlistStore.ts` | 默认 repeat-all + persist 持久化 |
| `frontend/src/components/QueuePanel.tsx` | 拖拽排序 + 自动滚动 + 当前项 accent 条 |
| `frontend/src/index.css` | 歌词 active/hover 左 border |
| `frontend/src/views/ClipsView.tsx` | 小调整 |

---

## 五、已知问题

1. **后端需重启** — `PUT /api/clips/{id}` 端点需手动重启后端服务才能生效
2. **Privoxy 代理拦截** — curl localhost:8000 被系统代理拦截，需用户自己启动后端
3. **拖拽排序限制** — 拖拽时仅显示顶部插入线，不显示完整拖拽预览（原生 DnD 限制）
