# v0.2.8 Product Plan — 单词词典表 + 考试标签

> **核心理念：** 给每个单词打上所属的考试标签（CET-4/6、TEM-4/8、IELTS、TOEFL），并从开源词库导入发音、词性、中文释义，让单词页面从"仅有频率数字"升级为"带有完整词典信息 + 标签分类"。

---

## 一、总览

| 维度 | 占比 | 内容 |
|------|------|------|
| 功能 | 60% | dictionary 词典表、词库导入脚本、考试标签 API、前端标签/词典展示 |
| 体验 | 25% | 单词列表显示彩色 tag 徽章、详情面板显示发音词性释义、按标签筛选 |
| 技术 | 15% | 词库解析器（兼容多格式）、批量标签聚合、缓存刷新 |

---

## 二、数据来源 P0 ⭐

从 GitHub 下载 6 个开源词库，解析为统一格式后按 word 合并：

| 来源 | 标签 | 词数 | 格式示例 |
|------|------|------|---------|
| mahavivo/english-wordlists: CET4_edited.txt | `CET-4` | ~4600 | `abandon [əˈbændən] vt.丢弃；放弃，抛弃` |
| mahavivo/english-wordlists: CET6_edited.txt | `CET-6` | ~2200 | `accommodation [əˌkɒməˈdeɪʃən] n. 住宿等条件，设施` |
| mahavivo/english-wordlists: 英语专业星标八级词汇.txt | `TEM-8` | ~4000 | `aboveboard [əˌbʌvˈbɔːd] adj. 光明磊落的` |
| mahavivo/english-wordlists: 英语专业四八级词汇表.txt | `TEM-4` | ~12800 总长 | TEM-4+8 合集，减去 TEM-8 后为 TEM-4 |
| mahavivo/english-wordlists: TOEFL.txt | `TOEFL` | ~4500 | 3列制表符分隔：`abandon [ə'bændən] vt.放弃` |
| fanhongtao/IELTS: IELTS Word List.txt | `IELTS` | ~3700 | `emperor /ˈempərə(r)/ n. 皇帝；君主` |

**合并规则：**
- 同一个单词跨多个表出现 → tags 聚合（JSON 数组）
- 释义/音标/词性取第一个非空值（CET4/6 优先）
- 例如 `abandon` 出现在 CET-4、CET-6、IELTS 中 → `tags: ["CET-4", "CET-6", "IELTS"]`

---

## 三、词典表设计

```sql
CREATE TABLE IF NOT EXISTS dictionary (
    word TEXT PRIMARY KEY,
    pronunciation TEXT DEFAULT '',
    part_of_speech TEXT DEFAULT '',
    definition TEXT DEFAULT '',
    tags TEXT DEFAULT '[]'  -- JSON array: ["CET-4", "CET-6", ...]
);
```

`tags` 用 JSON 数组存、一个字段搞定，不要分表。

---

## 四、模块详情

### 4.1 导入脚本 `backend/app/import_word_tags.py`

```python
def download_text(url) -> str         # urllib 下载，自动检测编码
def parse_xxx(text) -> set[str]       # 每个词表专用解析器
def extract_word_info(line) -> dict   # 提取 word/pronunciation/pos/definition
def main():
    1. 下载 6 个词表
    2. 解析，按 word 聚合（defaultdict）
    3. INSERT OR REPLACE 写入 dictionary 表
```

**解析器要点：**
- 忽略中文抬头行、空行、页码行
- 正则提取行首字母单词：`^([A-Za-z]+(?:[ -][A-Za-z]+)*)`
- 提取发音：`\[[^\]]+\]` 或 `/[^/]+/`
- 提取词性：`^[a-z]+\.` 即 `n.` `vt.` `adj.` `adv.` 等
- 提取中文释义：词性后面的全部中文文本
- 部分词条无法解析发音/词性时，至少保证 word + tag 入库

