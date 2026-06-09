# v0.1.9 产品计划 — 性能优化

**日期**: 2026-06-08
**主题**: 全面性能优化，重点解决 Safari/WKWebView 卡顿问题、后端数据加载瓶颈、启动速度。

---

## 一、Safari 卡顿根因分析

### 对比测试数据

| 场景 | Edge (Chromium) | Safari (WKWebView) | 原因 |
|------|-----------------|-------------------|------|
| 歌词滚动 | 60fps 流畅 | 30-45fps 掉帧 | `backdrop-filter` + `background` transition |
| 音频列表渲染 | 即时 | 500ms+ 白屏 | 191 个 Audio 预加载 + 大 DOM |
| 页面切换 | 丝滑 | 明显卡顿 | `scale()` + `opacity` 动画在 Safari 不走 GPU |
| 首页加载 | ~800ms | ~2.5s | 后端顺序读取 191 个 JSON 文件 |

### 核心差距

Safari 的 WKWebView 在三个关键领域弱于 Chromium：

1. **`backdrop-filter`** — Chromium 走 GPU 合成层，Safari 走 CPU 光栅化
2. **CSS `background` transition** — Safari 每帧都触发完整 paint，Chromium 优化为部分更新
3. **`<Audio>` 多元素预加载** — Safari 的媒体管道单线程处理，191 个预加载阻塞 DOM

---

## 二、优化项

### P0 — Safari 卡顿修复（高优先级）

#### 2.1 移除或替换 `backdrop-filter`

**问题**: `.glass` 类中 `backdrop-filter: blur(40px) saturate(180%)` — Safari 每秒回退到 CPU 光栅化

**方案**:
- 将毛玻璃效果改为纯 CSS 渐变 + 低透明度背景
- 或把 `blur(40px)` 降到 `blur(8px)`（Safari 对 <10px 的 blur 有优化）
- 用 `::before` 伪元素的 `opacity` + `background` 模拟毛玻璃色块

```css
/* before — Safari 卡顿 */
.glass {
  backdrop-filter: blur(40px) saturate(180%);
}

/* after — Safari 流畅，视觉效果接近 */
.glass {
  background: rgba(255,255,255,0.82);  /* 直接给透明度 */
}
```

#### 2.2 `transition: background` → `transition: box-shadow`

**问题**: `.transcript-word`, `.transcript-line`, `body` 上的 `transition: background ...` 在 Safari 触发重绘

**方案**:
- 用 `box-shadow` 模拟 hover/active 高亮（shadow transition 走 GPU）
- 或改用 `outline` + `transition: outline`（Safari 对 outline transition 有合成层优化）

```css
/* before */
.transcript-line {
  transition: background 0.2s;
}

/* after */
.transcript-line {
  transition: box-shadow 0.2s;
}
.transcript-line.active {
  box-shadow: inset 0 0 0 2px var(--accent-soft);
}
```

#### 2.3 动画走 GPU 属性

**问题**: 多个动画同时使用 `transform` + `opacity` + `background`，Safari 不自动提升合成层

**方案**:
- 给动画元素加 `will-change: transform, opacity`
- 确保 `transform` 和 `opacity` 以外的属性不参与动画

#### 2.4 音频预加载改为按播放队列预取

**问题**: `preloadLessonAudio` 在启动时为全部 191 个 lesson 创建 `<Audio>` 元素并 `load()`，Safari 的媒体管道单线程处理导致 DOM 阻塞

**方案**:
- 去掉全局预加载，改为**监听队列变化**，只预加载队列中各条目所需音频
- 在 `playlistStore` 中添加 `subscribe`，队列变动时自动预取涉及到的 `lessonId`
- 队列中唯一约束：同一 `lessonId` 只预取一次

```typescript
// before — App.tsx 启动时一次性预加载全部
preloadLessonAudio(data.map(l => l.id));  // 191 个！

// after — 只预加载队列里用到的音频
usePlaylistStore.subscribe(
  state => state.queue,
  queue => {
    const ids = new Set(queue.map(item => {
      if (item.kind === 'lesson') return item.lesson.id;
      return item.lessonId;
    }));
    preloadLessonAudio([...ids]);
  }
);
```

**预期效果**:
- 启动时的 Audio 预加载: 191 → 0
- 播放一个音频时预加载: 1 个
- 播放含 10 个片段的列表时预加载: 1 个（同 lessonId 去重）

---

### P1 — 后端加载加速

#### 2.5 Lesson 缓存（最重要）

**问题**: `list_lessons()` 每次请求都读取并解析全部 191 个 JSON 文件（每个 100-500KB，共 ~20MB JSON）

**方案**:
- 启动时加载一次，缓存在内存中
- 文件变动时自动刷新（`os.stat` 检查 mtime，或文件系统事件）
- 缓存存活期: 整个应用生命周期

```python
# 模块级缓存
_lessons_cache: list[LessonSummary] | None = None
_lessons_mtime: float = 0

def list_lessons() -> list[LessonSummary]:
    global _lessons_cache, _lessons_mtime
    current_mtime = max(f.stat().st_mtime for f in LESSONS_DIR.glob("*.json"))
    if _lessons_cache is None or current_mtime > _lessons_mtime:
        _lessons_cache = [_build_summary(f) for f in sorted(LESSONS_DIR.glob("*.json"))]
        _lessons_mtime = current_mtime
    return _lessons_cache
```

**预期效果**: 首次 ~500ms → 后续 ~1ms

#### 2.6 统计接口缓存

**问题**: `/api/stats/overview` 每次执行 8+ 条独立 SQL 查询

