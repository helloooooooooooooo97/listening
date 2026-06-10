# v0.3.0 Product Plan — 羊了个羊 × 单词复习

> **核心理念：** 借鉴「羊了个羊」三消玩法，把你的单词复习变成消除游戏。每次消除 3 个相同单词 = 完成一次复习，在游戏中无痛背词。

---

## 一、总览

| 维度 | 占比 | 内容 |
|------|------|------|
| 功能 | 70% | 单词消除棋盘、槽位栏、多层级 tile 堆叠、消除/过关/失败流程 |
| 体验 | 20% | 消除动画、道具（洗牌/撤回/移出）、计分、难度曲线 |
| 技术 | 10% | 游戏状态机、tile 布局算法、关卡生成器 |

---

## 二、游戏机制

### 2.1 核心规则

```
棋盘上有若干单词 tile，层叠排列
  ↓
点击 tile → 移入底部槽位栏（最多 7 格）
  ↓
槽位中 3 个相同单词 → 自动消除 = 该词复习成功（记 100 分）
  ↓
所有 tile 消除 → 过关 🎉
槽位满 7 格且无匹配 → 失败 😢
```

### 2.2 单词来源

| 来源 | 说明 | 难度 |
|------|------|------|
| 今日单词 | 今天听过的所有单词 | 低（N 通常 < 50） |
| 待复习单词 | dueWords 中待复习的词 | 中 |
| 本课单词 | 当前播放课程的单词 | 低 |
| 全部单词（随机） | 按考试标签/难度分层抽样 | 中-高 |

**tile 分配规则：**
- 每局使用 N 个单词（N = 12-24，取决于难度）
- 每个单词在棋盘上出现 3 次（正好一次消除）
- 棋盘总 tile 数 = N × 3

### 2.3 棋盘布局

```
┌──────────────────────────────────┐
│         🐑 单词消除               │
│  ┌───────第 1 层───────┐         │
│  │  [abandon] [ability] │         │
│  │  [absolutely] [abandon]        │
│  └──────────────────────┘         │
│     ┌──第 2 层──┐                 │
│     │ [ability] │                 │
│     │ [abandon] │                 │
│     └──────────┘                  │
│        ┌─第 3 层─┐               │
│        │  [ability]               │
│        └─────────┘                │
│                                    │
│  ┌──────────────────────────┐     │
│  │  [ ] [ ] [ ] [ ] [ ] [ ] [ ]  │  ← 槽位栏（7 格）
│  └──────────────────────────┘     │
│                                    │
│  [🔀 洗牌] [↩ 撤回] [🗑️ 移出 3]   │  ← 道具
└──────────────────────────────────┘
```

### 2.4 DAG 依赖模型（核心难度机制）

羊了个羊本质是一个 **DAG 消除游戏**：

```
每个 tile 是一个节点
上层 tile 压着下层 tile = 有向边（上层 → 下层）

可点击条件：入度 = 0（没有 tile 压在它上面）
消除一个 tile → 它指向的下层 tile 入度 -1
消除顺序 = DAG 的拓扑排序
```

**难度由 DAG 的三维参数决定：**

| 参数 | 含义 | 对难度的影响 |
|------|------|-------------|
| **深度** | 依赖链最大长度（几层叠压） | 越深→中间态越多→策略复杂度↑ |
| **宽度** | 每层 tile 数 | 越宽→选项越多→选择难度↑ |
| **依赖密度** | 每个 tile 平均压几个下层 | 密度越高→消除一个释放的 tile 越多→变数↑ |

### 2.5 难度参数矩阵

| 参数 | 🟢 简单 | 🟡 中等 | 🔴 困难 |
|------|---------|---------|---------|
| 单词数 N | 10 | 15 | 20 |
| 总 tile 数 (N×3) | 30 | 45 | 60 |
| 层数 | 2 | 3 | 4 |
| 每层覆盖率 | 100% → 60% | 100% → 50% → 30% | 100% → 70% → 40% → 20% |
| 依赖链最大长度 | 1（仅被 1 层压） | 2 | 3 |
| 分支因子（每 tile 压几个） | ≤1 | ≤2 | ≤3 |
| 槽位宽松度 | ≥6 同词必触发匹配 | ≥4 同词必触发匹配 | ≥3 同词必触发匹配 |

### 2.6 可解性验证器

随机摆放 **不保证可解**——必须验证。关卡生成流程：

