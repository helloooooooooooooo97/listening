# v0.1.4 评审报告 — 听写模式嵌入播放详情页

**日期**: 2026-06-07

---

## 变更概览

| 文件 | 变更 |
|---|---|
| `components/dictation/EmbeddedDictation.tsx` | **新建** — 从 DictationView 抽取，适配左右分栏布局 |
| `components/dictation/WordBadges.tsx` | **新建** — 词级反馈共享组件（正确/错误/缺失/多余） |
| `components/dictation/FeedbackPhase.tsx` | 改用 WordBadges，移除冗余渲染逻辑 |
| `components/dictation/TypingPhase.tsx` | 垂直居中布局，简化提示文字 |
| `components/dictation/DictationOverview.tsx` | **新建** → 后移除（用户反馈不需要） |
| `components/PlaybackDetailTabs.tsx` | 听写 tab 改为全文句级视图 + 展开词级反馈；片段/听写/收藏 ➕ 入队按钮 |
| `components/TranscriptView.tsx` | 新增 `activeTab` 过滤标识 + `dictationWordResults` 内联 WordBadges |
| `components/ContentPanel.tsx` | 移除 `dictationActive` 全局拦截 |
| `components/PlayerBar.tsx` | 展开视图集成 EmbeddedDictation；标题栏快捷按钮 |
| `stores/dictationStore.ts` | `startFrom(idx)`、`scoreDetails` 持久化 |
| `lib/dictationAligner.ts` | **新建** — 字符级 LCS 对齐算法（共享模块） |

---

## 核心功能

### 听写嵌入播放详情页
- 听写不再独占全屏，在展开视图左侧渲染
- 右侧侧边栏保持可见，随时查看片段/听写/收藏
- `startFrom(idx)` 从当前播放句开始听写
- 全部做完自动退出

### 词级反馈一致性
- `WordBadges` 组件统一三处渲染：FeedbackPhase / 侧边栏 / 歌词
- 字符级 LCS 对齐算法：处理错位匹配、typo 容错（如 `spoted` → `spotted`）
- 正确词绿色、错误词 `~~错词~~ → 正确词`、缺失灰色斜体、多余黄色划线

### Tab 过滤歌词标识
- 片段 tab → 显示片段色块 + 播放按钮
- 听写 tab → 内联 WordBadges 词级反馈
- 收藏 tab → 已掌握词绿色 + ♥ 标记

### 听写侧边栏
- 全文句级视图 + 最佳分数 badge（绿/黄/红）
- 点击展开显示词级 WordBadges
- 低分句复练按钮 + ➕ 入队

---

## 验收
- [x] 听写嵌入播放详情页，不独占全屏
- [x] 三处词级反馈完全一致（WordBadges 复用）
- [x] Tab 切换过滤歌词标识
- [x] 字符级 LCS 对齐算法处理交叉匹配 + typo
- [x] `npm run build` 零错误
