# v0.2.4 Review Report — 后端代码拆分 + 面向对象

> 模块化拆分、Repository 模式、路由统一注册

---

## 一、目录结构

```
backend/app/
├── main.py                     # 精简 -70 行，仅 25 行
├── database.py                 # 不变
├── models/                     # Pydantic 数据模型（新建）
│   ├── clip.py                 # ClipCreate / ClipUpdate / ClipOut
│   ├── collection.py           # CollectionCreate / CollectionItemOut / ...
│   ├── favorite.py             # FavoriteCreate / FavoriteOut
│   └── translation.py          # TranslationIn / TranslationOut
├── repositories/               # DAO 层（新建）
│   ├── clip_repo.py            # ClipRepository（CRUD + 模型返回）
│   ├── favorite_repo.py        # FavoriteRepository（try/except 细化）
│   ├── progress_repo.py        # ProgressRepository（听写+进度）
│   └── translation_repo.py     # TranslationRepository（hashlib.md5）
├── services/                   # 业务逻辑层（保持不变）
└── routers/                    # HTTP 路由层
    ├── __init__.py             # 集中收集 → 统一注册
    ├── clips.py                # 重构 — Depends 注入 Repo
    ├── favorites.py            # 重构 — Depends 注入 Repo
    ├── translation.py          # 新建 — 从 main.py 移出
    └── ...（words, stats, 等保持不变）
```

---

## 二、Repository 模式

每个 Repository 类封装一个表的全部 SQL 操作：

| Repository | 职责 | 方法 |
|------------|------|------|
| `ClipRepository` | `clips` 表 CRUD | `list_all()`, `get_by_id()`, `create()`, `update()`, `delete()` |
| `FavoriteRepository` | `favorites` 表 CRUD | `list_all()`, `add()`, `remove()`, `remove_by_item()` |
| `TranslationRepository` | `translations` 缓存 | `get()`, `upsert()` |
| `ProgressRepository` | 进度数据 | `add_dictation()`, `add_play_history()`, `upsert_audio_progress()`, `get_known_words()` |

核心模式：
```python
class ClipRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def create(self, data: ClipCreate) -> ClipOut:
        # SQL INSERT ...
        return self.get_by_id(cur.lastrowid)  # 返回 model

    def update(self, clip_id: int, data: ClipUpdate) -> ClipOut | None:
        updates = data.model_dump(exclude_none=True)  # 只更新非 None 字段
        # SQL UPDATE ...
        return self.get_by_id(clip_id)
```

---

## 三、依赖注入

Router 通过 `Depends` 获取 Repository：

```python
# routers/clips.py
def get_repo() -> ClipRepository:
    return ClipRepository(get_conn())

@router.get("/", response_model=list[ClipOut])
def list_clips(repo: ClipRepository = Depends(get_repo)):
    return repo.list_all()
```

---

## 四、路由统一注册

**之前：** main.py 7 行 import + 7 行 include_router

**之后：**

```python
# routers/__init__.py
from .clips import router as clips_router
# ... 集中收集

routers = [lessons_router, clips_router, favorites_router, ...]

# main.py — 3 行
from routers import routers
for r in routers:
    app.include_router(r)
```

---

## 五、其他改进

| 项 | 之前 | 之后 |
|----|------|------|
| 翻译 hash | 自定义位运算 `_hash_text` | `hashlib.md5` |
| favorites 错误处理 | `except Exception` | `except sqlite3.IntegrityError` |
| Pydantic response | 无（返回 `dict`） | `response_model=list[ClipOut]` |
| main.py 行数 | 114 行 | 44 行（**-61%**） |

---

## 六、影响范围

| 文件 | 状态 |
|------|------|
| `models/clip.py` | **新建** |
| `models/collection.py` | **新建** |
| `models/favorite.py` | **新建** |
| `models/translation.py` | **新建** |
| `repositories/clip_repo.py` | **新建** |
| `repositories/favorite_repo.py` | **新建** |
| `repositories/translation_repo.py` | **新建** |
| `repositories/progress_repo.py` | **新建** |
| `routers/clips.py` | **新建**（替换 clips_api.py） |
| `routers/favorites.py` | **新建**（替换 favorites_api.py） |
| `routers/translation.py` | **新建**（从 main.py 移出） |
| `routers/__init__.py` | **更新**（集中路由注册） |
| `main.py` | **精简**（-70 行，-61%） |

---

## 七、未完成（可后续优化）

- collections_api.py（549 行）尚未拆分 — 需较大重构
- stats_api.py、progress_api.py、words.py 尚未使用 Repository
- 缺少单元测试
