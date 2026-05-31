"""AI service settings."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SERVICE_NAME: str = "LocalScore AI"
    DEBUG: bool = True

    # LLM (optional). When unset, commentary/summary fall back to templates.
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"

    # Directory holding trained model artifacts (*.joblib). When absent, the
    # heuristic predictors are used — so the service works before any training.
    MODEL_DIR: str = "models"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
