"""Async SQLAlchemy engine, session factory, and declarative base."""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def _connect_args() -> dict:
    """TLS for managed MySQL (TiDB Cloud); aiomysql accepts an SSLContext."""
    if settings.DB_SSL and not settings.DATABASE_URL.startswith("sqlite"):
        import ssl

        return {"ssl": ssl.create_default_context(cafile=settings.DB_SSL_CA)}
    return {}


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=_connect_args(),
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
