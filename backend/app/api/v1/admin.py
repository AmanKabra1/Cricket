"""Super-admin: user management and role assignment."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_super_admin
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


class RoleUpdate(BaseModel):
    role: UserRole


class ActiveUpdate(BaseModel):
    is_active: bool


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: DbSession, _: User = Depends(require_super_admin)
) -> list[User]:
    return list((await db.scalars(select(User).order_by(User.created_at.desc()))).all())


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def set_role(
    user_id: int,
    payload: RoleUpdate,
    db: DbSession,
    _: User = Depends(require_super_admin),
) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}/active", response_model=UserOut)
async def set_active(
    user_id: int,
    payload: ActiveUpdate,
    db: DbSession,
    _: User = Depends(require_super_admin),
) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    return user
