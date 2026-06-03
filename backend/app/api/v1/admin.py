"""Super-admin: user management, role assignment, and app settings."""
from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_super_admin
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.setting import AppSetting
from app.models.user import User
from app.schemas.auth import UserOut
from app.services.email import email_enabled, send_email, try_send_email, welcome_admin_body
from app.services.maintenance import delete_user_and_matches, run_maintenance
from app.services.training_data import FEATURE_KEYS, export_training_rows

router = APIRouter(prefix="/admin", tags=["admin"])

BACKGROUNDS_KEY = "backgrounds"


class BackgroundEntry(BaseModel):
    light: str | None = None
    dark: str | None = None


class BackgroundsUpdate(BaseModel):
    # {page: {light, dark}} — page in home/teams/tournaments/match/admin/auth
    pages: dict[str, BackgroundEntry]


@router.put("/settings/backgrounds")
async def set_backgrounds(
    payload: BackgroundsUpdate,
    db: DbSession,
    _: User = Depends(require_super_admin),
) -> dict:
    data = {p: e.model_dump() for p, e in payload.pages.items()}
    row = await db.get(AppSetting, BACKGROUNDS_KEY)
    if row:
        row.value = json.dumps(data)
    else:
        db.add(AppSetting(key=BACKGROUNDS_KEY, value=json.dumps(data)))
    await db.commit()
    return data


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
    background: BackgroundTasks,
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
    # Send the welcome email AFTER responding (background) so creation is instant
    # even if SMTP is slow/unreachable.
    background.add_task(
        send_email,
        user.email,
        "Your LocalScore admin account",
        welcome_admin_body(user.full_name, payload.email, payload.password, user.role.value),
    )
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


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int, db: DbSession, current: User = Depends(require_super_admin)
) -> dict:
    """Delete a user AND every match they were assigned to (+ that match's data)."""
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="You can't delete your own account")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    removed = await delete_user_and_matches(db, user)
    await db.commit()
    return {"ok": True, "deleted_matches": removed}


@router.get("/ai/training-data")
async def ai_training_data(
    db: DbSession, _: User = Depends(require_super_admin)
) -> dict:
    """Labelled ball-by-ball rows from completed matches, for model training."""
    rows = await export_training_rows(db)
    return {"count": len(rows), "feature_keys": FEATURE_KEYS, "rows": rows}


@router.post("/maintenance/run")
async def maintenance_run(db: DbSession, _: User = Depends(require_super_admin)) -> dict:
    """Manually run housekeeping (purge old matches, expire stale admins, reminders)."""
    return await run_maintenance(db)


@router.post("/test-email")
async def test_email(current: User = Depends(require_super_admin)) -> dict:
    """Send a test email to the signed-in super admin to verify SMTP config."""
    if not email_enabled():
        return {"configured": False, "sent": False, "detail": "SMTP not configured (set SMTP_HOST/SMTP_USER)."}
    ok, error = await try_send_email(
        current.email,
        "LocalScore test email",
        "This is a test email from LocalScore. If you received it, email is working.",
    )
    if ok:
        detail = "Sent — check your inbox/spam."
    elif error and "401" in error:
        detail = (
            f"Send failed: {error}. 401 = bad API key. BREVO_API_KEY must be a v3 "
            "API key (starts 'xkeysib-', from Brevo → SMTP & API → API Keys), NOT "
            "the SMTP key ('xsmtpsib-')."
        )
    else:
        detail = (
            f"Send failed: {error}. Tip: SMTP_FROM must be a sender VERIFIED in Brevo "
            "(free webmail like gmail.com is often rejected)."
        )
    return {"configured": True, "sent": ok, "detail": detail}
