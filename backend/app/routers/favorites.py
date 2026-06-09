"""Favorites API — uses FavoriteRepository for data access."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from models.favorite import FavoriteOut, FavoriteCreate
from repositories.favorite_repo import FavoriteRepository
from database import get_conn

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


def get_repo() -> FavoriteRepository:
    return FavoriteRepository(get_conn())


@router.get("/", response_model=list[FavoriteOut])
def list_favorites(repo: FavoriteRepository = Depends(get_repo)):
    return repo.list_all()


@router.post("/", status_code=201)
def add_favorite(data: FavoriteCreate, repo: FavoriteRepository = Depends(get_repo)):
    return repo.add(data)


@router.delete("/{fav_id}")
def remove_favorite(fav_id: int, repo: FavoriteRepository = Depends(get_repo)):
    repo.remove(fav_id)
    return {"ok": True}


@router.delete("/by-item/{item_type}/{item_id}")
def remove_favorite_by_item(item_type: str, item_id: str, repo: FavoriteRepository = Depends(get_repo)):
    repo.remove_by_item(item_type, item_id)
    return {"ok": True}