```
生成初始布局
  ↓
贪心模拟器验证是否可解
  ├─ 可解 → 关卡可用
  └─ 不可解 → 调整后重试（最多 20 次）
       └─ 仍不可解 → 降低一个难度参数
```

**贪心模拟算法：**

```
输入：tile 布局（含 DAG 依赖关系）
输出：是否可解

slot = []
while 棋盘还有 tile:
    clickable = {t | t.入度 == 0}
    
    // 1. 如果有 3 个相同 → 消除
    for each word w in clickable:
        if count(clickable, w) >= 3:
            消除所有 w → continue
    
    // 2. 有 2 个相同 + 槽位里还有 1 个 → 补齐
    for each word w in slot:
        if count(clickable, w) >= 1:
            移入 → 消除 3 个 → continue
    
    // 3. 按优先级选择
    sort clickable by:
        a. 阻挡的下层 tile 数（降序）→ 优先级高
        b. 槽位中已有相同词（降序）
        c. 随机
    
    移入选中的 tile → slot
    if slot.length >= 7: return ❌ 死局

return ✅ 可解
```

### 2.7 动态难度适应

游戏过程中实时检测并反馈：

```
游戏进行中:
  - 剩余 tile 数 / 槽位剩余空间 ≤ 阈值？
    → 槽位中 2 个相同的词高亮提示"就差一个了！"

  - 可点击 tile 全部不同词？
    → 自动弹提示"试试洗牌道具"

  - 连续失败 2 次？
    → 下一局自动降一档难度

  - 连续过关 3 次？
    → 下一局自动升一档难度（可选）
```

---

## 三、游戏流程

### 3.1 从复习入口进入

```
WordsView 今日单词 Tab
  └─ 新增「🐑 游戏模式」按钮，与「开始复习」并列
待复习 Tab
  └─ 新增「🐑 游戏模式」
PlaybackDetailTabs 单词 Tab
  └─ 新增「🐑 游戏闯关」
HomeView 卡片
  └─ 卡片新增「游戏模式」入口
```

### 3.2 游戏内流程

```
选择单词来源 → 选择难度 → 生成棋盘
  ↓
游戏开始 → 计时开始（可选）
  ↓
点击 tile → 移入槽位
  ↓
3 匹配？→ 消除 + 单词复习成功（submitWordReview 100分）
  ↓
棋盘为空？→ 🎉 过关
槽位满？→ 💔 失败（复习未完成的词照常记录）
```

### 3.3 过关结算

```
┌──────────────────────────────┐
│         🎉 过关！              │
│                              │
│  消除单词: 12/12              │
│  用时: 2:35                  │
│  复习成功: 12 个              │
│                              │
│  🌟 掌握率: 100%              │
│                              │
│  [🔁 再来一局]  [📋 返回复习] │
└──────────────────────────────┘
```

### 3.4 失败结算

```
┌──────────────────────────────┐
│         💔 槽位满了             │
│                              │
│  已消除: 8/12                 │
│  未消除: 4                    │
│  用时: 1:45                   │
│  已复习成功: 8 个              │
│                              │
│  💡 提示: 优先点击被压住的 tile │
│                              │
│  [🔁 再来一局]  [📋 返回复习] │
└──────────────────────────────┘
```

---

## 四、UI 组件

### 4.1 新建组件

| 组件 | 说明 |
|------|------|
| `GameBoard.tsx` | 游戏棋盘容器，管理 tile 渲染和点击事件 |
| `GameTile.tsx` | 单个单词 tile（含层级/遮挡/选中状态） |
| `SlotBar.tsx` | 底部槽位栏（7 格，显示已选单词 + 匹配动画） |
| `GameModal.tsx` | 过关/失败结算弹窗 |
| `GameLevelSelect.tsx` | 难度选择 + 单词来源选择界面 |

### 4.2 组件层级

```
GameView (游戏主页面)
├── GameHeader (关卡信息 + 计时 + 暂停)
├── GameBoard
│   ├── GameTile (× N, 每层一个容器)
│   └── TileLayer (第 1/2/3 层容器)
├── SlotBar
│   ├── SlotItem (× 7)
│   └── MatchAnimation (消除动画)
├── ToolBar (道具按钮)
└── GameModal (结算弹窗)
```

### 4.3 状态管理