运行方式：
```bash
cd backend && python3 -m app.import_word_tags
```

### 4.2 API 端点

**新增 `GET /api/dictionary/{word}`**

返回单词的词典信息：
```json
{
  "word": "abandon",
  "pronunciation": "əˈbændən",
  "partOfSpeech": "vt.",
  "definition": "丢弃；放弃，抛弃",
  "tags": ["CET-4", "CET-6"]
}
```

**修改 `GET /api/words` 返回 tags**

在返回的每个 `WordSummary` 中增加 `tags` 字段（从 dictionary 表批量查询）：

```python
# words.py - get_words() 返回值
{
  "total": 1024,
  "words": [
    {"word": "abandon", "count": 5, "tags": ["CET-4", "CET-6"]},
    ...
  ]
}
```

**修改 `GET /api/words/{word}` 返回 tags**

在 `WordDetail` 中增加 `tags` 字段。

### 4.3 前端展示

**a) TagBadge 组件**

彩色徽章，每种考试一种颜色：

| 标签 | 颜色 |
|------|------|
| CET-4 | 🟦 blue |
| CET-6 | 🟩 emerald |
| TEM-4 | 🟪 purple |
| TEM-8 | 🟥 red |
| IELTS | 🟧 orange |
| TOEFL | 🩷 pink |

**b) 单词列表行**

在每行单词名称右侧显示 tags 气泡：
```
abandon [CET-4] [CET-6] [IELTS]    5次  ☆
```

**c) 单词详情面板**

在面板顶部、单词名下方显示：
```
abandon  [CET-4] [CET-6]
/əˈbændən/  vt. 丢弃；放弃，抛弃
出现 5 次 · 覆盖 3 课时

[AI 分析] [标记掌握] [✕]
```

**d) 筛选抽屉新增「按考试」分组**

在 FilterDrawer 中新增一组：
```
📚 按考试
├ 全部           1024
├ CET-4          486
├ CET-6          312
├ TEM-4          128
├ TEM-8          96
├ IELTS          245
├ TOEFL          180
```

后端 `GET /api/words` 新增 `exam` 查询参数：
```
GET /api/words?exam=CET-4
GET /api/words?exam=IELTS&exam=TOEFL  (OR)
```

---

## 五、涉及文件

| 文件 | 改动 |
|------|------|
| `backend/app/database.py` | + dictionary 表定义 |
| `backend/app/import_word_tags.py` | **新建** — 词库导入脚本 |
| `backend/app/routers/words.py` | + GET /api/dictionary/{word} |
| | get_words() 返回值增加 tags 字段 + exam 查询参数 |
| | get_word_detail() 返回值增加 tags 字段 |
| `frontend/src/lib/api.ts` | + WordDictionary 类型、+ getDictionaryEntry() |
| | WordSummary/WordDetail 增加 tags? 字段 |
| `frontend/src/views/WordsView.tsx` | + TagBadge 组件、+ 标签展示 |
| | + 详情面板词典信息（发音/词性/释义） |
| `frontend/src/components/words/FilterDrawer.tsx` | + 「按考试」筛选分组（如已拆分则改此文件；如尚未拆分则直接在 WordsView 内内联） |

---

## 六、验证

- [ ] 运行 `python3 -m app.import_word_tags` → 输出各 tag 词数统计
- [ ] `GET /api/dictionary/abandon` → 返回 pronunciation/partOfSpeech/definition/tags
- [ ] `GET /api/words?limit=5` → 每条带 tags 字段
- [ ] `GET /api/words?exam=CET-4` → 只返回有 CET-4 标签的单词
- [ ] 单词列表行显示彩色 tag 徽章（每个 tag 一种颜色）
- [ ] 点击单词 → 详情面板显示发音、词性、中文释义
- [ ] 筛选下拉可看到「按考试」分组并筛选
- [ ] `npx tsc --noEmit` 无类型错误
