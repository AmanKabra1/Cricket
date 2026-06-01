"""Super-admin: user management and role assignment."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_super_admin
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


class CreateUser(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)
    role: UserRole = UserRole.MATCH_ADMIN


class RoleUpdate(BaseModel):
    role: UserRole


class ActiveUpdate(BaseModel):
    is_active: bool


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: DbSession, _: User = Depends(require_super_admin)
) -> list[User]:
    return list((await db.scalars(select(User).order_by(User.created_at.desc()))).all())


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: CreateUser,
    db: DbSession,
    _: User = Depends(require_super_admin),
) -> User:
    """Super admin creates an admin (or another super admin) directly."""
    if await db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


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
