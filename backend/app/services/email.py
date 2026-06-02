"""Email via SMTP. No-op (logged) when SMTP isn't configured, so the app works
without email in dev/free-tier. smtplib is blocking → run in a threadpool."""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import parseaddr

import httpx
from starlette.concurrency import run_in_threadpool

from app.core.config import settings

logger = logging.getLogger("localscore.email")


def email_enabled() -> bool:
    # Either the Brevo HTTP API (preferred) or classic SMTP can be configured.
    return bool(settings.BREVO_API_KEY or (settings.SMTP_HOST and settings.SMTP_USER))


def _from_parts() -> tuple[str, str]:
    """Split SMTP_FROM ("Name <email>") into (name, email)."""
    name, addr = parseaddr(settings.SMTP_FROM)
    return name or "LocalScore", addr or settings.SMTP_USER


async def _send_via_brevo_api(to: str, subject: str, body: str) -> None:
    """Send over Brevo's HTTPS API — works where outbound SMTP ports are blocked."""
    name, addr = _from_parts()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": settings.BREVO_API_KEY, "content-type": "application/json"},
            json={
                "sender": {"email": addr, "name": name},
                "to": [{"email": to}],
                "subject": subject,
                "textContent": body,
            },
        )
        resp.raise_for_status()


def _send_sync(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> bool:
    """Best-effort send. Returns True if sent, False if disabled/failed."""
    ok, _ = await try_send_email(to, subject, body)
    return ok


async def try_send_email(to: str, subject: str, body: str) -> tuple[bool, str | None]:
    """Like send_email but also returns the failure reason (for diagnostics).

    Returns (True, None) on success, (False, reason) otherwise.
    """
    if not email_enabled():
        logger.info("email disabled — would send to %s: %s", to, subject)
        return False, "Email not configured (set BREVO_API_KEY, or SMTP_HOST/SMTP_USER)"
    try:
        if settings.BREVO_API_KEY:
            await _send_via_brevo_api(to, subject, body)  # HTTPS — preferred
        else:
            await run_in_threadpool(_send_sync, to, subject, body)  # SMTP fallback
        return True, None
    except Exception as exc:  # noqa: BLE001 — never let email break a request
        logger.warning("email send failed to %s: %s", to, exc)
        return False, f"{type(exc).__name__}: {exc}"


def welcome_admin_body(full_name: str, email: str, password: str, role: str) -> str:
    return (
        f"Hi {full_name},\n\n"
        f"A LocalScore {role.replace('_', ' ').title()} account has been created for you.\n\n"
        f"  Website:  {settings.FRONTEND_URL}\n"
        f"  Email:    {email}\n"
        f"  Password: {password}\n\n"
        "Please sign in and change your password if needed.\n\n— LocalScore"
    )


def match_reminder_body(full_name: str, team_a: str, team_b: str, when: str) -> str:
    return (
        f"Hi {full_name},\n\n"
        f"Reminder: you're assigned to score {team_a} vs {team_b}, starting {when}.\n\n"
        f"Open the scoring console: {settings.FRONTEND_URL}\n\n— LocalScore"
    )
