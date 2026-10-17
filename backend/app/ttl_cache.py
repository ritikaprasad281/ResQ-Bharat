"""Tiny thread-safe in-process TTL cache (per Cloud Run instance).

Deduplicates expensive upstream calls (e.g. rainfall) and accelerates hot
shared results. Firestore remains the cross-instance source of truth; this is a
per-instance acceleration layer with short TTLs so staleness stays bounded and
observable (callers still surface the real upstream `fetched_at`).
"""

from __future__ import annotations

import threading
import time
from typing import Any, Callable


class TTLCache:
    def __init__(self) -> None:
        self._store: dict[Any, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: Any, ttl: float) -> Any | None:
        now = time.time()
        with self._lock:
            hit = self._store.get(key)
            if hit is not None and now - hit[0] < ttl:
                return hit[1]
        return None

    def set(self, key: Any, value: Any) -> None:
        with self._lock:
            self._store[key] = (time.time(), value)

    def get_or_set(self, key: Any, ttl: float, producer: Callable[[], Any]) -> Any:
        """Return a fresh cached value or produce, store and return a new one.

        The producer runs outside the lock, so distinct keys never serialise and
        two concurrent misses for the same (idempotent) key at worst both fetch.
        """
        cached = self.get(key, ttl)
        if cached is not None:
            return cached
        value = producer()
        self.set(key, value)
        return value
