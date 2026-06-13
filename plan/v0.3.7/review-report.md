# v0.3.7 评审报告 — 沉浸感动效 + Bug 修复

**日期**: 2026-06-13
**状态**: 已完成 ✅

---

## 1. 版本概述

v0.3.7 双线并行：**产品功能**（德州听词沉浸感动效）+ **Bug 修复**（听了个听 & 德州听词全量 Bug）。重点修复 Safari 点击播词手势链断裂、静默失败、移动端布局缺口。

**总资产变动**：38 个文件修改，约 +981 / -1196 行

**产品计划**：[product-plan.md](product-plan.md) · **Bug 计划**：[bug-plan.md](bug-plan.md)

---

## 2. Bug 修复（P0）

### 2.1 B-P1 · Safari 点击播词手势链断裂

**现象**：Safari / iOS 下用户点击单词 tile 或公共词卡牌后，经常听不到对应词汇发音。Chrome 正常。

**根因**：Safari / iOS 要求 `AudioContext` 在用户手势内解锁。首次点击新课程的词时，播放链路包含网络请求 + 音频解码：

```
用户点击 → primeWordAudioContext() ← 同步，在手势内 ✓
        → await getWordSentences()  ← 网络请求，手势链开始断裂
        → await fetch 整课音频
        → await decodeAudioData()
        → source.start()            ← 已脱离用户手势 ✗
```

`source.start()` 执行时手势窗口已关闭，导致静默失败（错误被 catch 吞掉，用户无感知）。

**修复措施**：

| 改动 | 文件 | 说明 |
|------|------|------|
| 共享 AudioContext | `hooks/usePokerWordAudio.ts` | 导出 `getSharedAudioContext()`、`speakWord()`、`preloadWordsAudio()` |
| 双轨即时反馈 | `hooks/usePokerWordAudio.ts` | `playWordAudioCore()` 先 `speakWord(word)` TTS 即时发音，原课音频加载成功后自动切换 |
| 共用 context | `hooks/useSoundEffect.ts` | 改用 `getSharedAudioContext()`，避免 iOS 只解锁其中一个 context |
| 失败可见 | `hooks/useWordAudio.ts` | catch 中调用 `speakWord(word)` + toast 提示，不再静默 |
| 点击时序优化 | `GameView.tsx`、`poker-table-view.tsx` | onClick 第一行同步调用 `primeWordAudioContext()`，再 setState/音效 |
| 开局预加载 | `GameView.tsx`、`pokerStore.ts` | 开局成功后对本局 words 涉及音频批量 `preloadWordsAudio()` |

**验收**：Safari / iOS 第一次点击从未播放过的词，至少听到 TTS 发音；同一词第二次点击原课音频正常（缓存命中）。

---

### 2.2 B-P1b · Safari 长音频 MIME 类型错误（本次新增）

**现象**：Safari 上，短音频（伊索寓言 `.mp3`，1-2 分钟）能播放，但长音频（IELTS `.m4a`，25-40 分钟）无法播放。

**根因**：后端音频接口将所有音频文件硬编码为 `audio/mpeg`（`.mp3`）。IELTS 课程音频是 `.m4a` 格式（AAC/MP4），Safari 对 MIME 类型校验比 Chrome 严格——短文件在 MIME 校验完成前已下载完，长文件需要 Range 请求渐进式流式加载，错误的 MIME 类型导致解码器初始化失败。

**修复**：

```python
# backend/app/routers/__init__.py
_MIME_MAP: dict[str, str] = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".mp4": "audio/mp4",
    ".webm": "audio/webm",
}

@router.get("/{lesson_id}/audio")
def get_lesson_audio(lesson_id: str):
    audio_path = get_audio_path(lesson_id)
    suffix = audio_path.suffix.lower()
    media_type = _MIME_MAP.get(suffix, "application/octet-stream")
    return FileResponse(
        path=str(audio_path),
        media_type=media_type,
        filename=f"{lesson_id}{suffix}",
    )
```

**验证结果**：
```
IELTS (.m4a) → content-type: audio/mp4   ← 之前 audio/mpeg
              filename: ielts-c11-t1.m4a  ← 之前 ielts-c11-t1.mp3
Aesop (.mp3) → content-type: audio/mpeg   ← 不变
```

