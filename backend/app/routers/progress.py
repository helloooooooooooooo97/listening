"""Progress API — dictation, play history, word progress, reviews."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from database import get_conn, locked
from repositories.progress_repo import ProgressRepository
from services.currency_service import settle

router = APIRouter(prefix="/api/progress", tags=["progress"])


def get_repo() -> ProgressRepository:
    return ProgressRepository(get_conn())


# ── Schemas ──


class DictationCreate(BaseModel):
    audio_id: str
    audio_title: str
    sentence_index: int
    score: float
    user_input: str = ''
    expected_text: str = ''


class PlayCreate(BaseModel):
    audio_id: str
    audio_title: str
    duration_seconds: float = 0


class WordKnownUpdate(BaseModel):
    word: str
    known: bool


class WordReviewIn(BaseModel):
    word: str
    score: float


class BatchReviewIn(BaseModel):
    session_id: str
    source: str = "review"
    mode: str = "fill-in"
    results: list[BatchReviewItem]


class BatchReviewItem(BaseModel):
    word: str
    correct: bool = False
    score: float = 0
    session_index: int = 0


# ── Dictation ──


@router.post("/dictation", status_code=201)
@locked
def add_dictation(data: DictationCreate, repo: ProgressRepository = Depends(get_repo)):
    repo.add_dictation(data.audio_id, data.audio_title, data.sentence_index, data.score, data.user_input, data.expected_text)
    repo.update_dictation_progress(data.audio_id, data.audio_title, data.score)
    settle(get_conn())
    return {"ok": True}


# ── Play History ──


@router.get("/play-history")
def list_history(repo: ProgressRepository = Depends(get_repo)):
    return repo.list_play_history()


@router.post("/play-history", status_code=201)
@locked
def add_history(data: PlayCreate, repo: ProgressRepository = Depends(get_repo)):
    repo.add_play_history(data.audio_id, data.audio_title, data.duration_seconds)
    repo.upsert_play_progress(data.audio_id, data.audio_title, data.duration_seconds)
    settle(get_conn())
    return {"ok": True}


# ── Word Progress ──


@router.get("/words")
def list_word_progress(repo: ProgressRepository = Depends(get_repo)):
    return repo.get_known_words()


@router.post("/words")
@locked
def set_word_known(data: WordKnownUpdate, repo: ProgressRepository = Depends(get_repo)):
    repo.set_word_known(data.word, data.known)
    settle(get_conn())
    return {"ok": True}


# ── Review System ──


@router.post("/words/review", status_code=201)
@locked
def submit_review(data: WordReviewIn, repo: ProgressRepository = Depends(get_repo)):
    repo.add_review(data.word, data.score)
    settle(get_conn())
    return {"ok": True}


@router.post("/review/batch", status_code=201)
@locked
def submit_batch_review(data: BatchReviewIn, repo: ProgressRepository = Depends(get_repo)):
    """Batch-submit a review session: writes to review_history + updates word_progress."""
    result = repo.batch_review(
        session_id=data.session_id,
        source=data.source,
        mode=data.mode,
        results=[r.model_dump() for r in data.results],
    )
    settle(get_conn())
    return result


@router.get("/review/history")
def get_review_history(limit: int = 50, repo: ProgressRepository = Depends(get_repo)):
    """Return recent review sessions, grouped by session_id."""
    return {"sessions": repo.get_review_history(limit)}


@router.get("/review/stats")
def get_review_stats(repo: ProgressRepository = Depends(get_repo)):
    """Return today's review stats and streak."""
    return repo.get_review_stats()


@router.get("/words/due")
def due_words(limit: int = Query(default=20, ge=1, le=100), repo: ProgressRepository = Depends(get_repo)):
    return {"words": repo.get_due_words(limit)}


@router.get("/words/due-count")
def due_words_count(repo: ProgressRepository = Depends(get_repo)):
    return {"count": repo.get_due_words_count()}


# ── Daily Words ──


class ListenedWordsRecord(BaseModel):
    words: list[str]
    audio_id: str
    audio_title: str


@router.post("/listened-words", status_code=201)
def record_listened_words(data: ListenedWordsRecord, repo: ProgressRepository = Depends(get_repo)):
    repo.record_listened_words(data.words, data.audio_id, data.audio_title)
    return {"ok": True}


@router.get("/daily-words/today")
def get_today_words(repo: ProgressRepository = Depends(get_repo)):
    return {"words": repo.get_today_words()}


@router.get("/daily-words/stats")
def get_today_stats(repo: ProgressRepository = Depends(get_repo)):
    return repo.get_today_stats()
