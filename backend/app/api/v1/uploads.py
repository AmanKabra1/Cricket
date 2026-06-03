"""Image upload endpoints (admin only). Returns a public URL to store on the
relevant entity (team.logo_url, player.photo_url, etc.)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from app.api.deps import require_admin
from app.models.user import User
from app.services.storage import MAX_BYTES, StorageError, upload_image

router = APIRouter(prefix="/uploads", tags=["uploads"])

_CATEGORIES = {"team_logo", "player_photo", "match_image"}


@router.post("/{category}")
async def upload(
    category: str,
    request: Request,
    file: UploadFile = File(...),
    _: User = Depends(require_admin),
) -> dict:
    if category not in _CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {_CATEGORIES}")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 5 MB limit")
    try:
        url = await upload_image(data, file.content_type or "", category, base_url=str(request.base_url))
    except StorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"url": url, "category": category}
