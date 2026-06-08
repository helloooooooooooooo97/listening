# v0.1.6 产品计划 — AI Token 配置 + 歌词显示控制

**日期**: 2026-06-08
**主题**: 支持用户自主配置 AI 厂商 Token，实现歌词翻译功能；同时增加播放详情中英文字幕的显示控制（仅英文、仅中文、悬浮可见）。

---

## 一、为什么做

### 1.1 翻译功能需求
当前应用中，TranscriptView 的 `line.note` 字段已包含中文翻译，但：
- 部分音频没有中文翻译（note 为空）
- 用户需要手动查词典才能理解生词句子
- 集成 AI 翻译后，用户可以一键获取任何句子的中文释义

通过让用户自备 AI 厂商 Token，无需自建翻译服务，零成本实现翻译能力。

### 1.2 歌词显示控制需求
播放详情页的 TranscriptView 中，英文原文（`text`）和中文翻译（`note`）同时显示。用户在不同学习阶段需要不同的显示模式：
- **精听阶段**：只看英文，强迫理解
- **对照阶段**：中英文同时看
- **复习阶段**：只看中文，回忆英文
- **查阅阶段**：鼠标悬浮才显示翻译，默认只看到英文

---

## 二、技术设计

### 2.1 AI Token 配置

#### 存储策略
- **前端 localStorage** 存储 Token（与 settingsStore 相同的模式）
- 支持加密存储（可选）：使用 btoa/atob 简单编码，避免明文展示
- 不在后端存储（减少安全风险，token 仅在前端使用）

#### 支持厂商

| 厂商 | API 地址 | 模型 | 特点 |
|------|---------|------|------|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` | 翻译质量高，速度一般 |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | 性价比高，速度快 |
| **Anthropic** | `https://api.anthropic.com/v1` | `claude-3-haiku-20240307` | 翻译质量好 |
| **本地/自定义** | 用户自定义 URL | 自定义模型名 | 兼容 OpenAI API 格式 |

#### 配置项

```typescript
interface AiProvider {
  id: string;           // 'openai' | 'deepseek' | 'anthropic' | 'custom'
  name: string;         // 显示名称
  apiBase: string;      // API 基础地址
  apiKey: string;       // API Key（加密存储）
  model: string;        // 模型名称
  isDefault: boolean;   // 是否默认翻译引擎
}
```

#### 安全说明
- Token 使用 `btoa()` 编码存储于 localStorage
- 读取时 `atob()` 解码
- 所有 API 调用由**前端直接发起**（fetch → AI 厂商 API），不经过后端
- 首次使用时提示用户："Token 仅存储在本地浏览器中，不会上传到服务器"

### 2.2 翻译功能

#### 翻译范围
- **按句翻译**：TranscriptView 中每条句子行的中文翻译
- **按词翻译**（渐进式）：右键菜单中已存在"查词典"链接，可扩展为"AI 翻译此词"

#### 翻译流程
1. 用户首次点击"翻译"按钮 → 弹出配置提示（如未配置 Token）
2. 已配置 Token → 发起 AI API 调用
3. 返回结果 → 显示在句子行下方（替换/补充现有的 `line.note` 位置）
4. 可选缓存翻译结果（内存缓存，会话级别）

#### API 调用格式（以 OpenAI 兼容 API 为例）

