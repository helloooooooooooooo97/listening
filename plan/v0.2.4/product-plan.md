# v0.2.4 Product Plan — 后端代码拆分 + 面向对象

> 目标：模块化拆分、Repository 模式、消除过程式代码

---

## 一、目录结构重构

### 现状
```
backend/app/
├── main.py                 # 路由 + translation API 混杂
├── database.py             # 单连接 + 手动锁
├── services/__init__.py    # 文件缓存 + 业务逻辑
├── models/__init__.py      # 仅 LessonSummary / ListeningLesson
├── routers/
│   ├── __init__.py          # lessons API (~43 行)
│   ├── clips_api.py         # Clips CRUD
│   ├── collections_api.py   # 549 行 — 巨型文件
│   ├── favorites_api.py     # Favorites CRUD
│   ├── import_api.py        # 导入
│   ├── progress_api.py     # 进度
│   ├── stats_api.py         # 统计
│   └── words.py            # 单词查询
```

### 目标
```
backend/app/
├── main.py                    # 仅路由注册 + 中间件
├── database.py                # 连接管理（保持不变）
│
├── models/                    # Pydantic models
│   ├── __init__.py
│   ├── clip.py                # ClipCreate / ClipUpdate / ClipOut
│   ├── collection.py          # CollectionCreate / CollectionDetail / ...
│   ├── favorite.py            # FavoriteCreate / FavoriteOut
│   └── translation.py         # TranslationIn / TranslationOut
│
├── repositories/              # DAO 层 — 数据访问
│   ├── __init__.py
│   ├── clip_repo.py           # ClipRepository
│   ├── collection_repo.py     # CollectionRepository
│   ├── favorite_repo.py       # FavoriteRepository
│   └── translation_repo.py    # TranslationRepository
│
├── services/                  # 业务逻辑层
│   ├── __init__.py            # 课程服务（文件缓存）
│   ├── clip_service.py        # ClipService
│   ├── collection_service.py  # CollectionService
│   ├── translation_service.py # TranslationService
│   └── stats_service.py       # StatsService
│
└── routers/                   # 路由层 — 仅 HTTP 编排
    ├── __init__.py
    ├── clips.py
    ├── collections.py
    ├── favorites.py
    ├── import_api.py
    ├── progress_api.py
    ├── stats.py
    └── words.py
```

---

## 二、Repository 模式

每个 Repository 类封装一个表的全部 SQL 操作，返回 Pydantic model。

### ClipRepository 示例

```python
# repositories/clip_repo.py
from models.clip import ClipOut, ClipCreate, ClipUpdate

class ClipRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def list_all(self) -> list[ClipOut]:
        rows = self._conn.execute("SELECT * FROM clips ORDER BY created_at DESC").fetchall()
        return [ClipOut.model_validate(dict(r)) for r in rows]

    def get_by_id(self, clip_id: int) -> ClipOut | None:
        row = self._conn.execute("SELECT * FROM clips WHERE id=?", [clip_id]).fetchone()
        return ClipOut.model_validate(dict(row)) if row else None

    def create(self, data: ClipCreate) -> ClipOut:
        cur = self._conn.execute(
            "INSERT INTO clips (audio_id, audio_title, start_time, end_time, text, note, color) VALUES (?,?,?,?,?,?,?)",
            [data.audio_id, data.audio_title, data.start_time, data.end_time, data.text, data.note, data.color],
        )
        return self.get_by_id(cur.lastrowid)

    def update(self, clip_id: int, data: ClipUpdate) -> ClipOut | None:
        existing = self.get_by_id(clip_id)
        if not existing:
            return None
        updates = data.model_dump(exclude_none=True)
        if not updates:
            return existing
        sets = ", ".join(f"{k}=?" for k in updates)
        values = list(updates.values()) + [clip_id]
        self._conn.execute(f"UPDATE clips SET {sets} WHERE id=?", values)
        return self.get_by_id(clip_id)

    def delete(self, clip_id: int) -> bool:
        cur = self._conn.execute("DELETE FROM clips WHERE id=?", [clip_id])
        return cur.rowcount > 0
```

