# v0.3.0 Review Report — 羊了个羊 × 单词复习

> 将三消玩法融入单词复习，消除 3 个相同单词 = 复习成功 + 自动播放原文音频

---

## 一、目录结构（最终）

```
frontend/src/
├── hooks/
│   └── useWordAudio.ts              # **新建** — 单词音频播放抽象
│
├── stores/
│   └── gameStore.ts                 # **新建** — 游戏状态机（Zustand）
│
├── components/game/
│   ├── GameBoard.tsx                # **新建** — 棋盘容器（多层级 tile 渲染）
│   ├── GameTile.tsx                 # **新建** — 单个单词 tile
│   ├── GameLevelSelect.tsx          # **新建** — 难度/单词来源选择界面
│   ├── GameModal.tsx                # **新建** — 过关/失败结算弹窗
│   ├── SlotBar.tsx                  # **新建** — 底部槽位栏（7 格）
│   ├── levelGenerator.ts            # **新建** — 关卡生成算法（DAG 模型）
│   ├── wordEmoji.ts                 # **新建** — 单词 → emoji 映射
│   └── wordHue.ts                   # **新建** — 单词 → 颜色映射
│
├── views/
│   ├── GameView.tsx                 # **新建** — 游戏主页面
│   ├── HomeView.tsx                 # 新增游戏入口卡片
│   └── WordsView.tsx                # 今日单词/待复习 Tab 新增游戏按钮
│
├── components/
│   ├── ContentPanel.tsx             # 新增懒加载 GameView
│   ├── PlaybackDetailTabs.tsx       # 单词 Tab 新增游戏闯关按钮
│   └── Sidebar.tsx                  # 侧栏新增 game 导航项
│
└── lib/api.ts                       # getWordSentences 新增 prioritize 参数

backend/app/routers/
└── words.py                         # get_word_sentences 新增 prioritize 参数
```

---

## 二、功能交付

### 游戏引擎

| 组件 | 状态 | 说明 |
|------|------|------|
| 棋盘 + 多层级 tile 堆叠 | ✅ | 每层独立 grid，层间按偏移量堆叠 |
| 可点击判定（入度 = 0） | ✅ | DAG 依赖模型，上层移除→下层解锁 |
| 点击 → 移入槽位栏 | ✅ | 槽位自动按单词排序 |
| 三消匹配 | ✅ | 槽位中 3 个相同词自动消除 |
| 过关/失败判定 | ✅ | 全部消除→过关；7 格满且无匹配→失败 |

### 关卡生成

| 组件 | 状态 | 说明 |
|------|------|------|
| DAG 布局算法 | ✅ | 8×6 网格、按覆盖率分配每层 tile |
| 三层难度（简单/中等/困难） | ✅ | 2/3/4 层，10/15/20 词 |
| 可解性验证器（贪心模拟） | ✅ | 30 次重试，不可解则返回 null |
| 单词 → emoji 映射 | ✅ | 唯一 emoji，不含重复 |

### 道具系统

| 道具 | 数量/局 | 状态 |
|------|---------|------|
| 🔀 洗牌 | 1 次 | ✅ 随机重排棋盘所有 tile 位置 |
| ↩ 撤回 | 2 次 | ✅ 从槽位移回最后点击的 tile |
| 🗑️ 移出 3 | 1 次 | ✅ 从槽位移除 3 个 tile |

### 单词音频播放（v0.3.0 改进）

| 功能 | 状态 | 说明 |
|------|------|------|
| `useWordAudio` 通用 hook | ✅ | 查找单词原文位置 + viewClip + play |
| 游戏点击触发播放 | ✅ | 点击格子 → 自动播音频 |
| 同词连点不中断 | ✅ | 改用 safePlay，不 toggle |
| 音频来源优先级 | ✅ | 划线片段合集 > 最近播放合集 > 默认 |
| 播放范围可配置 | ✅ | 遵循全局 `wordPlayOffset`（±k 秒） |

### 多入口接入

| 入口 | 状态 |
|------|------|
| HomeView 游戏卡片 | ✅ |
| WordsView 今日单词 Tab「游戏」按钮 | ✅ |
| WordsView 待复习 Tab「游戏模式」按钮 | ✅ |
| PlaybackDetailTabs 单词 Tab「游戏闯关」 | ✅ |

### UI 体验改进（v0.3.0 改进）