```typescript
interface GameState {
  // 棋盘
  tiles: TileData[];           // 所有 tile
  slotItems: TileData[];       // 槽位当前 tile（max 7）
  matchedWords: string[];      // 已消除的单词
  blockedTiles: Set<string>;   // 被遮挡不可点的 tile id

  // 进度
  wordCount: number;           // 本局总单词数
  matchedCount: number;        // 已消除数
  isGameOver: boolean;
  isWin: boolean;

  // 计时
  startTime: number;
  elapsed: number;

  // 道具
  tools: { shuffle: number; undo: number; remove3: number };
}

interface TileData {
  id: string;
  word: string;
  layer: number;        // 0 = 底层, 1 = 中层, 2 = 顶层
  x: number;            // 网格 x
  y: number;            // 网格 y
  isBlocked: boolean;   // 是否被上层遮挡
  isSelected: boolean;  // 是否已被点击（移入槽位）
}
```

### 4.4 道具系统

| 道具 | 数量/局 | 效果 |
|------|---------|------|
| 🔀 洗牌 | 1 次 | 随机重排棋盘上所有 tile 位置 |
| ↩ 撤回 | 2 次 | 从槽位栏移回最后一个点击的 tile 到棋盘 |
| 🗑️ 移出 3 | 1 次 | 从槽位移除 3 个 tile（不影响复习记录） |

---

## 五、与复习系统的结合

### 5.1 消除 = 复习

```
3 个 "abandon" 匹配消除
  ↓
自动调用 submitWordReview("abandon", 100)
  ↓
word_progress 更新：last_score=100, reviewed_count+1
  ↓
review_history 写入（source='sheep_game', mode='game'）
```

- 消除时自动记录复习，用户无感知
- 游戏结束后在结算页展示「已复习 N 个单词」
- 失败时已消除的单词仍然算复习成功

### 5.2 词库联动

- 优先使用用户已有词库数据（dictionary 表）
- tile 上显示单词 + 考试标签小角标（如 CET-4）
- 点击 tile 可短暂显示释义（tooltip 或卡片翻转效果）
- 槽位的 3 个相同词匹配前显示释义预览

---

## 六、涉及文件

### 新建文件

| 文件 | 说明 |
|------|------|
| `frontend/src/views/GameView.tsx` | 游戏主页面 |
| `frontend/src/components/game/GameBoard.tsx` | 棋盘容器 |
| `frontend/src/components/game/GameTile.tsx` | 单词 tile |
| `frontend/src/components/game/SlotBar.tsx` | 槽位栏 |
| `frontend/src/components/game/GameModal.tsx` | 结算弹窗 |
| `frontend/src/components/game/GameLevelSelect.tsx` | 难度选择 |
| `frontend/src/components/game/levelGenerator.ts` | 关卡生成算法 |
| `frontend/src/stores/gameStore.ts` | 游戏状态管理（Zustand） |
| `plan/v0.3.0/product-plan.md` | 本文件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/src/App.tsx` | 新增 `/game` 路由 |
| `frontend/src/views/WordsView.tsx` | 今日单词/待复习 Tab 新增「🐑 游戏模式」按钮 |
| `frontend/src/components/PlaybackDetailTabs.tsx` | 单词 Tab 新增「🐑 游戏闯关」按钮 |
| `frontend/src/views/HomeView.tsx` | 今日单词/待复习卡片新增游戏入口 |
| `frontend/src/lib/api.ts` | 可能新增游戏需要的 API |
| `frontend/src/components/words/ReviewModal.tsx` | 新增 source 类型 'sheep_game' |
| `backend/app/repositories/progress_repo.py` | 可能新增 game 相关的统计查询 |

---

## 七、验证

- [ ] 选择单词来源 + 难度 → 生成棋盘，tile 数量正确
- [ ] 点击可点 tile → 移入槽位，被遮挡 tile 不可点
- [ ] 3 个相同单词在槽位 → 自动消除 + 记录复习
- [ ] 所有 tile 消除 → 过关结算
- [ ] 槽位满 7 格 → 失败结算
- [ ] 道具（洗牌/撤回/移出 3）正常工作
- [ ] 关卡生成器产出可解布局
- [ ] 从 WordsView / PlaybackDetailTabs / HomeView 三处进入游戏均正常
- [ ] review_history 中 source='sheep_game' 记录正确
- [ ] `npx tsc --noEmit` 无错误
- [ ] 再玩一局生成不同的棋盘
- [ ] 游戏不影响正常复习功能