### 依赖注入

```python
# database.py — 新增 get_repo 工厂
from repositories.clip_repo import ClipRepository
from repositories.collection_repo import CollectionRepository

def get_clip_repo() -> ClipRepository:
    return ClipRepository(get_conn())

def get_collection_repo() -> CollectionRepository:
    return CollectionRepository(get_conn())
```

### 涉及的表

| Repository | 表 | 当前文件 |
|------------|-----|----------|
| `ClipRepository` | `clips` | `clips_api.py` |
| `CollectionRepository` | `collections` + `collection_items` | `collections_api.py` |
| `FavoriteRepository` | `favorites` | `favorites_api.py` |
| `TranslationRepository` | `translations` | `main.py` |
| `ProgressRepository` | `play_history`, `dictation_history`, `audio_progress` | `progress_api.py` + `stats_api.py` |

---

## 三、Service 层

Service 层负责业务逻辑，组合多个 Repository。

```python
# services/collection_service.py
class CollectionService:
    def __init__(self, repo: CollectionRepository):
        self._repo = repo

    def resolve_items(self, collection_id: int) -> list[CollectionItemOut]:
        """获取合集条目，动态集执行 SQL 查询"""
        col = self._repo.get_by_id(collection_id)
        if col.is_dynamic:
            return self._execute_dynamic_query(col.dynamic_type)
        return self._repo.list_items(collection_id)

    def _execute_dynamic_query(self, dynamic_type: str) -> list[CollectionItemOut]:
        query = DYNAMIC_QUERIES.get(dynamic_type)
        if not query:
            return []
        ...
```

### 现有 services/__init__.py 的改造

当前 `services/__init__.py` 承担了 lessons 文件加载和缓存，可保留为 `LessonService`：

```python
# services/lesson_service.py
class LessonService:
    _cache: dict[str, Any] = {}
    _cache_mtime: float = 0

    def list_lessons(self) -> list[LessonSummary]: ...
    def get_lesson(self, lesson_id: str) -> ListeningLesson | None: ...
    def get_audio_path(self, lesson_id: str) -> Path | None: ...
    def get_stats(self) -> dict: ...
```

---

## 四、拆分优先级

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| 1 | **Pydantic models** — 从路由中提取所有 schema 到 `models/` | 新建 5 个 model 文件 | 1h |
| 2 | **ClipRepository** — 提取 clips CRUD | `repositories/clip_repo.py` | 1h |
| 3 | **CollectionRepository** — collections + items 查询 | `repositories/collection_repo.py` | 1.5h |
| 4 | **FavoriteRepository** — favorites CRUD | `repositories/favorite_repo.py` | 0.5h |
| 5 | **TranslationRepository** — translation 去重 | `repositories/translation_repo.py` | 0.5h |
| 6 | **LessonService** — 课程缓存服务 | `services/lesson_service.py` | 0.5h |
| 7 | **路由精简** — clips/favorites 路由只留 HTTP 编排 | `routers/clips.py`, `routers/favorites.py` | 1h |
| 8 | **collections_api 拆分** — 549 行 → 路由 + service | `routers/collections.py` + `services/collection_service.py` | 2h |
| 9 | **main.py translation 提取** — 移到 service | `services/translation_service.py` | 0.5h |
| 10 | **stats_api 拆分** — stats service | `services/stats_service.py` | 1h |
| 11 | **progress_api 提取** — progress repo | `repositories/progress_repo.py` | 0.5h |

---

## 五、OOP 核心原则

### 5.1 单⼀职责
- **Repository** — 只做 SQL 读写，不处理业务逻辑
- **Service** — 只做业务编排，不直接暴露 HTTP
- **Router** — 只做 HTTP 参数解析 + 响应，不写 SQL

### 5.2 依赖注入
- Repository 通过构造器接收 `conn`
- Service 通过构造器接收 Repository
- Router 通过 `Depends` 获取 Service/Repository

```python
# router 示例
from fastapi import Depends
from database import get_conn
from repositories.clip_repo import ClipRepository

def get_clip_repo(conn=Depends(get_conn)) -> ClipRepository:
    return ClipRepository(conn)

@router.get("/", response_model=list[ClipOut])
def list_clips(repo: ClipRepository = Depends(get_clip_repo)):
    return repo.list_all()
```

