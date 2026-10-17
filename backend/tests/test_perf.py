"""Correctness + performance-safety tests for the risk pipeline.

These guard the optimizations made for end-to-end speed so that making the app
faster can never silently change a risk number. They monkeypatch the two slow
dependencies (Open-Meteo rainfall and Earth Engine susceptibility) with
deterministic stand-ins, so they run fast and offline. Run with ``pytest`` or
standalone: ``python -m tests.test_perf``.
"""

from __future__ import annotations

import threading
import time

from app.basins import PILOTS, get_aoi
from app.services import live_risk
from app.ttl_cache import TTLCache


# --- risk score: exact weighting must be preserved ------------------------

def _patch_rain(monkeypatch_targets, antecedent_mm, forecast_mm):
    rain = {
        "antecedent_3d_mm": antecedent_mm,
        "forecast_7d_mm": forecast_mm,
        "fetched_at": "2024-01-01T00:00:00+00:00",
        "forecast_complete": True,
        "antecedent_complete": True,
        "days_available": 10,
        "days_expected": 10,
    }
    live_risk._rainfall_cache._store.clear()
    monkeypatch_targets["_rainfall"] = live_risk._rainfall
    live_risk._rainfall = lambda lat, lon: rain  # type: ignore[assignment]


def test_risk_formula_matches_spec() -> None:
    """risk = 0.35*susc + 0.65*(0.4*ant + 0.6*fcst), saturations 150/250."""
    saved = {}
    _patch_rain(saved, antecedent_mm=75.0, forecast_mm=125.0)
    saved_susc = live_risk.susceptibility_for
    live_risk.susceptibility_for = lambda aoi: 0.5  # type: ignore[assignment]
    try:
        aoi = get_aoi(next(iter(PILOTS)))
        out = live_risk.compute_live_risk(aoi)
        antecedent = 75.0 / 150.0  # 0.5
        forecast = 125.0 / 250.0  # 0.5
        pressure = 0.4 * antecedent + 0.6 * forecast  # 0.5
        expected = round(0.35 * 0.5 + 0.65 * pressure, 3)  # 0.5
        assert out["probability"] == expected
        assert out["level"] == live_risk._level(expected)
    finally:
        live_risk._rainfall = saved["_rainfall"]
        live_risk.susceptibility_for = saved_susc


def test_risk_saturates_at_one() -> None:
    saved = {}
    _patch_rain(saved, antecedent_mm=9999.0, forecast_mm=9999.0)
    saved_susc = live_risk.susceptibility_for
    live_risk.susceptibility_for = lambda aoi: 1.0  # type: ignore[assignment]
    try:
        out = live_risk.compute_live_risk(get_aoi(next(iter(PILOTS))))
        assert out["probability"] == 1.0
        assert out["level"] == "severe"
    finally:
        live_risk._rainfall = saved["_rainfall"]
        live_risk.susceptibility_for = saved_susc


# --- ranking: order + Top-N + partial-results policy ----------------------

def test_ranking_orders_desc_and_reports_coverage() -> None:
    saved_rain = live_risk._rainfall
    saved_susc = live_risk.susceptibility_for
    # Deterministic per-AOI score via susceptibility; rainfall held at zero.
    ids = list(PILOTS.keys())
    scores = {pid: (i % 10) / 10.0 for i, pid in enumerate(ids)}
    live_risk._rainfall = lambda lat, lon: {  # type: ignore[assignment]
        "antecedent_3d_mm": 0.0, "forecast_7d_mm": 0.0,
        "fetched_at": "t", "forecast_complete": True,
        "antecedent_complete": True, "days_available": 10, "days_expected": 10,
    }

    def susc(aoi):
        return scores[aoi.id]

    live_risk.susceptibility_for = susc  # type: ignore[assignment]
    try:
        ranking = live_risk.rank_live_risk(limit=6)
        probs = [r["probability"] for r in ranking["all"]]
        assert probs == sorted(probs, reverse=True), "ranking must be descending"
        assert len(ranking["top"]) == 6
        assert ranking["top"] == ranking["all"][:6]
        assert ranking["assessed"] == len(PILOTS)
        assert ranking["total"] == len(PILOTS)
    finally:
        live_risk._rainfall = saved_rain
        live_risk.susceptibility_for = saved_susc


def test_ranking_skips_failures_never_zeroes_them() -> None:
    saved_rain = live_risk._rainfall
    saved_susc = live_risk.susceptibility_for
    bad = set(list(PILOTS.keys())[:5])

    def susc(aoi):
        if aoi.id in bad:
            raise RuntimeError("upstream down")
        return 0.4

    live_risk._rainfall = lambda lat, lon: {  # type: ignore[assignment]
        "antecedent_3d_mm": 0.0, "forecast_7d_mm": 0.0, "fetched_at": "t",
        "forecast_complete": True, "antecedent_complete": True,
        "days_available": 10, "days_expected": 10,
    }
    live_risk.susceptibility_for = susc  # type: ignore[assignment]
    try:
        ranking = live_risk.rank_live_risk(limit=6)
        assert ranking["assessed"] == len(PILOTS) - len(bad)
        assert ranking["total"] == len(PILOTS)
        # Failed AOIs are absent, NOT present with probability 0.
        present = {r["id"] for r in ranking["all"]}
        assert present.isdisjoint(bad)
    finally:
        live_risk._rainfall = saved_rain
        live_risk.susceptibility_for = saved_susc


# --- TTL cache: freshness, expiry, dedup ----------------------------------

def test_ttl_cache_expires() -> None:
    cache = TTLCache()
    cache.set("k", 1)
    assert cache.get("k", ttl=10) == 1
    assert cache.get("k", ttl=-1) is None  # already stale


def test_ttl_cache_dedups_producer() -> None:
    cache = TTLCache()
    calls = {"n": 0}

    def producer():
        calls["n"] += 1
        return "v"

    assert cache.get_or_set("k", ttl=10, producer=producer) == "v"
    assert cache.get_or_set("k", ttl=10, producer=producer) == "v"
    assert calls["n"] == 1, "second hit must not call the producer again"


def test_rainfall_memo_avoids_duplicate_fetches() -> None:
    saved_fetch = live_risk._rainfall_fetch
    live_risk._rainfall_cache._store.clear()
    calls = {"n": 0}

    def fake_fetch(lat, lon):
        calls["n"] += 1
        return {"antecedent_3d_mm": 1.0, "forecast_7d_mm": 1.0, "fetched_at": "t",
                "forecast_complete": True, "antecedent_complete": True,
                "days_available": 10, "days_expected": 10}

    live_risk._rainfall_fetch = fake_fetch  # type: ignore[assignment]
    try:
        a = live_risk._rainfall(25.0, 85.0)
        b = live_risk._rainfall(25.0, 85.0)
        assert a is b
        assert calls["n"] == 1, "same coords must hit the memo, not refetch"
    finally:
        live_risk._rainfall_fetch = saved_fetch
        live_risk._rainfall_cache._store.clear()


if __name__ == "__main__":
    import sys

    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except Exception as exc:  # noqa: BLE001
                failures += 1
                print(f"FAIL {name}: {exc}")
    sys.exit(1 if failures else 0)
