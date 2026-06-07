# v0.1.4 评审报告 — 听写模式嵌入播放详情页

**日期**: 2026-06-07

---

## 改动

### ContentPanel
- 删除 `if (dictationActive) return <DictationView />` 全局拦截
- 听写不再独占全屏

### EmbeddedDictation（新建）
- 从 DictationView 抽取核心 UI 逻辑
- 适配左右分栏布局（无全屏 wrapper）
- 接收 `lesson` prop，不依赖 audioStore 推断
- 保持完整交互：自动播放、提交对比、分数反馈、句子导航

### PlayerBar
- 展开视图中判断 `isDictating`
- dictation 激活时渲染 `EmbeddedDictation` 替代 `PlaybackDetailTabs`
- 标题栏 📝 按钮正常切换

---

## 验收
- [x] 听写模式在播放详情页内嵌显示
- [x] 不打断当前页面，不跳转到独立页面
- [x] `npm run build` 零错误
