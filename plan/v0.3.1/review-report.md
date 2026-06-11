# v0.3.1 Review Report — 游戏体验打磨

> 聚焦游戏交互体验细化与视觉反馈，补全辅助功能

---

## 一、目录结构（最终）

```
frontend/src/
├── components/game/
│   ├── GameTile.tsx              # 【修改】点击反馈、遮挡样式、释义预览入口
│   ├── GameBoard.tsx             # 【修改】不变
│   ├── GameModal.tsx             # 【修改】结算页新增消除单词列表 + 音频
│   ├── GameLevelSelect.tsx       # 【修改】来源按钮新增 sample 试听
│   ├── SlotBar.tsx               # 【修改】消除动画、匹配发光、绿闪反馈
│   └── TilePopup.tsx             # **新建** — 长按/右键单词释义浮层
│
├── components/words/
│   ├── WordDetailPanel.tsx       # 【修改】播放出现记录时 scrollIntoView
│   └── ReviewModal.tsx           # 不变
│
├── views/
│   ├── GameView.tsx              # 【修改】难度调整 toast、消除计数动画、音频入口
│   └── WordsView.tsx             # 【修改】选中词滚动、单词行播放按钮
│
├── stores/
│   └── gameStore.ts             # 【修改】消除动画状态机、动态难度、游戏统计
│
├── hooks/
│   └── useWordAudio.ts          # 不变（新增调用方）
│
├── lib/
│   └── api.ts                   # 不变
│
└── index.css                    # 不变（animate-speed-pop 已定义）
```

---

## 二、功能交付

### 2.1 点击 & 消除反馈（P0）

| 模块 | 效果 | 实现 | 状态 |
|------|------|------|------|
| **tile 点击** | 轻微下沉 + 弹起 | `active:scale-95` + `transition 100ms` | ✅ |
| **tile 消除** | 3 匹配词从槽位缩小淡出 | `scale-0 opacity-0`，200ms CSS | ✅ |
| **被遮挡 tile** | 半透明 + 灰度视觉区分 | `opacity-40 grayscale`，不参与交互 | ✅ |
| **消除成功** | 槽位短暂闪烁绿色边框 300ms | CSS class `lastMatchSuccess` 切换 | ✅ |
| **匹配倒计时** | 槽位中 2 个相同词微微发光 | `box-shadow` 内发光 + `ring-1` | ✅ |
| **槽位满时棋盘变暗** | 全屏半透明遮罩 | `rgba(0,0,0,0.15)` 覆盖层 | ✅ |

### 2.2 可点击 tile 高亮（P0）

| 状态 | 视觉效果 | 状态 |
|------|----------|------|
| 可点击（入度=0） | 正常亮度，hover 轻微提亮 + 上浮 | ✅ |
| 被遮挡（入度>0） | `opacity-40 grayscale`，不可点击 | ✅ |
| 鼠标悬停可点击 | `brightness(1.1)` + `hover:-translate-y-0.5` | ✅ |
| 全部不可点击 | 槽位满时棋盘整体变暗 | ✅ |

### 2.3 动态难度适应（P1）

| 条件 | 行为 | 状态 |
|------|------|------|
| 连续失败 2 次 | 下一局自动降一档（hard→medium→easy） | ✅ |
| 连续过关 3 次 | 下一局自动升一档（easy→medium→hard） | ✅ |
| 难度变更时 | Toast 提示「自动调整至 ×× 难度」，3s 自动消失 | ✅ |
| 持久化 | localStorage 记录连胜/连败 | ✅ |

### 2.4 释义预览（P1）

| 交互 | 说明 | 状态 |
|------|------|------|
| 长按 500ms tile | 弹出词典释义浮层 | ✅ |
| 右键 tile | 弹出词典释义浮层 | ✅ |
| 浮层内容 | 单词 + 音标 + 词性 + 简短中文释义 | ✅ |
| 消失 | 点击其他地方 → 关闭 | ✅ |
| API | `GET /api/dictionary/{word}` | ✅（已有） |

### 2.5 游戏统计（P1）

| 字段 | 来源 | 状态 |
|------|------|------|
| `session_id` | `game-{ts}-{random}` | ✅ |
| `difficulty` | 当前难度 | ✅ |
| `word_count` | `totalWords` | ✅ |
| `matched` | `matchedWords.length` | ✅ |
| `elapsed` | 游戏内计时 | ✅ |
| `win` | `status === 'won'` | ✅ |
| `source` | 单词来源（today/review/all） | ✅ |
| `tools_used` | 道具使用计数 | ✅ |
| 存储 | localStorage `sheep_game_history`（保留 200 条） | ✅ |

### 2.6 消除 = 复习强感知（P1）

| 反馈 | 说明 | 状态 |
|------|------|------|
| 进度计数 | 消除数字 `animate-speed-pop` 跳动 | ✅ |
| 结算页增强 | 显示「本轮复习成功 N 个单词」 | ✅ |
| 消除回顾 | 结算页可展开已消除单词列表 | ✅ |
| 消除列表音频 | 列表中每个单词悬停显示播放按钮 | ✅ |