**方案**:
- 将多条 SQL 合并为更少的查询
- 对变化不频繁的数据（total_audios, total_words）计算结果缓存 30 秒

#### 2.7 单词计数惰性化

**问题**: `_load_lesson(f).words` 在 `get_stats` 和 `list_lessons` 中重复读取

**方案**:
- `wordCount` 直接存到 `LessonSummary` 缓存中，避免重新解析
- `get_stats()` 的 `uniqueWords` 从 `lessonSummary.wordCount` 汇总

---

### P2 — 前端渲染优化

#### 2.8 音频列表虚拟化

**问题**: `CoursesView.tsx` 一次性渲染全部 191 个音频卡片 DOM 节点

**方案**:
- 使用 Intersection Observer 做懒渲染
- 或限制初始渲染数量（前 50 个），滚动动态加载

#### 2.9 减少不必要的 re-render

**问题**: `timeupdate` 事件每 250ms 触发 `set({ currentTime: t, currentSentenceIndex: sentenceIdx })`，导致所有订阅 `currentTime` 的组件重新渲染

**方案**:
- `currentSentenceIndex` 只在变化时 set（当前是每帧都 set）
- 歌词高亮用 CSS class 切换而非状态驱动

```typescript
// before
set({ currentTime: t, currentSentenceIndex: sentenceIdx });  // 每秒 4 次

// after
const prev = get().currentSentenceIndex;
if (sentenceIdx !== prev) {
  set({ currentSentenceIndex: sentenceIdx });
}
```

#### 2.10 图片/图标按需加载

**问题**: `react-icons/hi2` 打包全部图标到主 JS

**方案**:
- Vite 的 tree-shaking 已经在做了，确认 bundle 中只有使用到的图标
- 检查是否有未使用的图标导入

---

### P3 — 构建优化

#### 2.11 JS 分块优化

**问题**: `index-CmbpGK18.js` 328KB，包含所有公共依赖

**方案**:
- 确保 Vite 自动代码分割有效
- `react-icons` 可能在 chunk 边界被重复打包

#### 2.12 CSS 体积

**问题**: `index-CnczoVh8.css` 57KB，包含所有动画定义和 Tailwind 工具类

**方案**:
- Tailwind v4 的 `@import "tailwindcss"` 可能未开启 purging
- 确认生产构建自动移除未使用的 CSS

---

## 三、Benchmark 验证

优化前后对比基准：

| 指标 | 优化前 | 目标 | 测量方式 |
|------|--------|------|---------|
| Safari 歌词滚动 fps | 30-45fps | 60fps | Safari Web Inspector → FPS meter |
| 首页 API 响应时间 | ~500ms | <20ms | `/api/lessons/` 响应时间 |
| 页面切换卡顿 | 明显 | 无感 | 肉眼观测 + Console profile |
| `backdrop-filter` 渲染 | CPU 光栅化 | GPU 合成 | Safari Layers panel |
| 应用启动到可用 | ~3s | <1.5s | 从 open 到页面渲染完成 |
| 音频预加载内存 | 191 Audio 对象 | 20 Audio 对象 | `/proc/pid/maps` or Activity Monitor |

---

## 四、任务拆分

### 🔴 P0 — Safari 修复（高优，2-3h）

- [ ] **4.1 替换 backdrop-filter**: `.glass` 改为纯色背景，保留视觉一致性
- [ ] **4.2 transition 优化**: `background` → `box-shadow`/`outline`
- [ ] **4.3 主动提升合成层**: `will-change` 加到动画元素
- [ ] **4.4 音频预加载改为按队列预取**: 去掉全局 191 个预加载，监听队列变化只加载所需音频

### 🟡 P1 — 后端加速（2h）

- [ ] **4.5 Lesson 列表缓存**: 模块级缓存 + mtime 检查
- [ ] **4.6 统计接口查询合并**: 减少 SQL 轮次
- [ ] **4.7 单词计数复用**: 复用缓存数据

### 🟢 P2 — 前端渲染（1h）

- [ ] **4.8 减少 timeupdate re-render**: `currentSentenceIndex` 只在变化时 set
- [ ] **4.9 音频列表懒渲染**: Intersection Observer 或 limit initial

### 🔵 P3 — 构建检查（0.5h）

- [ ] **4.10 确认 tree-shaking**: 检查 bundle 中是否有未用图标
- [ ] **4.11 CSS purge 确认**: Tailwind v4 生产构建行为

---

## 五、预期效果

| 场景 | 优化前 | 优化后 |
|------|--------|--------|
| Safari 歌词滚动 | 30-45fps 卡顿 | 60fps 流畅 |
| 首页加载 (Safari) | ~2.5s | ~1s |
| `/api/lessons/` 响应 | ~500ms | <5ms |
| `/api/stats/overview` | ~200ms | <30ms |
| 音频预加载数量 | 191 个 Audio | 仅队列涉及的数量（通常 1-3 个） |

---

## 六、不涉及

- ❌ 功能变更
- ❌ UI 重设计
- ❌ 数据库 schema 变更
- ❌ 后端 API 接口变更
- ❌ 打包/构建流程变更

---

## 七、预估

| 优先级 | 模块 | 任务数 | 预估 |
|--------|------|--------|------|
| 🔴 P0 | Safari 修复 | 4 | 2-3h |
| 🟡 P1 | 后端加速 | 3 | 2h |
| 🟢 P2 | 前端渲染 | 2 | 1h |
| 🔵 P3 | 构建检查 | 2 | 0.5h |
| **合计** | | **11** | **~5h** |
