# v0.3.1 Product Plan — 游戏体验打磨

> **核心理念：** v0.3.0 完成了游戏的核心闭环，v0.3.1 聚焦于游戏交互体验的细化和视觉反馈，让每一步操作都有清晰感知，同时补全常用的辅助功能。

---

## 一、总览

| 维度 | 占比 | 内容 |
|------|------|------|
| Bug | — | 播放音频时详情区域不跟随滚动 |
| 体验 | 60% | 视觉反馈（消除动画、点击反馈、槽位状态）、动态难度适应 |
| 功能 | 30% | 可点击 tile 高亮提示、释义预览、游戏统计 |
| 技术 | 10% | useWordAudio 接入更多入口、代码清理 |

---

## 二、Bug 修复

### 2.0 播放音频时详情区域不跟随滚动（P0 🐛）

**现象：** 在 WordsView 中选中单词并展开详情面板后，点击出现记录播放音频时，详情面板内的出现列表不会滚动到当前播放的那条记录，用户无法直观地看到「正在读的是哪里的哪一句」。

| 场景 | 表现 |
|------|------|
| **WordsView 详情面板** | 点击某一出现记录播放音频，面板内容不动，用户丢失上下文 |
| **游戏结算页（规划中的已消除列表）** | 点击已消除单词播放音频，列表不会将该单词滚动到可视区域 |
| **WordsView 单词列表** | 点击播放音频后，左侧单词列表不会将对应单词行滚动到可视区域（当 detail panel 打开时尤其需要） |

**修复方案：**
1. `WordDetailPanel` 在 `onPlayAt` 触发时，将对应的出现记录按钮 `scrollIntoView({ behavior: 'smooth', block: 'center' })`
2. `WordsView` 单词列表选中一个词后，若 detail panel 打开了，左侧单词列表自动滚动到该词所在行
3. 游戏结算页如实现已消除单词列表，播放音频时联动 `scrollIntoView`
4. 提取通用 hook `useScrollToPlaying` 或通过 audioStore 的 `currentClip` 状态驱动自动滚动

**涉及文件：**
| 文件 | 改动 |
|------|------|
| `frontend/src/components/words/WordDetailPanel.tsx` | 播放发生时 scrollIntoView 对应的出现记录 |
| `frontend/src/views/WordsView.tsx` | 选中单词时滚动单词行到可视区域 |
| `frontend/src/hooks/useWordAudio.ts` | 可选：返回当前播放状态，供组件监听 |
| `frontend/src/stores/audioStore.ts` | 可选：追加 `currentPlayingId` 或事件回调 |

---

## 三、功能详情

### 3.1 点击 & 消除反馈（P0）

当前操作反馈几乎为零——tile 点击后瞬间消失，消除时槽位数字跳动，用户对「发生了什么」感知很弱。

| 模块 | 效果 | 实现 |
|------|------|------|
| **tile 点击** | 点击时有轻微下沉 + 弹起，松手才执行 | CSS `active:scale-95` + `transition 100ms` |
| **tile 消除** | 3 个匹配词从槽位缩小淡出 | `transform: scale(0) + opacity: 0`，200ms ease-out |
| **被遮挡 tile** | 半透明 / 灰度视觉区分 | `opacity: 0.4`，不参与交互 |
| **消除成功** | 槽位短暂闪烁绿色边框 300ms | CSS class 切换，无 scale |
| **匹配倒计时** | 槽位中 2 个相同词微微发光 | `box-shadow` 内发光提示「还差一个」 |

> **Safari 性能：** 全部只用 `transform` + `opacity` + `box-shadow`，GPU 合成，不触发重排。

### 3.2 可点击 tile 高亮（P0）

当前所有 tile 看起来一样，用户不知道哪些点得了、哪些还被压着。

| 状态 | 视觉效果 |
|------|----------|
| 可点击（入度=0） | 正常亮度，hover 轻微提亮 |
| 被遮挡（入度>0） | 半透明 + 灰度，不可点击 |
| 鼠标悬停可点击 | `brightness(1.1)` + 轻微上浮 |
| 全部不可点击 | 槽位满时棋盘整体变暗提示 |

### 3.3 动态难度适应（P1）

让游戏难度自动适应用户水平。

