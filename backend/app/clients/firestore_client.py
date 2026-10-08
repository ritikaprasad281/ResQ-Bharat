"""Firestore client helpers."""

from __future__ import annotations

from typing import Any

from google.cloud import firestore

from app.config import settings

_db: firestore.Client | None = None


def db() -> firestore.Client:
    global _db
    if _db is None:
        _db = firestore.Client(project=settings.gcp_project)
    return _db


def set_doc(path: str, data: dict[str, Any]) -> None:
    """Write a document. Path is 'collection/doc' or nested 'a/b/c/d'."""
    db().document(path).set(data, merge=True)


def get_doc(path: str) -> dict[str, Any] | None:
    snap = db().document(path).get()
    return snap.to_dict() if snap.exists else None