| 改进 | 状态 |
|------|------|
| 游戏格子放大（64px → 84px） | ✅ |
| 单词字号增大（10 → 13，emoji 18 → 24） | ✅ |
| 游戏选择页 title 放大（3xl → 4xl） | ✅ |
| 游戏入口 icon 横排（inline-flex items-center） | ✅ |
| 单词来源 tab 文字水平居中（justify-center） | ✅ |
| 棋盘动态高度计算（替代固定 minHeight） | ✅ |
| 槽位尺寸同步放大（56px → 72px） | ✅ |

---

## 三、架构变更

### 游戏状态机

Zustand store `gameStore.ts` 管理完整游戏状态：

```
状态: idle → playing → won | lost

核心数据：
  tiles: TileData[]          → 棋盘所有 tile
  inDegree: Record<string,n> → 每个 tile 的入度
  slot: (TileData|null)[]    → 7 格槽位
  matchedWords: string[]     → 已消除的单词列表

关键操作：
  initGame(words, diff)  → 生成关卡
  clickTile(tileId)      → 移除 tile，更新入度，检查匹配
  useShuffle / useUndo / useRemove3  → 道具
```

### 图层生成（levelGenerator.ts）

DAG（有向无环图）模型：

```
难度参数：深度（层数）× 宽度（覆盖率）× 密度（分支因子）
布局：8×6 网格，层间半格偏移
可解性：贪心模拟器（匹配 3 → 补齐 → 最优选择）
```

### 单词音频（useWordAudio）

```
playWordAudio(word, opts?)
  ↓
getWordSentences(word, 'favorites,recent_plays')
  ↓
getLessonById(sent.lesson_id) → 查找单词精确时间戳
  ↓
viewClip({ startTime: wordStart ± pad, endTime: wordEnd ± pad })
  ↓
safePlay(a) ← 只在音频暂停时播放（不 toggle）
```

---

## 四、后端变更

| 端点 | 变更 | 说明 |
|------|------|------|
| `GET /api/words/{word}/sentences` | 新增 `prioritize` 参数 | 逗号分隔合集名，划线/最近播放优先 |
| 单词时间戳匹配 | 修复 | 使用 `clean_word` 一致清洗逻辑 |

---

## 五、Bug 修复清单

| Bug | 诊断 | 修复 |
|-----|------|------|
| 游戏格子太小伤眼 | 64px + 10px 字太小 | CELL 64 → 84，字号 10 → 13 |
| 游戏入口 icon 上下堆叠 | button 无 flex 布局 | 加 `inline-flex items-center` |
| 棋盘垂直居中偏下 | 固定 minHeight 不匹配内容高度 | 动态计算 boardHeight |
| 音频播放同词连点中断 | `togglePlay` 切换暂停 | 改用 `safePlay`（只播不切） |
| 单词音频来源随机 | 无优先级逻辑 | 新增 `prioritize` 参数 |
| 单词时间戳部分不匹配 | `w.text` 与参数字面量直接比较 | 统一过 `clean_word` 清洗 |

---

## 六、未完成（后续版本）

- **消除动画** — 当前 tile 点击直接消失，无过渡效果
- **动态难度适应** — 连续失败降档/连续过关升档
- **可点击 tile 高亮提示** — "只剩一个就匹配了"等上下文提示
- **游戏时长统计** — 记录每局时长、消除数等指标
- **tile 点击显示释义** — tooltip 或翻转卡片效果

---

## 七、文件变更统计

| 指标 | v0.2.9 → v0.3.0 (首次实现) | v0.3.0 (改进轮) | 合计 |
|------|------|------|------|
| Commits | 1 | 2 | **2** |
| 文件变更 | 19 | 213 | **213** |
| 代码行（+ / -） | +1,656 / -18 | +1,851 / -1,048,870 | **+3,507 / -1,048,888** |
| 新建前端组件 | 9 | 1 | **10** |
| 新建后端文件 | 0 | 0 | **0** |
| TypeScript 错误 | 0 | 0 | **0** |

> 注：大量删除行为数据文件迁移（`backend/app/data/lessons/` → `data/lessons/`），实际代码净增约 +1,851 行。

### 按目录

| 目录 | 变更 |
|------|------|
| `frontend/src/components/game/` | 新建 8 文件 |
| `frontend/src/stores/` | 新建 gameStore.ts |
| `frontend/src/hooks/` | 新建 useWordAudio.ts |
| `frontend/src/views/` | 新建 GameView.tsx，修改 HomeView/WordsView |
| `backend/app/routers/` | 修改 words.py |
| `plan/v0.3.0/` | 新建 product-plan.md |