| 条件 | 行为 |
|------|------|
| 连续失败 2 次 | 下一局自动降一档（hard→medium→easy） |
| 连续过关 3 次 | 下一局自动升一档（easy→medium→hard） |
| 首次游玩 | 默认中等难度 |
| 难度变更时 | 弹提示告知「自动调整至 ×× 难度」 |

### 3.4 释义预览（P1）

| 交互 | 说明 |
|------|------|
| 长按 / 右键 tile | 弹出小浮层显示词典释义（从 dictionary 表查询） |
| 浮层内容 | 单词 + 音标 + 词性 + 简短中文释义 |
| 消失 | 点击其他地方或 3 秒后自动消失 |

### 3.5 游戏统计（P1）

游戏结束后记录基本数据，后续可在统计页查看。

| 字段 | 说明 |
|------|------|
| `game_session` | 每局唯一 ID |
| `difficulty` | 难度 |
| `word_count` | 本局单词总数 |
| `matched` | 消除单词数 |
| `elapsed` | 用时（秒） |
| `win` | 是否过关 |
| `source` | 单词来源（today / review / all） |
| `tools_used` | 道具使用情况 |

存储位置：`localStorage` 或 `backend` 新增 `game_history` 表。

### 3.6 消除 = 复习的强感知（P1）

当前消除后用户不知道这个词已经被记录了复习。需要明确反馈：

| 反馈 | 说明 |
|------|------|
| 消除瞬间 | 单词飞到顶部进度条位置（轻量动效） |
| 进度计数 | 消除数字跳动（`animate-speed-pop`，已在 CSS 中） |
| 结算页增强 | 显示「本次复习成功 N 个单词」| 
| 消除回顾 | 结算页列出所有消除的单词（可选点击播放音频） |

### 3.7 useWordAudio 接入更多入口（P2）

| 入口 | 当前 | 目标 |
|------|------|------|
| WordsView 单词列表 | ❌ 无播放 | 点击单词行播放音频 |
| 游戏结算页已消除列表 | ❌ 无播放 | 点击已消除词播放音频 |
| 难度选择页单词来源 | ❌ 无播放 | sample 点击试听 |

---

## 四、涉及文件

### 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/game/GameTile.tsx` | 点击反馈放大，遮挡状态样式 |
| `frontend/src/components/game/GameBoard.tsx` | 低层 tile 半透明，hover 高亮 |
| `frontend/src/components/game/SlotBar.tsx` | 匹配倒计时发光，消除缩小淡出，消除闪烁 |
| `frontend/src/components/game/GameModal.tsx` | 结算增加已消除单词列表 + 音频播放 |
| `frontend/src/components/game/GameLevelSelect.tsx` | 新增难度自动建议 |
| `frontend/src/stores/gameStore.ts` | 动态难度适应逻辑，游戏统计记录 |
| `frontend/src/views/GameView.tsx` | 消除动画触发，难度适应集成 |
| `frontend/src/views/WordsView.tsx` | 单词行接入 useWordAudio |
| `frontend/src/hooks/useWordAudio.ts` | 新增 playDictionaryAudio 方法 |

### 可能新增文件

| 文件 | 说明 |
|------|------|
| `frontend/src/components/game/TilePopup.tsx` | 长按释义浮层 |
| `backend/app/routers/game_stats.py` | 游戏统计 API（可选） |

---

## 五、优先级矩阵

| 功能 | 优先级 | 复杂度 | 用户感知 |
|------|--------|--------|----------|
| 🐛 播放音频时详情区域不跟随滚动 | P0 | ⭐ | 🔥🔥🔥🔥 |
| 可点击/遮挡视觉区分 | P0 | ⭐ | 🔥🔥🔥🔥 |
| 点击反馈 + 消除动画 | P0 | ⭐⭐ | 🔥🔥🔥🔥🔥 |
| 释义预览 | P1 | ⭐⭐⭐ | 🔥🔥🔥 |
| 动态难度适应 | P1 | ⭐⭐ | 🔥🔥🔥 |
| 游戏统计 | P1 | ⭐⭐ | 🔥🔥 |
| 消除 = 复习强感知 | P1 | ⭐⭐ | 🔥🔥🔥🔥 |
| useWordAudio 更多入口 | P2 | ⭐ | 🔥🔥 |

---

## 六、版本信息

| 项目 | 内容 |
|------|------|
| 版本号 | v0.3.1 |
| 预计日期 | 2026-06-10 或 11 |
| 主题 | 游戏体验打磨 |
| 前置依赖 | v0.3.0 主线合并 |
