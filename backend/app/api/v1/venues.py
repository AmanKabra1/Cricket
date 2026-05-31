"""Venue management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_admin
from app.models.venue import Venue
from app.schemas.catalog import VenueCreate, VenueOut

from app.models.user import User

router = APIRouter(prefix="/venues", tags=["venues"])


@router.get("", response_model=list[VenueOut])
async def list_venues(db: DbSession) -> list[Venue]:
    return list((await db.scalars(select(Venue).order_by(Venue.name))).all())


@router.post("", response_model=VenueOut, status_code=status.HTTP_201_CREATED)
async def create_venue(
    payload: VenueCreate, db: DbSession, user: User = Depends(require_admin)
) -> Venue:
    venue = Venue(**payload.model_dump())
    db.add(venue)
    await db.commit()
    await db.refresh(venue)
    return venue
