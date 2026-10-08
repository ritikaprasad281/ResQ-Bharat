"""Earth Engine initialization. Uses Application Default Credentials locally
and the attached service account on Cloud Run."""

import ee

from app.config import settings

_initialized = False


def init_ee() -> None:
    global _initialized
    if _initialized:
        return
    ee.Initialize(project=settings.gcp_project)
    _initialized = True


def ensure_ee() -> None:
    if not _initialized:
        init_ee()
