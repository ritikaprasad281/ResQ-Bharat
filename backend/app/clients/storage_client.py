"""Cloud Storage client — serves pre-rendered satellite imagery.

Earth Engine thumbnail URLs are expensive to regenerate and expire quickly. We
render each before/after composite once, store the PNG in a bucket, and serve a
stable public URL so repeat Floodplain Development loads skip Earth Engine.
"""

from __future__ import annotations

from functools import lru_cache

from google.cloud import storage

from app.config import settings


@lru_cache(maxsize=1)
def _client() -> storage.Client:
    return storage.Client(project=settings.gcp_project)


def _bucket():
    return _client().bucket(settings.imagery_bucket)


def public_url(object_path: str) -> str:
    return f"https://storage.googleapis.com/{settings.imagery_bucket}/{object_path}"


def upload_png(object_path: str, data: bytes) -> str:
    """Upload PNG bytes and return the stable public URL."""
    blob = _bucket().blob(object_path)
    blob.cache_control = "public, max-age=86400"
    blob.upload_from_string(data, content_type="image/png")
    return public_url(object_path)
