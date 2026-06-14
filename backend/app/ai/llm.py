"""Thin LLM helper (Gemini over HTTPS, optional OpenAI). Returns None → template.

Importing this never requires any LLM stack or key. Uses httpx (already a backend
dependency) for Gemini, so no extra packages are needed.
"""
from __future__ import annotations

import logging

from app.core.config import settings

logger = logging.getLogger("localscore.ai.llm")

_openai_llm = None
_openai_init = False


def llm_available() -> bool:
    return bool(settings.GEMINI_API_KEY or settings.OPENAI_API_KEY)


def _complete_gemini(prompt: str) -> str | None:
    import httpx  # noqa: PLC0415

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent"
    )
    try:
        resp = httpx.post(
            url,
            params={"key": settings.GEMINI_API_KEY},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.7, "maxOutputTokens": 220},
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as exc:  # noqa: BLE001 — never let the LLM break a response
        logger.warning("Gemini call failed, using template: %s", exc)
        return None


def _get_openai():
    global _openai_llm, _openai_init
    if _openai_init:
        return _openai_llm
    _openai_init = True
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from langchain_openai import ChatOpenAI  # noqa: PLC0415

        _openai_llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.7,
            max_tokens=160,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenAI init failed, using templates: %s", exc)
        _openai_llm = None
    return _openai_llm


def complete(prompt: str) -> str | None:
    """Return LLM text, or None to signal the caller should use a template."""
    if settings.GEMINI_API_KEY:
        text = _complete_gemini(prompt)
        if text:
            return text
    llm = _get_openai()
    if llm is None:
        return None
    try:
        return llm.invoke(prompt).content.strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM call failed: %s", exc)
        return None
