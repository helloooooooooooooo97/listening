# v0.1.0 评审报告 — 交互细化 & 体验流畅性

**日期**: 2026-06-07
**范围**: 零新功能，存量交互打磨

---

## 一、变更概览

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `components/PlayerBar.tsx` | 重构 | 播放按钮 onPointerDown 即时响应、速度/循环次数下拉菜单、seek 进度条合并入波形、展开视图集成 PlaybackDetailTabs |
| `components/Waveform.tsx` | 重构 | ResizeObserver 自适应宽度、hover 时间预览、拖动 thumb 手柄、点击涟漪动画、拖拽选区 |
| `components/Sidebar.tsx` | 重构 | 选中指示器平滑滑动动画 |
| `components/ContentPanel.tsx` | 改进 | View 切换 250ms fade-in 过渡 |
| `components/TranscriptView.tsx` | 改进 | 词级高亮 200ms 过渡 + scale、滚动仅在越界时触发、句尾听分 badge 可点击、移除统计条 |
| `components/dictation/FeedbackPhase.tsx` | 改进 | 分数 count-up 动画、词级 staggered 入场 (40ms)、对比上次提示 |
| `components/HeartButton.tsx` | **新建** | 收藏按钮弹性 burst 动画 |
| `components/LessonDetailPanel.tsx` | **新建** | 右侧滑出面板：听写/片段/收藏 tabs |
| `components/PlaybackDetailTabs.tsx` | **新建** | 播放详情页左右分栏布局：文本 + 侧边 tabs(片段/听写/收藏) |
| `views/WordsView.tsx` | 改进 | 单词详情面板默认隐藏，点击滑入，关闭按钮 + 遮罩 |
| `views/HomeView.tsx` | 改进 | 收藏按钮改用 HeartButton 组件 |
| `views/ClipsView.tsx` | 改进 | 删除动画 (collapse-out 280ms) |
| `stores/audioStore.ts` | 修复 | 倍速持久化、play() 前恢复速率、移除有问题的 crossfade |
| `index.css` | 扩展 | heart-burst、speed-pop、collapse-out、transcript-word 过渡增强 |

---

## 二、交互改进明细

### 播放栏
- 播放按钮按下瞬间反馈（onPointerDown），消除 ~100ms 延迟
- 速度选择从平铺按钮改为单击弹出下拉列表（0.5x–2x），带 ✓ 标记
- 循环次数从平铺按钮改为下拉（×1–×20）
- 移除播放栏展开/收起箭头，点击封面区展开
- 波形图与进度条合并：波形从 20px→28px，加可拖动 thumb 手柄

### 逐词高亮
- active word 从瞬间切换改为 200ms ease-out 过渡 + scale(1.04)
- 自动滚动加判断：仅在活跃行超出可视区域 2 行以上时触发

### 听写反馈
- 分数数字从 0 滚动到实际值（count-up animation）
- 词级判定结果依次弹出，间隔 40ms + animationFillMode: backwards
- 与上次同句得分对比 ↑/↓ 提示

### 页面导航
- View 切换 250ms fade-in
- 侧边栏选中指示器 position 动画滑动

### 收藏
- HeartButton 弹性 burst 动画 (1→1.35→0.9→1.15→1)
- 选中时触发，取消时不触发

### 列表操作
- 片段删除 collapse-out 收缩动画 (280ms)，动画结束后移除 DOM

### 单词页
- 详情面板默认隐藏，点击单词从右侧滑入
- 带关闭按钮 + 移动端遮罩关闭

### 播放详情页
- 左右分栏：文本 + tabs(片段/听写/收藏)，tab 带计数
- 去除顶部统计栏和文本标题
- 内容区 max-w-7xl (1280px) 居中

---

## 三、Bug 修复

### 倍速不生效
- **根因**: (1) setRate 的 volume crossfade 在某些浏览器导致 playbackRate 设置丢失 (2) 速度偏好未持久化，playLesson 始终读默认 1x
- **修复**: 去掉 crossfade，直接赋值；setRate 同步写入 localStorage；togglePlay 在 play() 前恢复速率

### 波形展开不重绘
- **根因**: window.resize 监听无法捕获 PlayerBar 展开导致的容器宽度变化
- **修复**: 改用 ResizeObserver 监听容器

### 无限重渲染
- **根因**: useEffect 依赖内联表达式产生新引用
- **修复**: 提取稳定变量 + cancelled 标志位

---

## 四、验收

- [x] 播放按钮按下即反馈
- [x] 速度下拉选择正常切换 + 持久化
- [x] 波形拖动 seek + hover 时间预览
- [x] 逐词高亮平滑过渡
- [x] 听写分数 count-up + 词级 staggered
- [x] View 切换有淡入动画
- [x] 侧边栏指示器滑动
- [x] 收藏弹性动画
- [x] 删除收缩动画
- [x] 单词详情面板滑入/关闭
- [x] TypeScript 编译零错误
