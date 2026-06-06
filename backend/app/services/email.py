"""Email via SMTP. No-op (logged) when SMTP isn't configured, so the app works
without email in dev/free-tier. smtplib is blocking → run in a threadpool."""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import parseaddr
from html import escape

import httpx
from starlette.concurrency import run_in_threadpool

from app.core.config import settings

logger = logging.getLogger("localscore.email")


def email_enabled() -> bool:
    # Any one of: Brevo HTTP API, Resend HTTP API, or classic SMTP.
    return bool(
        settings.BREVO_API_KEY
        or settings.RESEND_API_KEY
        or (settings.SMTP_HOST and settings.SMTP_USER)
    )


def _from_parts() -> tuple[str, str]:
    """Split SMTP_FROM ("Name <email>") into (name, email)."""
    name, addr = parseaddr(settings.SMTP_FROM)
    return name or "LocalScore", addr or settings.SMTP_USER


async def _send_via_brevo_api(to: str, subject: str, body: str, html: str | None) -> None:
    """Send over Brevo's HTTPS API — works where outbound SMTP ports are blocked."""
    name, addr = _from_parts()
    payload = {
        "sender": {"email": addr, "name": name},
        "to": [{"email": to}],
        "subject": subject,
        "textContent": body,
    }
    if html:
        payload["htmlContent"] = html
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.brevo.com/v3/smtp/email",
            # .strip() guards against a stray space/newline pasted into the env var
            # (a frequent cause of a 401 with an otherwise-valid key).
            headers={"api-key": settings.BREVO_API_KEY.strip(), "content-type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()


async def _send_via_resend(to: str, subject: str, body: str, html: str | None) -> None:
    """Send over Resend's HTTPS API (https://resend.com)."""
    sender = settings.RESEND_FROM or settings.SMTP_FROM
    payload = {"from": sender, "to": [to], "subject": subject, "text": body}
    if html:
        payload["html"] = html
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY.strip()}"},
            json=payload,
        )
        resp.raise_for_status()


def _send_sync(to: str, subject: str, body: str, html: str | None) -> None:
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")  # clients prefer the HTML part
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


async def send_email(to: str, subject: str, body: str, html: str | None = None) -> bool:
    """Best-effort send. Returns True if sent, False if disabled/failed."""
    ok, _ = await try_send_email(to, subject, body, html)
    return ok


async def try_send_email(
    to: str, subject: str, body: str, html: str | None = None
) -> tuple[bool, str | None]:
    """Like send_email but also returns the failure reason (for diagnostics).

    Returns (True, None) on success, (False, reason) otherwise. `body` is the
    plain-text part; `html` (optional) is shown by clients that support it.
    """
    if not email_enabled():
        logger.info("email disabled — would send to %s: %s", to, subject)
        return False, "Email not configured (set BREVO_API_KEY, or SMTP_HOST/SMTP_USER)"
    try:
        if settings.BREVO_API_KEY:
            await _send_via_brevo_api(to, subject, body, html)  # HTTPS — preferred
        elif settings.RESEND_API_KEY:
            await _send_via_resend(to, subject, body, html)  # HTTPS alternative
        else:
            await run_in_threadpool(_send_sync, to, subject, body, html)  # SMTP fallback
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


def match_assignment_body(
    full_name: str, team_a: str, team_b: str, when: str, venue: str | None
) -> str:
    where = f" at {venue}" if venue else ""
    return (
        f"Hi {full_name},\n\n"
        f"You've been assigned to score {team_a} vs {team_b}, scheduled for {when}{where}.\n\n"
        "You'll also get a reminder a few hours before it starts.\n"
        f"Open the scoring console: {settings.FRONTEND_URL}\n\n— LocalScore"
    )


# ---------------------------------------------------------------------------
# HTML versions — a small branded template so the emails aren't a plain block.
# These are sent as the HTML part *alongside* the plain-text body above, so
# clients that don't render HTML still show the text.
# ---------------------------------------------------------------------------

def _html_shell(heading: str, paragraphs: list[str], button: tuple[str, str] | None = None) -> str:
    blocks = "".join(
        f'<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.6">{p}</p>'
        for p in paragraphs
    )
    cta = ""
    if button:
        label, url = button
        cta = (
            f'<a href="{url}" style="display:inline-block;background:#16a34a;color:#ffffff;'
            'text-decoration:none;font-weight:700;padding:11px 22px;border-radius:8px;'
            f'font-size:15px">{label}</a>'
        )
    return (
        '<div style="background:#f3f4f6;padding:24px 12px">'
        '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;'
        'overflow:hidden;border:1px solid #e5e7eb;'
        'font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">'
        '<div style="background:#16a34a;padding:18px 24px">'
        '<span style="color:#ffffff;font-size:18px;font-weight:800">🏏 LocalScore</span></div>'
        f'<div style="padding:24px"><h1 style="margin:0 0 16px;font-size:20px;color:#111827">{heading}</h1>'
        f'{blocks}{cta}</div>'
        '<div style="padding:14px 24px;border-top:1px solid #f0f0f0;color:#9ca3af;font-size:12px">'
        'LocalScore · live cricket scoring</div>'
        '</div></div>'
    )


def welcome_admin_html(full_name: str, email: str, password: str, role: str) -> str:
    n, e, p = escape(full_name), escape(email), escape(password)
    return _html_shell(
        f"Welcome, {n}",
        [
            f"A LocalScore <b>{escape(role.replace('_', ' ').title())}</b> account has been created for you.",
            f"<b>Email:</b> {e}<br><b>Password:</b> {p}",
            "Please sign in and change your password if you'd like.",
        ],
        ("Open LocalScore", settings.FRONTEND_URL),
    )


def match_reminder_html(full_name: str, team_a: str, team_b: str, when: str) -> str:
    return _html_shell(
        "Match reminder",
        [
            f"Hi {escape(full_name)},",
            f"You're assigned to score <b>{escape(team_a)} vs {escape(team_b)}</b>, "
            f"starting <b>{escape(when)}</b>.",
        ],
        ("Open scoring console", settings.FRONTEND_URL),
    )


def match_assignment_html(
    full_name: str, team_a: str, team_b: str, when: str, venue: str | None
) -> str:
    where = f" at {escape(venue)}" if venue else ""
    return _html_shell(
        "You've got a match to score",
        [
            f"Hi {escape(full_name)},",
            f"You've been assigned to score <b>{escape(team_a)} vs {escape(team_b)}</b>, "
            f"scheduled for <b>{escape(when)}</b>{where}.",
            "You'll also get a reminder a few hours before it starts.",
        ],
        ("Open scoring console", settings.FRONTEND_URL),
    )
