"""Translation cache API — uses TranslationRepository for data access."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from models.translation import TranslationIn, TranslationOut
from repositories.translation_repo import TranslationRepository
from database import get_conn

router = APIRouter(prefix="/api/translations", tags=["translations"])


def get_repo() -> TranslationRepository:
    return TranslationRepository(get_conn())


@router.get("/{source_type}/{source_text}")
def get_translation(source_type: str, source_text: str, repo: TranslationRepository = Depends(get_repo)):
    return repo.get(source_type, source_text)


@router.post("")
@router.post("/")
def save_translation(data: TranslationIn, repo: TranslationRepository = Depends(get_repo)):
    return repo.upsert(data)
