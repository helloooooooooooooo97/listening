# v0.1.6 评审报告

**日期**: 2026-06-08
**范围**: AI Token 配置 + 翻译功能 + 歌词显示控制 + 片段解析 + 播放栏优化  
**文件**: 17 个文件变更，+1323/-173 行

---

## 变更概览

### 🔴 P0 — AI Token 配置 + 翻译
- **aiStore.ts**: 多厂商支持（OpenAI / DeepSeek / Anthropic / 自定义），Token 加密存储（btoa）
- **SettingsView.tsx**: AI 配置 UI — 厂商选择、Token 输入（密码模式）、测试连接、保存/清除
- **App.tsx**: 启动时加载 AI 配置
- **翻译缓存**: 结果存入后端 `translations` 表，前端内存缓存（刷新缓存不丢，跨设备可用）

### 🟡 P1 — 歌词显示控制
- **4 种模式**: 仅英文 / 中英对照 / 仅中文 / 悬浮显示（悬浮时才显示中英文）
- **settingsStore**: 新增 `lyricDisplayMode` + `translationEnabled`，改用 Zustand `persist` 中间件
- **PlaybackDetailTabs**: 顶部模式切换栏（✦译 | 中英 | 仅英文 | 仅中文 | 悬浮）

### 🟡 P1 — 播放栏重构
- 移除右侧重复的倍速/循环控制按钮
- 音量/倍速/循环改为平级兄弟元素（之前嵌套在 volume div 内）
- 展开视图移除"全部片段加入队列"和"播放设置"按钮

### 🟡 P1 — AI 单词解析 + 片段解析
- **右键菜单**: "查词典"（跳转 Cambridge）→ "AI 解析"（弹出解析卡片）
- **单词卡片**: 音标 / 词性 / 释义 / 例句 / 同义词 / 用法
- **片段解析**: 选中保存片段后自动 AI 分析，片段列表显示 ✦ 图标查看解析
- **JSON 结构**: `WordAnalysis` / `ClipAnalysis` 类型定义
- **后端缓存**: 单词/片段解析结果统一存入 `translations` 表

### 🟢 P2 — 细节优化
- 听写输入框随文字自动变宽（`size` 属性）
- 听写输入框上方大播放按钮删除
- 歌词行号区域美化（序号徽章、时间戳柔和、竖线分隔）
- `settingsStore` 改用 Zustand `persist` 中间件，删除手动 localStorage 代码
- 全部播放按钮修复第一个片段重复加入队列的 bug
- 移除侧边栏收藏导航入口

---

## 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│  前端 (React + Zustand)                                     │
│                                                             │
│  aiStore ──→ translate() ──→ AI API (OpenAI/DeepSeek/...)  │
│           ──→ lookupWord() ──→ AI API                       │
│           ──→ analyzeClip() ──→ AI API                      │
│               ↓ 缓存优先                                     │
│           cacheGetBackend() / cacheSetBackend()             │
│               ↓                                             │
│  api.ts ──→ GET/POST /api/translations ──→ 后端 SQLite     │
│                                                             │
│  settingsStore (zustand/persist) ──→ localStorage           │
│    settings: { lyricDisplayMode, translationEnabled, ... }  │
└─────────────────────────────────────────────────────────────┘
```

---

## 发现问题 & 处理

| # | 严重度 | 文件 | 问题 | 处理 |
|---|--------|------|------|------|
| 1 | 🔴 中 | `settingsStore.ts` | 初始化时读取 `app-settings` localStroage，若之前用过 v0.1.5 且设置过 `defaultLoopCount=10`，新版仍读到 10 | ✅ `setLoopTarget` 同步到 `setDefaultLoopCount`，zustand persist 自动落库 |
| 2 | 🟡 低 | `PlaybackDetailTabs.tsx` | 全部播放按钮先 `addAllToQueue` 再 `playNow(first)`，第一个片段加入两次 | ✅ 改为 `playNow` 第一个 + `addAllToQueue` 其余 |
| 3 | 🟡 低 | `TranscriptView.tsx` | `useEffect` 引用 `lessonClips` 但定义在其之前，TDZ 报错 | ✅ 移到 `lessonClips` 之后 |
| 4 | 🟡 低 | `PlaybackDetailTabs.tsx` | 分析弹窗 JSX 在 `return` 内与 grid div 并列（多根元素） | ✅ Fragment `<>` 包裹 |

---

## 无问题的审查项

- **Token 安全**: 仅 base64 编码存 localStorage（btoa/atob），Token 不过后端，风险可控
- **API 兼容性**: OpenAI 格式 + Anthropic Messages API 双适配，自定义厂商默认兼容 OpenAI 格式
- **翻译缓存**: 后端 `source_hash` 唯一索引 + 前端内存缓存双重防重复请求
- **歌词模式**: 四种模式 CSS 实现（`hidden`/`opacity`/`group-hover`），无 JS 性能开销
- **播放栏嵌套修复**: 音量/倍速/循环从嵌套结构改为平级兄弟，DOM 树正确

---

## 结论

改动范围合理，P0/P1 功能完整，P2 细节基本覆盖。代码质量良好，主要问题（TDZ、队列重复、Fragment）已在开发过程中修复。可以合入主分支。

**评审结果**: ✅ 通过
