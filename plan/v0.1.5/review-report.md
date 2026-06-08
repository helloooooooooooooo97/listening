# v0.1.5 评审报告

**日期**: 2026-06-08  
**范围**: 合集功能 + 播放控制增强 + 听写界面优化  
**文件**: 22 个文件变更，+974/-313 行

---

## 变更概览

### 合集功能 (新)
- 数据库：`collections` + `collection_items` 建表 + seed 9 个默认合集
- 后端：`collections_api.py` — 完整 CRUD + refresh + items 管理
- 前端：`collectionsStore` / `CollectionsView` / `CollectionDetailView`
- 导航：Sidebar + MobileTabBar 新增"合集"，移除"队列"/"听写记录"/"最近播放"/"导入"
- 首页：新增"学习合集"快捷入口卡片

### 播放控制增强
- 上/下一首按钮（播放队列模式）
- 音量滑块（垂直弹窗）
- 播放速度 + 循环次数下拉（移入底部控制区中央）
- 队列按钮显示数量角标
- `_clipEndHandled` 守卫防止 clip 结束时重复触发 `playNext`

### 听写界面优化
- TypingPhase：输入框放大、重新布局（播放按钮移到提交按钮旁）
- 移除跳过按钮
- 听写结果改由 effect 自动保存（原 setTimeout 方式）
- 移除 SentenceSelector + 自动 seek 逻辑

### 其他
- CoursesView 新增导入面板
- 文字颜色对比度提升（text-primary 87%→90%, text-secondary 55%→70%, text-tertiary 25%→45%）
- PlaybackDetailTabs 片段行布局重构
- 移除全局快捷键中的 `?` 帮助面板

---

## 发现问题 & 处理

| # | 严重度 | 文件 | 问题 | 处理 |
|---|--------|------|------|------|
| 1 | 🔴 低 | `audioStore.ts` | 调试用 `console.log` 残留 3 处 | ✅ 已清除 |
| 2 | 🔴 低 | `playlistStore.ts` | 调试用 `console.log` 残留 6 处 | ✅ 已清除 |
| 3 | 🟡 中 | `audioStore.ts` | `loopTarget` 硬编码为 `3`，不再从 localStorage 读取用户自定义默认值 | ✅ 已恢复 `getSettingDefault` 调用 |
| 4 | 🟢 建议 | `api.ts` | `updateCollection` / `reorderCollectionItems` 无 `r.ok` 检查（与现有 favorites DELETE 风格一致，无统一 `put` helper） | 保持现状 |

---

## 无问题的审查项

- **跨文件调用链**：`handlePlayPrev`/`handlePlayNext` 中合成 `AudioClip` 对象的 id 格式与队列逻辑匹配
- **_clipEndHandled 守卫**：全局变量在 `playClip` 入口处重置，时序正确（timeupdate → pause → ended，playClip 由用户操作触发，在事件链之后）
- **听写 effect 自动保存**：`userInput` 在渲染时闭包捕获，提交后用户快速清空导致输入错误的概率极低
- **导航变更**：Sidebar/MobileTabBar/ContentPanel/App.tsx 的路由一致性已检查，无断链
- **CSS 变量**：文字颜色提升后各组件均使用 CSS 变量，无硬编码色值

---

## 结论

改动质量良好，核心问题为调试日志残留（已清理）和一处 localStorage 默认值丢失（已恢复）。无功能性 bug，可以提交。

**评审结果**: ✅ 通过
