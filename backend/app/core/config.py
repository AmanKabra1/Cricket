"""Application settings, loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    PROJECT_NAME: str = "LocalScore"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    # NoDecode → don't JSON-parse the env value; the validator splits a
    # comma-separated string (e.g. "https://a.app,https://b.app").
    BACKEND_CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Security
    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database — async for the app, sync for Alembic
    DATABASE_URL: str = "mysql+aiomysql://localscore:localscore@localhost:3306/localscore"
    SYNC_DATABASE_URL: str = "mysql+pymysql://localscore:localscore@localhost:3306/localscore"
    DB_ECHO: bool = False
    # Enable TLS to the database (required by TiDB Cloud Serverless). Uses the
    # system CA bundle — no fragile ssl params in the connection URL.
    DB_SSL: bool = False
    DB_SSL_CA: str = "/etc/ssl/certs/ca-certificates.crt"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Rate limiting (per IP, per endpoint, per minute) — applies to auth + writes
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 120

    # Object storage
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_PUBLIC_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "localscore-media"
    S3_REGION: str = "us-east-1"

    # AI service
    AI_SERVICE_URL: str = "http://localhost:8100"
    OPENAI_API_KEY: str = ""

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
