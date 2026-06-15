# v0.3.2 Product Plan — 卡组系统

> **核心理念：** 在英语听力学习中引入集卡式卡组系统，将学习进度与卡牌收藏绑定，让用户通过背单词、完成复习等学习行为收集传奇人物卡牌，提升学习动力和成就感。

---

## 一、总览

| 维度 | 占比 | 内容 |
|------|------|------|
| 数据 | 10% | fashion.json 新增 `png` 字段；图片静态资源服务 |
| 后端 | 25% | 卡组数据 API、卡牌收藏 / 进度 API、图片服务 |
| 前端 | 55% | 卡组首页、卡牌详情、收藏进度、获取动画 |
| 集成 | 10% | 学习行为 ↔ 卡牌获取的联动逻辑 |

---

## 二、功能详情

### 2.1 卡组数据模型（P0）

**后端新表 `card_collection`**：记录每个卡牌的收藏状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增 |
| `card_id` | TEXT | 卡牌唯一标识（如 `chanel`） |
| `season` | INTEGER | 所属系列（当前为 1，标记这是主题下的第几弹卡牌） |
| `obtained` | BOOLEAN | 是否已解锁 |
| `obtained_at` | DATETIME | 解锁时间（可为 NULL） |
| `obtained_by` | TEXT | 解锁途径（vocab_match_draw 等） |

**后端新表 `card_vocab_signatures`**：每张卡牌的词汇覆盖签名——从 title + motto + lore.english 中提取的关键词汇集。

| 字段 | 类型 | 说明 |
|------|------|------|
| `card_id` | TEXT PK | 卡牌唯一标识 |
| `vocab_list` | JSON | 关键词数组，如 `["fashion", "elegance", "luxury", "freedom", ...]` |
| `source` | TEXT | 提取来源字段标识（title/motto/lore）加总

**卡组元数据**：沿用 `data/cards/fashion.json`，新增 `png` 字段指向图片文件名（不含后缀）。

**卡牌结构更新：**
```json
{
  "id": "chanel",
  "name": "Coco Chanel",
  "title": "The Woman Who Stole Men's Clothes",
  "rarity": "R",
  "png": "coco_chanel",
  "keywords": ["fashion", "elegance", ...],
  "motto": "Fashion fades. Freedom remains.",
  "lore": {
    "english": "...",
    "chinese": "..."
  }
}
```

> **已就绪：** `fashion.json` 中所有 9 张卡牌已在 v0.3.2 数据准备阶段完成 `png` 字段补充，对应图片已存在于 `data/cards/image/`。

### 2.2 后端 API（P0）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/cards/list` | GET | 获取卡组数据（所有卡牌列表及元信息） |
| `/api/cards/collection` | GET | 获取当前用户所有卡牌的收藏状态 |
| `/api/cards/collection/{card_id}` | POST | 解锁/更新某张卡牌的收藏状态 |

**图片资源：** 后端 mount `data/cards/image/` 为静态目录，url 模式 `/api/cards/image/{filename}.png`，前端通过该 URL 加载卡牌图片。

### 2.3 前端 — 卡组首页（P0）

新建 `CardsView` 组件，入口为 `NavSection.cards`。

| 模块 | 内容 |
|------|------|
| **卡组卡片** | 展示卡组封面信息（theme title），显示当前收集进度（如 3/9） |
| **卡牌网格** | 显示卡组下所有卡牌。已解锁：显示卡牌图片 + 名称 + 稀有度标识；未解锁：显示剪影/问号 + "???" |
| **稀有度标签** | 用颜色区分 R（蓝）/ SR（紫）/ SSR（橙）/ UR（金），尺寸小巧 |
| **进度条** | 顶部显示本卡组总收集进度 N/M |

### 2.4 前端 — 卡牌详情（P1）

点击已解锁卡牌打开 `CardDetailModal` 或独立详情页：

| 模块 | 内容 |
|------|------|
| **大图展示** | 卡牌大尺寸 PNG + 名称 + 稀有度徽章 |
| **motto** | 卡牌名人名言（英文 + 中文），优雅排版 |
| **lore 故事** | 双栏或分段展示英文原版 + 中文对照 |
| **关键词标签** | keywords 以 badge 形式展示 |
| **解锁信息** | 显示解锁时间、解锁途径 |
| **音频入口** | 可选——点击名言/故事可播放 TTS 或预录音频 |

