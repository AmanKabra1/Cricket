"""Reusable FastAPI dependencies: DB session, current user, RBAC guards."""
from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import ACCESS_TOKEN, decode_token
from app.models.enums import UserRole
from app.models.match import Match
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbSession,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error
    try:
        payload = decode_token(token)
        if payload.get("type") != ACCESS_TOKEN:
            raise credentials_error
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise credentials_error

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_error
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    """Dependency factory enforcing that the caller holds one of `roles`."""

    async def _guard(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this action",
            )
        return user

    return _guard


require_admin = require_roles(UserRole.MATCH_ADMIN, UserRole.SUPER_ADMIN)
require_super_admin = require_roles(UserRole.SUPER_ADMIN)


async def authorize_match_admin(match_id: int, db: DbSession, user: User) -> Match:
    """Ensure `user` may score `match_id`.

    Super admins may score any match; match admins only those they're assigned to.
    """
    match = await db.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    if user.role == UserRole.SUPER_ADMIN:
        return match

    assigned = await db.scalar(
        select(Match.id)
        .join(Match.admins)
        .where(Match.id == match_id, User.id == user.id)
    )
    if assigned is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to score this match",
        )
    return match
