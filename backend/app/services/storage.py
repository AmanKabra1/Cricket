"""Object storage for images (team logos, player photos, match images).

S3-compatible: AWS S3 in production, MinIO locally. boto3 is synchronous, so
uploads run in a threadpool to avoid blocking the event loop. The client is
created lazily so the app boots even when storage isn't configured/reachable.
"""
from __future__ import annotations

import logging
import os
import uuid

from starlette.concurrency import run_in_threadpool

from app.core.config import settings

logger = logging.getLogger("localscore.storage")

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB

_client = None


def _get_client():
    global _client
    if _client is None:
        import boto3  # noqa: PLC0415

        _client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
        )
    return _client


class StorageError(RuntimeError):
    pass


def _public_url(key: str) -> str:
    # S3_PUBLIC_URL is the bucket's public root. For Cloudflare R2 that's the
    # bucket-scoped r2.dev URL (or a custom domain) — the object is at
    # "<public>/<key>", no bucket segment. For path-style hosts (AWS/MinIO),
    # set S3_PUBLIC_URL to include the bucket, e.g. ".../my-bucket".
    base = settings.S3_PUBLIC_URL.rstrip("/")
    return f"{base}/{key}"


def _key_from_url(url: str) -> str | None:
    """Recover the storage key from a public image URL (local or S3/R2)."""
    if "/media/" in url:
        return url.split("/media/", 1)[1]
    base = settings.S3_PUBLIC_URL.rstrip("/") + "/"
    if url.startswith(base):
        return url[len(base):]
    return None


async def delete_image(url: str | None) -> None:
    """Best-effort delete of a stored image by its public URL. Never raises —
    cleaning up orphaned files must not block deleting the owning record."""
    if not url:
        return
    key = _key_from_url(url)
    if not key:
        return
    try:
        if settings.STORAGE_BACKEND.lower() != "s3":
            path = os.path.join(settings.UPLOAD_DIR, key)

            def _rm() -> None:
                if os.path.exists(path):
                    os.remove(path)

            await run_in_threadpool(_rm)
        else:
            await run_in_threadpool(
                lambda: _get_client().delete_object(Bucket=settings.S3_BUCKET, Key=key)
            )
    except Exception:  # noqa: BLE001
        logger.info("image cleanup skipped for %s", url)


def _save_local(key: str, data: bytes) -> None:
    path = os.path.join(settings.UPLOAD_DIR, key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


async def upload_image(data: bytes, content_type: str, category: str, base_url: str = "") -> str:
    """Validate and store an image; return its public URL.

    Uses the local filesystem (served from /media) unless STORAGE_BACKEND="s3".
    `base_url` is the request's origin, used to build an absolute URL for the
    local backend so mobile/web can load the image from anywhere.
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise StorageError(f"Unsupported content type: {content_type}")
    if len(data) > MAX_BYTES:
        raise StorageError("File exceeds the 5 MB limit")

    ext = ALLOWED_CONTENT_TYPES[content_type]
    key = f"{category}/{uuid.uuid4().hex}{ext}"

    if settings.STORAGE_BACKEND.lower() != "s3":
        try:
            await run_in_threadpool(_save_local, key, data)
        except Exception as exc:  # noqa: BLE001
            logger.exception("local upload failed")
            raise StorageError("Failed to store file") from exc
        prefix = base_url.rstrip("/")
        return f"{prefix}/media/{key}" if prefix else f"/media/{key}"

    def _put() -> None:
        _get_client().put_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    try:
        await run_in_threadpool(_put)
    except Exception as exc:  # noqa: BLE001
        logger.exception("upload failed")
        raise StorageError("Failed to store file") from exc

    return _public_url(key)