### 5.3 Pydantic 校验
- 所有输入用 `BaseModel`（已有）
- 所有输出用 `BaseModel`（**当前缺失**）
- 使用 `model_validate` / `model_dump` 替代手动 `dict(r)`

---

---

## 六、路由统一注册

### 现状

```python
# main.py — 7 行 import + 7 行 include_router，散乱
from routers import router as lessons_router
from routers.words import router as words_router
from routers.clips_api import router as clips_router
from routers.progress_api import router as progress_router
from routers.stats_api import router as stats_router
from routers.favorites_api import router as favorites_router
from routers.import_api import router as import_router
from routers.collections_api import router as collections_router

app.include_router(lessons_router)
app.include_router(words_router)
app.include_router(clips_router)
# ...
```

### 目标

**方案 A — 集中注册（推荐）：**

```python
# routers/__init__.py
from .clips import router as clips_router
from .collections import router as collections_router
from .favorites import router as favorites_router
from .import_api import router as import_router
from .progress_api import router as progress_router
from .stats import router as stats_router
from .translation import router as translation_router
from .words import router as words_router

routers = [
    clips_router,
    collections_router,
    favorites_router,
    import_router,
    progress_router,
    stats_router,
    translation_router,
    words_router,
]
```

```python
# main.py — 仅 3 行
from routers import routers
for r in routers:
    app.include_router(r)
```

**方案 B — App factory（更 OOP）：**

```python
# app.py
class Application:
    def __init__(self):
        self.app = FastAPI(title="英语听力 API", version="0.3.0")
        self._register_middleware()
        self._register_routers()

    def _register_routers(self):
        from routers import routers as router_list
        for r in router_list:
            self.app.include_router(r)

    def _register_middleware(self):
        self.app.add_middleware(CORSMiddleware, ...)
```

### main.py 职责收敛

**之前：** main.py 承担了 import routers → 注册 → translation API → 静态文件挂载 → 直接入口

**之后：** main.py 只做初始化 + 中间件 + 挂载：

```python
def create_app() -> FastAPI:
    app = FastAPI(...)
    app.add_middleware(...)
    app.add_exception_handler(...)
    from routers import register_routers
    register_routers(app)
    # Serve frontend
    if dist exists:
        app.mount('/', StaticFiles(...))
    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, ...)
```

---

## 七、完整目录结构（最终版）

```
backend/app/
├── main.py                         # create_app() + 中间件 + 挂载
├── database.py                     # get_conn() + locked 装饰器
├── __init__.py
│
├── models/                         # Pydantic 数据模型
│   ├── __init__.py
│   ├── clip.py
│   ├── collection.py
│   ├── favorite.py
│   ├── lesson.py                   # 现有 LessonSummary / ListeningLesson
│   └── translation.py
│
├── repositories/                   # DAO 层
│   ├── __init__.py
│   ├── clip_repo.py
│   ├── collection_repo.py
│   ├── favorite_repo.py
│   ├── progress_repo.py
│   └── translation_repo.py
│
├── services/                       # 业务逻辑层
│   ├── __init__.py
│   ├── lesson_service.py           # 课程缓存（原 services/__init__.py）
│   ├── collection_service.py
│   ├── stats_service.py
│   └── translation_service.py
│
└── routers/                        # HTTP 路由层
    ├── __init__.py                 # 收集所有 router → 统一注册
    ├── clips.py
    ├── collections.py
    ├── favorites.py
    ├── import_api.py
    ├── progress_api.py
    ├── stats.py
    ├── translation.py              # 从 main.py 移出
    └── words.py
```

---

## 八、里程碑

1. **Pydantic Models**（1h）
2. **Clips CRUD 重构**（1h）
3. **Favorites + Translation 重构**（1h）
4. **Collections 重构**（2h）
5. **Stats + Progress 重构**（1.5h）
6. **旧文件清理 + 验证**（0.5h）

总计约 **2 天**
