"""Venue management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_admin
from app.models.enums import UserRole
from app.models.venue import Venue
from app.schemas.catalog import VenueCreate, VenueOut

from app.models.user import User

router = APIRouter(prefix="/venues", tags=["venues"])


@router.get("", response_model=list[VenueOut])
async def list_venues(db: DbSession, user: User = Depends(require_admin)) -> list[Venue]:
    # Super admins see every venue; a match admin sees only the venues they created.
    stmt = select(Venue).order_by(Venue.name)
    if user.role != UserRole.SUPER_ADMIN:
        stmt = stmt.where(Venue.created_by_id == user.id)
    return list((await db.scalars(stmt)).all())


@router.post("", response_model=VenueOut, status_code=status.HTTP_201_CREATED)
async def create_venue(
    payload: VenueCreate, db: DbSession, user: User = Depends(require_admin)
) -> Venue:
    venue = Venue(**payload.model_dump(), created_by_id=user.id)
    db.add(venue)
    await db.commit()
    await db.refresh(venue)
    return venue


@router.patch("/{venue_id}", response_model=VenueOut)
async def update_venue(
    venue_id: int,
    payload: VenueCreate,
    db: DbSession,
    user: User = Depends(require_admin),
) -> Venue:
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    for field, value in payload.model_dump().items():
        setattr(venue, field, value)
    await db.commit()
    await db.refresh(venue)
    return venue


@router.delete("/{venue_id}")
async def delete_venue(
    venue_id: int, db: DbSession, user: User = Depends(require_admin)
) -> dict:
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    # Only the venue's creator (or a super admin) may delete it.
    if user.role != UserRole.SUPER_ADMIN and venue.created_by_id not in (None, user.id):
        raise HTTPException(status_code=403, detail="Only the venue's creator or a super admin can delete it.")
    # Matches reference venue with ON DELETE SET NULL, so this is always safe.
    await db.delete(venue)
    await db.commit()
    return {"ok": True}