```typescript
async function translateSentence(text: string, provider: AiProvider): Promise<string> {
  const response = await fetch(`${provider.apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: '你是一个英语学习助手。将以下英文句子翻译成中文，保持原意，语言自然流畅。只返回翻译结果，不要解释。' },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 256,
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content.trim();
}
```

#### 翻译状态

| 状态 | 显示 |
|------|------|
| 未配置 Token | 显示"🔑 配置 AI Token 以启用翻译" |
| 翻译中 | 显示加载动画 + "翻译中..." |
| 翻译成功 | 显示中文翻译文本 |
| 翻译失败 | 显示"翻译失败" + 重试按钮 |
| 已缓存 | 直接显示（无延迟） |

#### 缓存策略
- **内存缓存**：`Map<string, string>` 以句子原文为 key
- **会话级别**：刷新页面后清除
- **缓存大小**：最多 200 条

### 2.3 歌词显示控制

#### 显示模式

| 模式 | 英文原文 | 中文翻译 | 适合场景 |
|------|---------|---------|---------|
| **仅英文** | ✅ 显示 | ❌ 隐藏 | 精听训练 |
| **中英对照** | ✅ 显示 | ✅ 一次性显示 | 学习对照 |
| **仅中文** | ❌ 隐藏 | ✅ 显示 | 回忆复习 |
| **悬浮显示** | ✅ 默认显示 | 👆 鼠标悬浮到句子行时才显示 | 自动遮挡翻译，先听后看 |

#### 状态定义

```typescript
type LyricDisplayMode = 'english-only' | 'bilingual' | 'chinese-only' | 'hover-reveal';
```

#### 存储
- 存入 `settingsStore` 扩展字段，持久化到 localStorage
- Key: `lyricDisplayMode`

#### UI 控件
- 放在 TranscriptView 顶部或 PlaybackDetailTabs 的翻译区域
- 4 个按钮/标签页切换
- 带图标 + 文字说明
- 当前模式高亮

#### 实现要点

**悬浮显示（hover-reveal）模式**：
- 加载时所有中文翻译行默认隐藏（`opacity-0` 或 `max-h-0`）
- 鼠标进入句子行区域 → 中文翻译淡入显示（`opacity-100` 过渡）
- 鼠标离开 → 中文翻译淡出隐藏
- 使用 CSS transition，避免 JS 性能开销

**仅英文模式**：
- `line.note` 不渲染
- 句子行保持简洁

**仅中文模式**：
- 英文原文变淡（`opacity-30`）或隐藏
- 中文翻译正常显示

#### Transcript 数据结构适配

当前 `TranscriptLine`：
```typescript
interface TranscriptLine {
  id: string;
  start: number;
  end: number;
  text: string;   // 英文原文
  note: string;   // 中文翻译（可能为空）
}
```

计划中无需改变数据结构。AI 翻译结果和已有 `line.note` 的关系：
- `line.note` 不为空 → 优先显示（来自音频数据的预设翻译）
- `line.note` 为空 + AI 已配置 → 调用 AI 翻译
- AI 翻译结果存入前端内存缓存（不写回数据库）

---

## 三、任务拆分

### 🔴 P0 — AI Token 配置（核心基础）

- [ ] **3.1 AI Token Store**：新建 `frontend/src/stores/aiStore.ts`
  - 支持多厂商配置（openai / deepseek / anthropic / custom）
  - 加密存储 Token（btoa/atob）
  - 获取/设置/删除/切换默认厂商
  - 导出 `translateSentence()` 函数
  
- [ ] **3.2 AI 配置 UI**：在 SettingsView 中新增"AI 翻译"设置区
  - 厂商选择下拉（OpenAI / DeepSeek / Anthropic / 自定义）
  - Token 输入框（密码模式 `type="password"`，可切换可见）
  - API 地址输入（自定义模式时显示）
  - 模型名称输入（可提供默认值）
  - 测试连接按钮
  - 保存/清除配置
  
- [ ] **3.3 翻译 API 层**：`frontend/src/lib/ai.ts`
  - 统一翻译接口 `translateText(text: string): Promise<string>`
  - 各厂商 API 调用格式适配
  - 错误处理 + 超时重试
  - 并发限制（避免短时间内大量请求）

### 🟡 P1 — 翻译功能集成

- [ ] **3.4 句子翻译集成**：TranscriptView 中每行增加翻译按钮
  - 句子行右侧显示"译"按钮（小字）
  - 点击调用翻译 API
  - 结果展示在句尾或行下方
  - 加载/成功/失败状态
  - 缓存命中直接显示

- [ ] **3.5 翻译缓存**：内存缓存实现
  - `Map<string, { result: string; timestamp: number }>`
  - 最多 200 条，超过时淘汰最早的
  - 会话级别

### 🟡 P1 — 歌词显示控制

- [ ] **3.6 Lyrics Display Mode Store**：扩展 settingsStore 或新建 store
  - 4 种模式：english-only / bilingual / chinese-only / hover-reveal
  - 持久化到 localStorage

- [ ] **3.7 显示模式 UI**：播放详情页（PlaybackDetailTabs / TranscriptView）顶部模式切换
  - 4 个紧凑按钮/标签
  - 带图标代表每种模式
  - 当前模式高亮

- [ ] **3.8 模式渲染实现**：TranscriptView 中根据模式控制显示
  - english-only：只渲染英文 words，`line.note` 不渲染
  - bilingual：英文 + 中文同时显示（当前默认行为）
  - chinese-only：英文 words 变淡，中文 note 突出显示
  - hover-reveal：中文 note 默认隐藏，鼠标悬浮句子行时显示

### 🟢 P2 — 细节打磨

- [ ] **3.9 Token 安全性提示**：首次配置时的引导说明
  - "Token 仅存储在本地浏览器中"
  - "不会上传到服务器"
  - "配置一次，每次使用都经由你的 Token 直接访问 AI 厂商"

- [ ] **3.10 翻译批量模式**：一键翻译当前音频所有句子
  - 顶部"全部翻译"按钮
  - 逐句翻译，显示进度条
  - 可取消

- [ ] **3.11 右键菜单集成**：单词右键菜单增加"AI 翻译此词"
  - 调用 translateText 获取词义
  - 弹窗或 tooltip 显示结果

---

## 四、技术要点

### AI API 兼容性

所有主流厂商已统一采用 OpenAI 兼容 API 格式（DeepSeek、通义千问、零一万物等），只需适配：
- **OpenAI / DeepSeek / 自定义**：相同 API 格式，不同 base URL 和 model 名
- **Anthropic**：略有不同（Messages API），需单独适配

建议抽象 `AiAdapter` 接口：

```typescript
interface AiAdapter {
  translate(text: string, apiKey: string, model: string): Promise<string>;
}
```

### 不涉及
- ❌ 后端存储 Token（仅前端 localStorage）
- ❌ 用户登录/账号系统
- ❌ 翻译结果修改/编辑
- ❌ 合集中加入 AI 相关功能
- ❌ 听写模式联动翻译

---

## 五、文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/stores/aiStore.ts` | 新建 | AI Token 配置 + 翻译函数 |
| `frontend/src/lib/ai.ts` | 新建 | AI API 调用封装 + 缓存 |
| `frontend/src/views/SettingsView.tsx` | 修改 | 新增 AI 配置区域 |
| `frontend/src/components/TranscriptView.tsx` | 修改 | 歌词显示模式 + 翻译按钮 |
| `frontend/src/components/PlaybackDetailTabs.tsx` | 修改 | 歌词模式切换 UI |
| `frontend/src/types/lesson.ts` | 修改 | 可能新增 LyricDisplayMode 类型 |
| `frontend/src/stores/settingsStore.ts` | 修改 | 新增 lyricDisplayMode 字段 |

---

## 六、预估

| 优先级 | 模块 | 任务数 | 预估 |
|--------|------|--------|------|
| 🔴 P0 | AI Token 配置 | 3 | 1 天 |
| 🟡 P1 | 翻译功能集成 | 2 | 0.5 天 |
| 🟡 P1 | 歌词显示控制 | 3 | 1 天 |
| 🟢 P2 | 细节打磨 | 3 | 1 天 |
| **合计** | | **11** | **3-4 天** |
