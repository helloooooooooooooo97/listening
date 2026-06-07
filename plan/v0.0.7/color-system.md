# 色彩体系设计文档

> 参考：Notion 色彩系统 · 2026-06-07

---

## 1. 核心原则

- **语义优先**：颜色按用途命名（`--bg-primary`），而非按色值命名（`--bg-white`）
- **双主题**：深色/浅色由 `data-theme` 属性控制，CSS 变量切换
- **最小化硬编码**：所有颜色通过 CSS 变量引用，组件中不使用原始色值
- **渐进适配**：工具类（`.text-primary`, `.surface-card`）封装常用组合

---

## 2. CSS 变量体系

### 2.1 背景色

| 变量 | 深色模式 | 浅色模式 | 用途 |
|---|---|---|---|
| `--bg-primary` | `#0a0a0b` | `#ffffff` | 页面主背景 |
| `--bg-secondary` | `#1a1a1d` | `#f7f6f3` | 侧边栏、面板 |
| `--bg-tertiary` | `rgba(255,255,255,0.028)` | `rgba(0,0,0,0.028)` | 卡片、条目背景 |
| `--bg-hover` | `rgba(255,255,255,0.045)` | `rgba(0,0,0,0.045)` | 悬浮态 |
| `--bg-active` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` | 激活态 |

### 2.2 文字色

| 变量 | 深色模式 | 浅色模式 | 用途 |
|---|---|---|---|
| `--text-primary` | `rgba(255,255,255,0.87)` | `#37352d` | 标题、正文 |
| `--text-secondary` | `rgba(255,255,255,0.55)` | `rgba(55,53,53,0.65)` | 副标题、说明 |
| `--text-tertiary` | `rgba(255,255,255,0.25)` | `rgba(55,53,53,0.4)` | 提示、时间戳 |

### 2.3 边框色

| 变量 | 深色模式 | 浅色模式 | 用途 |
|---|---|---|---|
| `--border-primary` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.08)` | 主要分割线 |
| `--border-secondary` | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.045)` | 弱分割线 |

### 2.4 功能色

| 变量 | 值（双主题一致） | 用途 |
|---|---|---|
| `--accent` | `#fa2d48` | 品牌色、按钮、高亮 |
| `--accent-soft` | `rgba(250,45,72,0.12)` | 激活态背景 |
| `--overlay` | 深:rgba(0,0,0,0.85) 浅:rgba(255,255,255,0.85) | 模态层背景 |
| `--glass-bg` | 深:rgba(28,28,30,0.85) 浅:rgba(255,255,255,0.85) | 毛玻璃背景 |

---

## 3. CSS 工具类

### 背景
```css
.surface-card     { background: var(--bg-tertiary); border: 1px solid var(--border-secondary); }
.surface-hover:hover { background: var(--bg-hover); }
.glass            { background: var(--glass-bg); backdrop-filter: blur(40px); }
```

### 文字
```css
.text-primary   { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-tertiary  { color: var(--text-tertiary); }
.on-accent      { color: #fff; }  /* 仅用于彩色按钮上的白色文字 */
```

---

## 4. class 使用规范

| 场景 | 使用 | 替代「不要用」 |
|---|---|---|
| 页面背景 | `bg-[var(--bg-primary)]` | `bg-[#0a0a0b]` / `bg-black` |
| 卡片背景 | `className="surface-card"` | `style={{ background: 'rgba(...)' }}` |
| 主要文字 | `text-primary` | `text-white/80` / `text-white` |
| 次要文字 | `text-secondary` | `text-white/40` ~ `text-white/70` |
| 弱化文字 | `text-tertiary` | `text-white/10` ~ `text-white/35` |
| 分割线 | `border-[var(--border-primary)]` | `border-white/[0.06]` |
| 悬浮态 | `surface-hover` | `hover:bg-white/[0.06]` |
| 彩色按钮文字 | `on-accent` | `text-white`（会跟随主题） |
| 阴影 | 保持硬编码 | 阴影不依赖主题 |

---

## 5. 特殊处理说明

### 5.1 播放按钮（白底黑图标）
```tsx
className="bg-white text-black"  // 保持硬编码，这是设计意图
```
播放/暂停按钮使用纯白底黑图标，不跟随主题。

### 5.2 功能色标记
```css
/* 已掌握 - 绿色 */
.word-known { color: rgba(52,211,153,0.75); }

/* 片段标记 - 黄色 */
.clip-bg { background: rgba(250,204,21,0.XX); }

/* 听写错误 - 红色波浪线 */
.dictation-error { text-decoration: wavy underline rgba(239,68,68,0.6); }
```
功能色标记保持独立，不跟随主题（无论深色/浅色都是绿色/黄色/红色）。

### 5.3 波形颜色
```css
--waveform-played: #fa2d48;       /* 已播放部分 - 品牌红 */
--waveform-unplayed: var(--...);   /* 未播放部分 - 跟随主题 */
```

---

## 6. 主题切换机制

```
用户点击设置中的主题按钮
  → themeStore.toggle()
    → localStorage.setItem('app-theme', 'light')
    → document.documentElement.setAttribute('data-theme', 'light')
      → CSS :root 变量被 [data-theme="dark"] 覆盖
        → 所有使用 var(--*) 的样式自动更新
```

### 当前覆盖情况（全量迁移完成）

| 模式 | 状态 | 替换为 |
|---|---|---|
| `bg-[#0a0a0b]` | ✅ 全部替换 | `bg-[var(--bg-primary)]` |
| `bg-black` | ✅ App.tsx 已替换 | `bg-[var(--bg-primary)]` |
| `bg-[#1a1a1d]` | ✅ SentenceSelector 替换 | `bg-[var(--bg-secondary)]` |
| `bg-[#fa2d48]` | ✅ 全部替换 | `bg-[var(--accent)]` |
| `bg-white/[0.01~0.12]` | ✅ 50处全部替换 | `bg-[var(--bg-XXX)]` |
| `text-white` | ✅ 仅ErrorBoundary保留 | `text-primary/secondary/tertiary` |
| `text-[#fa2d48]` | ✅ 全部替换 | `text-[var(--accent)]` |
| `border-white/[0.02~0.08]` | ✅ 全部替换 | `border-[var(--border-XXX)]` |
| `rgba(255,255,255,0.0X)` | ✅ 全部替换 | `var(--bg-tertiary)` 等 |
| Sidebar | ✅ 重构为循环+主题变量 | 消除全部硬编码 |
| 工具类定义 | ✅ `.surface-card`, `.text-primary` 等 |
| 主题切换 UI | ✅ SettingsView 主题卡片 |
| 持久化 | ✅ localStorage |
| CSS 变量 | ✅ 新增 `--accent-hover`, `--accent-gradient` |

### 未覆盖（有意保持）

| 元素 | 原因 |
|---|---|
| 播放按钮 `bg-white text-black` | 设计意图，不跟随主题 |
| 播放按钮阴影 `boxShadow` | 阴影不依赖主题 |
| 功能色（绿/黄/红标记） | 语义色，不跟随主题 |
| ErrorBoundary 页面 | 错误页面保持独立 |
