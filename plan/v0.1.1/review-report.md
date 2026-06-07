# v0.1.1 评审报告 — 播放详情页交互打磨

**日期**: 2026-06-07

---

## 变更概览

| 文件 | 变更 |
|---|---|
| `types/lesson.ts` | AudioClip 新增 `color` 字段 |
| `lib/api.ts` | createClip 支持 `color` 参数 |
| `stores/clipsStore.ts` | ClipApiRow + toAudioClip + createClipRemote 透传 color |
| `components/TranscriptView.tsx` | 片段颜色选择器(6色圆圈)、clipColor 渲染文字背景、hover/active clip 联动高亮 |
| `components/PlaybackDetailTabs.tsx` | 侧边栏折叠/展开、clip hover/active 联动、听写点击seek句子、收藏点击seek单词 |
| `backend/app/database.py` | clips 表新增 color 列 + 迁移 |
| `backend/app/routers/clips_api.py` | ClipCreate + INSERT 支持 color |

---

## 已实现功能

### 片段颜色
- 选中文本后工具栏弹出 6 色圆圈（红/橙/黄/绿/蓝/紫）
- 当前选中颜色高亮边框，hover 放大
- 保存后片段在 transcript 中以对应颜色渲染背景
- DB 默认 `#facc15`(琥珀色)保持向后兼容

### Transcript ↔ 侧边栏联动
- 侧边栏片段 hover → transcript 对应词高亮增强
- 当前播放片段在侧边栏高亮（accent-soft 背景）+ 彩色图标
- 点击片段 → seek + 播放
- 点击听写记录 → seek 到句子开头
- 点击收藏单词 → seek 到第一个出现位置

### 侧边栏折叠
- 展开时 360px，显示 tabs + 内容 + 折叠按钮(→)
- 折叠后 48px，仅图标 + 展开按钮(←)
- 带 300ms 过渡动画
- 移动端(<1024px)折叠时完全隐藏侧边栏

---

## 验收
- [x] 片段颜色选择 + 渲染
- [x] hover 联动高亮
- [x] 点击联动跳播
- [x] 侧边栏折叠/展开
- [x] TypeScript 零错误