### 2.5 学习行为 ↔ 卡牌解锁联动（P1）

核心设计：不再是「攒够 N 词领卡」，而是基于**词汇覆盖度的抽卡机制**。每张卡牌从 title + motto + lore.english 中提取独有的词汇签名，用户每复习一个单词就增加与某些卡牌的匹配度。当用户主动「抽卡」时，系统计算所有未解锁卡牌的词汇覆盖度，选出最匹配的 3 张供用户三选一抽取。

#### 2.5.1 卡牌词汇签名

每张卡牌的词汇签名预计算：

```
Coco Chanel
  标题: "The Woman Who Stole Men's Clothes"
  签名词: woman, stole, men, clothes
  motto: "Fashion fades. Freedom remains."
  签名词: fashion, fades, freedom, remains
  lore: "History is full of people who followed the rules..."
  签名词提取: history, people, followed, rules, legendary, ignored, women, trapped, corsets, jackets, freedom, wealthy, jewelry, decoration, mirror, simplicity, luxurious, obsession, number, perfume, created

  → 去重后签名集: 约 20-30 个核心词汇
```

**签名词提取规则（后端导入时预计算，规则见 `config.yaml`）：**
1. 去停用词（`config.cards.signature.stop_words`）
2. 保留实义词（名词、动词、形容词、副词）
3. 同一词根合并（`config.cards.signature.stem_merge`）
4. 小写归一化
5. 存储为 JSON 数组到 `card_vocab_signatures` 表

#### 2.5.2 匹配度计算

对于每张未解锁卡牌，匹配度 = 用户已复习过的词中命中该卡签名词的比例：

```
匹配度 = |用户已复习词集 ∩ 卡牌签名词集| ÷ |卡牌签名词集|

例：
  卡牌签名词集: ["fashion", "freedom", "elegance", "luxury", "style"]  (5 词)
  用户已复习:    ["fashion", "freedom", "elegance", "corset", "jacket"]  (已匹配 3 词)
  → 匹配度 = 3/5 = 60%
```

**匹配度精准度考量：**
- 精确匹配（`fashion` = `fashion`）即可，不做词形还原
- 目的不是 NLP 完美度，而是给用户「我复习的词原来和这张卡有关」的惊喜感

#### 2.5.3 抽卡流程

整个流程由**用户主动触发**（在卡组首页点击「抽卡」按钮），而非自动解锁：

```
1. 用户点击「抽卡」
2. 后端遍历所有未解锁卡牌：
   a. 从 review_history 查出用户累计复习过的词汇（去重）
   b. 对每张未解锁卡，计算其签名词命中数 → 匹配度
   c. 按匹配度从高到低排序，取 Top 3
3. 后端返回这 3 张卡的信息（含匹配度百分比 + 签名词命中/总数）
4. 前端展示「三选一抽卡」界面：
   - 三张卡牌背面朝上（或显示剪影 + 匹配度）
   - 有简短描述 hint（如"这张卡和你复习的 5 个词有关"）
   - 用户点击一张 → 翻开动画 → 卡牌解锁
5. 如果 Top 3 的匹配度全部为 0%（用户没复习任何相关词）：
   - 提示「再复习一些单词再来吧」并展示建议复习的单词
```

**频率限制：**
| 维度 | 规则 |
|------|------|
| 同卡 | 不可重复抽取（抽到即锁定） |
| 抽卡条件 | 同时满足三个条件才可抽卡（阈值见 `config.yaml`）：<br>1. 上次抽卡后新复习的单词数 > `config.cards.draw.min_new_words`（去重计数）<br>2. 词汇覆盖度 > `config.cards.draw.coverage_threshold`（对未解锁卡牌而言，用户复习词命中该卡签名词的比例）<br>3. 满足条件 2 的卡牌 ≥ `config.cards.draw.min_qualified_cards`，确保用户有选择空间 |
| 重置机制 | 每次成功抽卡后，累计复习计数归零、重新积累 |
| Diff 展示 | 卡组首页显示「已复习 X 词 · 可覆盖 N 张卡 → 可抽卡」或「已复习 X 词 · 覆盖 M 张卡 · 差 K 张解锁抽卡」，让用户感知差距 |