---

### 2.3 B-P2 · API 错误被静默吞掉（P0）

**现象**：德州听词开局/下注/Lobby 加载失败无 UI 反馈。

**修复**：`pokerStore.ts` 新增 `error: string | null` + `clearError()`；`poker-table-view.tsx` 顶部展示 dismissible error banner。

### 2.4 B-S1 · 移动端无 game Tab 入口（P0）

**现象**：`MobileTabBar` 有 `words`/`poker`，无 `game`，手机无法一键进入听了个听。

**修复**：`MobileTabBar.tsx` 新增 `{ key: 'game', label: '消除', icon: HiPuzzlePiece }`，放在 `words` 与 `poker` 之间。

### 2.5 B-S2 · 棋盘在小屏横向溢出（P0）

**现象**：棋盘固定 `CELL=84` × 8 列 ≈ 672px，小屏需横向滚动。

**修复**：`GameBoard.tsx` + `GameTile.tsx` 改用 `ResizeObserver` 按容器宽度动态计算 `cellSize`（下限 48px，上限 84px），通过 prop 共享。

### 2.6 B-S2b · SlotBar 工具栏移动端溢出（本次新增）

**现象**：听了个听下方工具栏（7 个 slot + 3 个 tool 按钮）固定为 72px 宽，在移动端横向溢出。

**修复**：`SlotBar.tsx` 改用 `ResizeObserver` 动态计算按钮尺寸：

| 指标 | 之前 | 之后 |
|------|------|------|
| 尺寸 | 固定 72px | 动态 30px ~ 72px |
| 窄屏文字 | 始终显示 | < 46px 时隐藏，保留 emoji/图标 |
| 容器内边距 | `p-2` (16px) | `p-1.5` (12px) |
| 溢出兜底 | 无 | `overflow-x-auto` |

**计算逻辑**：容器宽度减去 padding(12px) + gap(36px) + separator(9px) 后，除以 10 个元素，控制在 [30, 72] 区间。

### 2.7 B-S3 · 游戏启动失败无反馈（P0）

**现象**：选「今日单词」/「待复习」后点开始，API 失败或词数不足时界面无变化。

**修复**：`GameView.tsx` 增加 `starting`/`startError` state；API catch 显示「加载失败，请检查网络」；`initGame` 失败提示「单词不足，请选择其他来源或降低难度」。重玩/刷新传入 `gameSource`。

---

## 3. Bug 修复（P1-P2）

### 3.1 B-P3 · AI 思考座位错误（P1）

**现象**：前端用 `total_bet` 最低 AI 推断思考者，经常高亮错误座位。

**修复**：后端 `poker_service.py` `_build_state()` 增加 `acting_player_id` 字段，返回当前轮首个未行动的非弃牌玩家 id；前端按 id 匹配高亮。

### 3.2 B-P4 · 摊牌粒子抖动（P1）

**现象**：`showdown-result.tsx` 内联 `Math.random()`，重渲染时粒子跳动。

**修复**：mount 时用 `useMemo` 固定 40 个粒子 seed。

### 3.3 B-P5 · Lobby 无返回按钮（P1）

**现象**：v0.3.6 移除 Lobby 返回按钮，Mobile 只能靠 TabBar 切走。

**修复**：`poker-lobby.tsx` 恢复左上角返回按钮（`onBack` prop）。

### 3.4 B-P6 · 触屏 hover 残留（P2）

**现象**：`hover:` 类在触屏点击后样式粘滞。

**修复**：`index.css` 新增 `@media (hover: hover)` 限制 `poker-chip-btn:hover`，触屏设备不应用 hover 效果：

```css
@media (hover: hover) {
  .poker-chip-btn:hover {
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.1);
  }
}
```

### 3.5 B-P7 · 历史时间戳错误（P2）

**现象**：`fmtTime(ts * 1000)` 假定秒级时间戳，实际接收毫秒级导致时间偏移。

**修复**：

```typescript
function fmtTime(ts: number) {
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toLocaleString(...);
}
```

### 3.6 B-S4 · matchingWord 死代码（P2）

**现象**：v0.3.1 已原子消除，但 `matchingWord` 字段仍在，道具 guard 冗余。

