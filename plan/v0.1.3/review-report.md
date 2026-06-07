# v0.1.3 评审报告 — 播放队列重做

**日期**: 2026-06-07

---

## 已实现功能

### 队列模型扩展
- `QueueItem` 新增 `sentence` 和 `word` 类型
- `addAllToQueue(items)` — 批量入队（自动去重）
- `playNow(item)` — 立即播放：截断当前之后 + 追加 + 跳转
- `repeatMode`: 顺序 / 全部循环 / 随机 / 单曲循环
- `queueItemLabel/sub` 辅助函数

### ended 处理器
- 支持 `sentence` 类型：创建临时 clip 播放句子范围
- 支持 `word` 类型：带 `wordPlayOffset` 上下文播放
- `repeat-one` 模式：循环当前项

### 播放详情页集成
- 片段列表工具栏：「全部入队」替换「连续播放」
- 每个片段项新增 ➕ 按钮 → 加入队列
- 每条听写记录新增 ➕ 按钮 → 句子加入队列
- 听写记录保留 < 80% 复练按钮

### 标题栏快捷操作
- 📝 听写模式切换
- ➕ 全部片段加入队列
- 🔄 循环模式切换（顺序/全部循环/随机/单曲循环）
- Toast 反馈所有操作

### 播放队列页面
- 类型图标：🎵音频 / 🔖片段(amber) / 📝句子(violet) / 📖单词(blue)
- 当前播放项高亮 + accent 色左边条
- 循环模式按钮
- 播放历史保持

### 文件改动
| 文件 | 变更 |
|---|---|
| `stores/playlistStore.ts` | 重写：新类型 + 批量方法 + 循环模式 |
| `stores/audioStore.ts` | ended 支持 sentence/word + repeat-one |
| `components/PlayerBar.tsx` | 标题栏快捷按钮 + 队列操作 |
| `components/PlaybackDetailTabs.tsx` | 队列集成：入队按钮 + 全部入队 |
| `views/PlaylistView.tsx` | 重写：新类型渲染 + 循环模式 |

---

## 验收
- [x] 片段可加入队列，自动去重
- [x] 听写句子可加入队列
- [x] 顺序/循环/随机/单曲循环切换
- [x] 标题栏快捷操作
- [x] 队列页面类型图标
- [x] `npm run build` 零错误