#### 2.5.4 前端抽卡界面

| 状态 | 界面 |
|------|------|
| **可抽卡** | 卡组首页底部醒目的「抽卡」按钮 |
| **冷却中** | 按钮灰化，显示「下次抽卡 HH:MM」（如"下次抽卡 14:30"），无秒级倒计时 |
| **匹配计算中** | 三张卡牌背面，上方显示匹配度 loading |
| **三选一** | 三张卡背面（轻微浮动动画），点击后翻开 |
| **翻开动画** | 卡牌从背面旋转 180°→ 正面，稀有度特效喷出 |
| **已全部收集** | 按钮灰化，显示「全卡已收集 ✨」 |
| **无匹配** | 展示用户复习词与各卡签名词的词云对比，引导复习 |

### 2.6 开启动画（P2）

当卡牌解锁时，展示一个简短的庆祝动画：

| 效果 | 说明 |
|------|------|
| 全屏弹窗 | 半透明遮罩 + 卡牌从中心放大出现 |
| 稀有度特效 | R → 蓝光，SR → 紫光，SSR → 橙光，UR → 金光粒子 |
| 卡牌翻转 | 从问号剪影翻转为卡牌正面，显示名称 + 稀有度 |
| "New!" 标识 | 新获得卡牌在卡组首页显示 "New!" 角标 |

---

## 三、涉及文件

### 新增文件

| 文件 | 说明 |
|------|------|
| `backend/app/config.yaml` | 卡牌系统配置（抽卡阈值、停用词列表、数据路径） |
| `backend/app/routers/cards.py` | 卡组 API（卡牌数据、收藏状态、图片服务） |
| `frontend/src/views/CardsView.tsx` | 卡组首页（卡牌列表、进度） |
| `frontend/src/components/cards/CardDetailModal.tsx` | 卡牌详情弹窗（大图、motto、lore、标签） |
| `frontend/src/components/cards/CardGrid.tsx` | 卡牌网格组件（展示已解锁/未解锁状态） |
| `frontend/src/components/cards/CardRarityBadge.tsx` | 稀有度颜色标签组件 |
| `frontend/src/components/cards/CardUnlockModal.tsx` | 解锁动画全屏弹窗 |
| `frontend/src/stores/cardsStore.ts` | 卡组状态管理（卡牌数据、收藏进度、解锁事件） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `data/cards/fashion.json` | 已为每个 card 对象追加 `png` 字段 ✅ |
| `backend/app/routers/__init__.py` | 注册 `cards` router |
| `backend/app/database.py` | 新增 `card_collection` 表 |
| `frontend/src/components/ContentPanel.tsx` | 添加 `cards` 视图路由（lazy import CardsView） |
| `frontend/src/components/Sidebar.tsx` | 添加「卡组」导航入口 |
| `frontend/src/types/nav.ts` | 添加 `NavSection.cards` |
| `frontend/src/lib/api.ts` | 添加卡片相关 API 方法 |

---

## 四、优先级矩阵

| 功能 | 优先级 | 复杂度 | 用户感知 |
|------|--------|--------|----------|
| 🎴 卡组 API + 图片服务 | P0 | ⭐⭐ | 🔥🔥🔥 |
| 🎴 卡组首页 + 卡牌网格 | P0 | ⭐⭐⭐ | 🔥🔥🔥🔥🔥 |
| 🎴 卡牌详情弹窗 | P1 | ⭐⭐ | 🔥🔥🔥🔥 |
| 🔗 学习行为 → 卡牌解锁 | P1 | ⭐⭐⭐ | 🔥🔥🔥🔥🔥 |
| 🎆 开启动画 | P2 | ⭐⭐ | 🔥🔥🔥 |
| 🏷️ 图片文件名 typo 修复 | P2 | ⭐ | 🔥 |

---

## 五、版本信息

| 项目 | 内容 |
|------|------|
| 版本号 | v0.3.2 |
| 预计日期 | 2026-06-11 |
| 主题 | 卡组系统 |
| 前置依赖 | v0.3.1 主线合并 |
