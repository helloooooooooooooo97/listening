"""Clips CRUD API — uses ClipRepository for data access."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from models.clip import ClipCreate, ClipUpdate, ClipOut
from repositories.clip_repo import ClipRepository
from database import get_conn

router = APIRouter(prefix="/api/clips", tags=["clips"])


def get_repo() -> ClipRepository:
    return ClipRepository(get_conn())


@router.get("/", response_model=list[ClipOut])
def list_clips(repo: ClipRepository = Depends(get_repo)):
    return repo.list_all()


@router.post("/", status_code=201, response_model=ClipOut)
def create_clip(data: ClipCreate, repo: ClipRepository = Depends(get_repo)):
    return repo.create(data)


@router.put("/{clip_id}", response_model=ClipOut)
def update_clip(clip_id: int, data: ClipUpdate, repo: ClipRepository = Depends(get_repo)):
    result = repo.update(clip_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Clip not found")
    return result


@router.delete("/{clip_id}")
def delete_clip(clip_id: int, repo: ClipRepository = Depends(get_repo)):
    if not repo.delete(clip_id):
        raise HTTPException(status_code=404, detail="Clip not found")
    return {"ok": True}
