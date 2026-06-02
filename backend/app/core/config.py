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

    # Public site URL (used in emails so admins get a working link)
    FRONTEND_URL: str = "http://localhost:5173"

    # Email (SMTP). Leave SMTP_HOST blank to disable email (calls become no-ops).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "LocalScore <no-reply@localscore.app>"
    SMTP_TLS: bool = True

    # Maintenance / data retention (free-tier housekeeping)
    MAINTENANCE_TOKEN: str = ""  # shared secret for the cron to call the endpoint
    COMPLETED_MATCH_RETENTION_DAYS: int = 7  # delete completed matches older than this
    ADMIN_RETENTION_DAYS: int = 15  # delete match-admin accounts older than this
    MATCH_REMINDER_HOURS: int = 3  # email assigned admins this many hours before start
    # Built-in automatic scheduler — runs cleanup + reminders without any cron.
    MAINTENANCE_AUTO: bool = True
    MAINTENANCE_INTERVAL_MINUTES: int = 60

    # Match lifecycle timing. scheduled_at is stored as the picked wall-clock
    # time (no UTC conversion), so we compare against "now" in this timezone.
    APP_TIMEZONE: str = "Asia/Kolkata"
    # BCCI-style pacing used to estimate when an un-scored match should have
    # finished, so a no-show can be auto-retired off the live/upcoming lists.
    MATCH_MINUTES_PER_OVER: float = 4.5  # ~T20 over rate (one innings)
    MATCH_INNINGS_BREAK_MINUTES: int = 20  # break between innings (doubled for >20 overs)
    MATCH_NOSHOW_GRACE_MINUTES: int = 60  # slack for toss/late start before retiring it

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        # Accept a comma-separated string or a list; normalise each origin by
        # trimming whitespace and a trailing slash (browsers send the Origin
        # without one, so "https://x.app/" must still match "https://x.app").
        if isinstance(v, str):
            items: list[str] = v.split(",")
        elif isinstance(v, (list, tuple)):
            items = [str(o) for o in v]
        else:
            return v
        return [o.strip().rstrip("/") for o in items if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