**修复**：`gameStore.ts` 删除字段及所有引用。

---

## 4. 产品功能（详见 product-plan.md）

以下功能增强与 Bug 修复并行开发：

- 🎬 入场 / 摊牌 / 筹码飞入动效
- 🌊 环境音效层（casino ambience）
- ⚙️ 动画开关 localStorage 持久化
- 📊 游戏统计展示页
- ✈️ 消除飞行动效
- `can_play` 产品规则对齐

---

## 5. 变更文件清单

### 后端

| 文件 | 改动 |
|------|------|
| `backend/app/routers/__init__.py` | 音频 MIME 类型动态识别（修复 Safari 长音频播放） |
| `backend/app/services/poker_service.py` | `_build_state()` 增加 `acting_player_id` 字段 |

### 前端 — Bug 修复

| 文件 | 改动 |
|------|------|
| `hooks/usePokerWordAudio.ts` | 共享 AudioContext、双轨即时反馈（TTS + 原课音频） |
| `hooks/useSoundEffect.ts` | 改用共享 AudioContext |
| `hooks/useWordAudio.ts` | catch 增加 TTS / toast，不再静默 |
| `stores/pokerStore.ts` | 新增 `error` 状态、开局预加载触发 |
| `stores/gameStore.ts` | 删除 `matchingWord` 死代码 |
| `components/game/SlotBar.tsx` | ResizeObserver 动态尺寸，移动端适配 |
| `components/game/GameBoard.tsx` | 动态 cellSize（48~84px ResizeObserver） |
| `components/game/GameTile.tsx` | 接收 cellSize prop |
| `components/game/GameLevelSelect.tsx` | 布局微调 |
| `components/game/GameModal.tsx` | 布局微调 |
| `components/game/TilePopup.tsx` | 布局微调 |
| `components/game/levelGenerator.ts` | 布局微调 |
| `components/MobileTabBar.tsx` | 新增 game Tab「消除」入口 |
| `views/GameView.tsx` | Safari 点击时序、启动错误提示、开局预加载 |
| `views/PokerGameView.tsx` | 引用路由调整 |
| `index.css` | hover 媒体查询限制、动效 CSS |

### 前端 — 其他

| 文件 | 改动 |
|------|------|
| `lib/audioEngine.ts` | 预加载 API、AudioBuffer 缓存 |
| `lib/api.ts` | 接口调整 |
| `stores/audioStore.ts` | clip 播放逻辑优化 |
| `PlayerBar.tsx` / `Waveform.tsx` | 布局微调 |
| `views/WordsView.tsx` / `FavoritesView.tsx` | 引用调整 |
| `components/cards/CardDetailModal.tsx` | UI 调优 |
| `components/cards/CardUnlockModal.tsx` | UI 调优 |
| `components/words/FilterDrawer.tsx` | UI 调优 |
| `components/words/ReviewFillIn.tsx` | UI 调优 |
| `components/words/ReviewFlashcard.tsx` | UI 调优 |
| `components/words/WordDetailPanel.tsx` | UI 调优 |
| `src-tauri/tauri.conf.json` | 配置更新 |
| `cards/CardsView.tsx` / `DeckDetailView.tsx` | 引用调整 |
| `plan/VERSIONS.md` | 版本状态更新 |

---

## 6. 验收标准

| # | 标准 | 状态 |
|---|------|------|
| 1 | Safari / iOS：第一次点击新词可听到发音（原课或 TTS） | ✅ |
| 2 | Safari：长音频（IELTS .m4a）正确设置 `audio/mp4` MIME 类型 | ✅ |
| 3 | Chrome：长/短音频行为不退化 | ✅ |
| 4 | 听了个听：小屏无横向溢出，SlotBar 自适应尺寸 | ✅ |
| 5 | 听了个听：MobileTabBar 可直达 game 页 | ✅ |
| 6 | 两个游戏：API / 词数 / 余额失败均有中文提示 | ✅ |
| 7 | AI 思考高亮正确座位 | ✅ |
| 8 | 摊牌粒子稳定；Lobby 可返回；历史时间正确 | ✅ |
| 9 | TypeScript `tsc --noEmit` / Vite build 零错误 | ✅ |
