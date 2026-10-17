"""Firestore client helpers."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
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


def get_docs(paths: list[str], max_workers: int = 16) -> dict[str, dict[str, Any] | None]:
    """Read many documents concurrently. Returns {path: doc_or_None}.

    Firestore reads are I/O-bound, so a bounded thread pool turns N sequential
    round-trips into a few batches. Individual failures degrade to None rather
    than failing the whole batch.
    """
    if not paths:
        return {}

    def _one(path: str) -> tuple[str, dict[str, Any] | None]:
        try:
            return path, get_doc(path)
        except Exception:
            return path, None

    workers = min(max_workers, len(paths))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return dict(pool.map(_one, paths))


def add_doc(collection: str, data: dict[str, Any]) -> str:
    """Add a document with an auto-generated id; returns the new id."""
    ref = db().collection(collection).document()
    ref.set(data)
    return ref.id


def query_collection(
    collection: str, order_by: str | None = None, limit: int = 50
) -> list[dict[str, Any]]:
    """Return documents from a collection (newest first when order_by set)."""
    query = db().collection(collection)
    if order_by:
        query = query.order_by(order_by, direction=firestore.Query.DESCENDING)
    query = query.limit(limit)
    out: list[dict[str, Any]] = []
    for snap in query.stream():
        doc = snap.to_dict() or {}
        doc["id"] = snap.id
        out.append(doc)
    return out