### 2.7 useWordAudio 接入更多入口（P2）

| 入口 | 实现 | 状态 |
|------|------|------|
| WordsView 单词行 | hover 出现 HiPlay 按钮 → `playWordAudio` | ✅ |
| 游戏结算页已消除列表 | 列表行悬停出现播放按钮 | ✅ |
| 难度选择页单词来源 | 来源按钮悬停出现试听按钮 | ✅ |

---

## 三、Bug 修复清单

| Bug | 诊断 | 修复 |
|-----|------|------|
| 播放音频时详情面板不跟随滚动 | WordDetailPanel 播放后无 scrollIntoView | 添加 `data-play-occ` 属性 + `scrollIntoView({ behavior: 'smooth', block: 'center' })`  `WordDetailPanel.tsx` |
| 选中单词时左侧列表不跟随 | WordsView 详情面板打开后列表位置不动 | 添加 `data-word` 属性 + 选中时 `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`  `WordsView.tsx` |
| 匹配消除游戏状态时序错乱 | 消除动画分两步（Step 1 → setTimeout Step 2），`matchingWord` 在 250ms 内阻塞点击 | 合并为原子更新：匹配检测后立即删牌，CSS 动画独立控制  `gameStore.ts` |
| useUndo/useRemove3 道具计数提前递增 | `set({ toolsUsed })` 在函数开头，`lastIdx < 0` 提前返回时计数已加 | 合并 `toolsUsed` 到最终 `set()`  `gameStore.ts` |
| reset 后连胜/连败显示退化 | reset 使用模块缓存 `_createStreak` 而非重读 localStorage | 改为 `loadStreak()` 实时读取  `gameStore.ts` |
| GameTile 长按 timer 卸载泄漏 | 卸载后 setTimeout 仍可能触发 `setPopupAnchor` | 添加 `useEffect` cleanup  `GameTile.tsx` |

---

## 四、架构变更

### 游戏状态机新增字段

```
matchingWord: string | null       → 消除动画触发（瞬态，原子更新后始终 null）
lastMatchSuccess: boolean         → 消除成功绿闪（300ms 自动清除）
consecutiveWins / consecutiveLosses → 动态难度连击计数（localStorage 持久化）
difficultyMessage: string | null  → 难度调整 Toast
toolsUsed: { shuffle, undo, remove3 } → 道具使用统计
gameSource: string                → 单词来源（today/review/all）
```

### 消除流程优化

```
原流程（二分步，有 bug）:
  clickTile → Step1: set({matchingWord, slot保留全部tile}) → 250ms后 → Step2: 删牌

现流程（原子更新）:
  clickTile → 检测匹配 → 立即删牌 → set({slot: cleanSlot}) → CSS 动画独立触发
```

### 动态难度流程

```
游戏结束（won/lost）
  ↓
updateStreakOnEnd()
  ↓
loadStreak() → 更新连胜/连败
  ↓
suggestDifficulty() → 是否需要调整
  ↓
set({ difficulty, difficultyMessage }) → Toast 提示
```

---

## 五、代码评审回顾

| 维度 | 发现问题 | 已修复 |
|------|----------|--------|
| 道具计数提前递增 | useUndo/useRemove3 在 early return 前增加计数 | ✅ |
| 多余 render | 道具函数两次 set() | ✅ |
| reset 状态退化 | 使用模块缓存而非实时读取 | ✅ |
| 卸载泄漏 | GameTile 长按 timer | ✅ |
| dead code | matchingWord 不再用于动画，清理 SlotBar prop | ✅ |

---

## 六、未完成（后续版本）

- **释义预览浮层动画** — TilePopup 当前为显隐切换，无过渡动画
- **游戏统计可视化** — 数据已存 localStorage，无展示页面
- **消除飞行动效** — 匹配词从槽位「飞到」进度条的动效未实现
- **移动端适配** — 游戏页面目前未做响应式
- **多端排行榜/成就** — 需要后端支持

---

## 七、文件变更统计

| 指标 | v0.3.0 → v0.3.1 |
|------|-----------------|
| 修改文件 | 8 |
| 新建文件 | 1 (`TilePopup.tsx`) |
| 代码行（+ / -） | +375 / -60 |
| 修改前端组件 | 8 |
| 新建前端组件 | 1 |
| TypeScript 错误 | 0 |

### 按模块

| 目录 | 变更 |
|------|------|
| `frontend/src/stores/` | gameStore.ts 重构消除流程 + 新增动态难度/统计 |
| `frontend/src/components/game/` | 5 组件修改 + 1 新建 |
| `frontend/src/components/words/` | WordDetailPanel 滚动修复 |
| `frontend/src/views/` | GameView + WordsView 增强 |
