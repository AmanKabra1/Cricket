"""Thin LLM helper. Uses LangChain + OpenAI when an API key is configured;
otherwise callers fall back to deterministic templates. Importing this module
never requires the LLM stack to be installed or a key to be present."""
from __future__ import annotations

import logging

from app.config import settings

logger = logging.getLogger("ai.llm")

_llm = None
_init = False


def llm_available() -> bool:
    return bool(settings.OPENAI_API_KEY)


def _get_llm():
    global _llm, _init
    if _init:
        return _llm
    _init = True
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from langchain_openai import ChatOpenAI  # noqa: PLC0415

        _llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.7,
            max_tokens=160,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM init failed, using templates: %s", exc)
        _llm = None
    return _llm


def complete(prompt: str) -> str | None:
    """Return LLM text, or None to signal the caller should use a template."""
    llm = _get_llm()
    if llm is None:
        return None
    try:
        return llm.invoke(prompt).content.strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM call failed: %s", exc)
        return None
