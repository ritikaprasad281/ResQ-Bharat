"""Live flood risk scoring.

Blends live/forecast rainfall (Open-Meteo) with antecedent wetness and the
static flood susceptibility of the area (from Earth Engine) into a calibrated
0-1 risk score. This is a transparent early-warning score, not a guaranteed
forecast (see docs/ganga-flood-approach.md).
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import httpx
import ee

from app.basins import Aoi
from app.clients import firestore_client as fs
from app.ee_client import ensure_ee
from app.services.flood_zones import compute_flood_zone_image
from app.ttl_cache import TTLCache

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Open-Meteo refreshes roughly hourly; a short in-process memo dedups the many
# callers that need the same location's rainfall within a page load (/risk,
# /forecast, the full ranking, repeated dashboard loads) without masking real
# freshness — the cached payload keeps its true upstream `fetched_at`.
_RAINFALL_TTL_SEC = 600.0
_rainfall_cache = TTLCache()

# Rainfall (mm) that saturates each sub-score.
ANTECEDENT_SATURATION = 150.0
FORECAST_SATURATION = 250.0

# Weights used by the transparent live-risk blend. Kept here so the API can
# expose them verbatim to the UI methodology panel (single source of truth).
SUSCEPTIBILITY_WEIGHT = 0.35
RAINFALL_WEIGHT = 0.65

# Provenance surfaced alongside every risk metric so the UI can show what each
# layer actually is (and is not). Temporal ranges reflect the real datasets.
RISK_SOURCES = [
    {
        "name": "Open-Meteo rainfall",
        "kind": "forecast",
        "temporal": "3-day observed + 7-day forecast, fetched on request",
        "url": "https://open-meteo.com/",
    },
    {
        "name": "JRC Global Surface Water v1.4 (occurrence)",
        "kind": "historical",
        "temporal": "1984\u20132021",
        "url": "https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater",
    },
    {
        "name": "Copernicus Sentinel-1 SAR flood frequency",
        "kind": "observed",
        "temporal": "monsoon scenes 2019\u20132024",
        "url": "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD",
    },
    {
        "name": "SRTM 30 m elevation",
        "kind": "static",
        "temporal": "2000 survey",
        "url": "https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003",
    },
]

RISK_METHODOLOGY = {
    "formula": "risk = 0.35 \u00d7 susceptibility + 0.65 \u00d7 rainfall_pressure",
    "rainfall_pressure": (
        "0.4 \u00d7 antecedent(3-day) + 0.6 \u00d7 forecast(7-day), each "
        "normalised to a saturating 0\u20131 scale"
    ),
    "weights": {
        "susceptibility": SUSCEPTIBILITY_WEIGHT,
        "rainfall_pressure": RAINFALL_WEIGHT,
    },
    "normalization": {
        "antecedent_saturation_mm": ANTECEDENT_SATURATION,
        "forecast_saturation_mm": FORECAST_SATURATION,
    },
    "note": (
        "A transparent, relative early-warning index on a 0\u20131 scale \u2014 "
        "not a calibrated flood probability or an official forecast. "
        "Susceptibility is terrain/history-derived (static); rainfall pressure "
        "reflects current conditions."
    ),
}


def _rainfall(lat: float, lon: float) -> dict:
    """Memoized rainfall for a location (exact coords are a safe cache key: the
    same point always yields the same upstream response)."""
    key = ("daily", round(lat, 4), round(lon, 4))
    return _rainfall_cache.get_or_set(
        key, _RAINFALL_TTL_SEC, lambda: _rainfall_fetch(lat, lon)
    )


def _rainfall_fetch(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum",
        "past_days": 3,
        "forecast_days": 7,
        "timezone": "auto",
    }
    # Open-Meteo occasionally returns a transient 5xx; retry a few times.
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            with httpx.Client(timeout=20) as client:
                resp = client.get(OPEN_METEO_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
            break
        except httpx.HTTPError as exc:
            last_exc = exc
            if attempt == 2:
                raise
            time.sleep(1.0 * (attempt + 1))
    daily = data.get("daily", {})
    dates = daily.get("time", [])
    raw = daily.get("precipitation_sum", []) or []
    # Track which days actually carry a value so missing data is flagged rather
    # than silently treated as zero rainfall (which would understate risk).
    present = [p is not None for p in raw]
    precip = [float(p) if p is not None else 0.0 for p in raw]
    # First 3 entries are past days; remainder is the forecast.
    past, past_present = precip[:3], present[:3]
    forecast, forecast_present = precip[3:], present[3:]
    return {
        "dates": dates,
        "daily_mm": precip,
        "antecedent_3d_mm": round(sum(past), 1),
        "forecast_3d_mm": round(sum(forecast[:3]), 1),
        "forecast_7d_mm": round(sum(forecast), 1),
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "antecedent_complete": len(past_present) == 3 and all(past_present),
        "forecast_complete": bool(forecast_present) and all(forecast_present),
        "days_available": sum(present),
        "days_expected": 10,
    }


def _static_susceptibility(aoi: Aoi) -> float:
    ensure_ee()
    score, region = compute_flood_zone_image(aoi)
    mean = score.reduceRegion(
        reducer=ee.Reducer.mean(), geometry=region, scale=250, maxPixels=1e9
    ).get("confidence")
    val = ee.Number(mean).getInfo()
    return float(val) if val is not None else 0.0


def susceptibility_for(aoi: Aoi) -> float:
    """Static susceptibility is terrain-driven and effectively constant, so we
    cache it per pilot in Firestore. This keeps the live-risk and top-risk
    endpoints fast after the first warm-up (only rainfall is fetched live)."""
    path = f"pilots/{aoi.id}/cache/susceptibility"
    try:
        cached = fs.get_doc(path)
        if cached and "value" in cached:
            return float(cached["value"])
    except Exception:
        pass
    val = _static_susceptibility(aoi)
    try:
        fs.set_doc(path, {"value": val})
    except Exception:
        pass
    return val


def _level(score: float) -> str:
    if score >= 0.75:
        return "severe"
    if score >= 0.5:
        return "high"
    if score >= 0.25:
        return "medium"
    return "low"


def compute_live_risk(aoi: Aoi) -> dict:
    lon, lat = aoi.center
    rain = _rainfall(lat, lon)
    susceptibility = susceptibility_for(aoi)

    antecedent = min(rain["antecedent_3d_mm"] / ANTECEDENT_SATURATION, 1.0)
    forecast = min(rain["forecast_7d_mm"] / FORECAST_SATURATION, 1.0)

    # Rainfall only becomes dangerous where the land is susceptible.
    rainfall_pressure = 0.4 * antecedent + 0.6 * forecast
    risk = round(
        SUSCEPTIBILITY_WEIGHT * susceptibility + RAINFALL_WEIGHT * rainfall_pressure,
        3,
    )
    risk = max(0.0, min(risk, 1.0))

    rainfall_complete = bool(
        rain.get("forecast_complete", True) and rain.get("antecedent_complete", True)
    )

    return {
        "aoi": aoi.id,
        "probability": risk,
        "level": _level(risk),
        "susceptibility": round(susceptibility, 3),
        "rainfall": rain,
        "model": "transparent-weighted-v1",
        "updated_at": rain.get("fetched_at"),
        "sources": RISK_SOURCES,
        "methodology": RISK_METHODOLOGY,
        "data_quality": {
            "rainfall_complete": rainfall_complete,
            "days_available": rain.get("days_available"),
            "days_expected": rain.get("days_expected"),
        },
    }


def rank_live_risk(limit: int = 3) -> dict:
    """Compute live risk across every pilot and return them ranked, highest
    first. Susceptibility is cached and rainfall is memoized, so this pays only
    the (bounded-parallel) rainfall cost per pilot after warm-up.

    Locations are assessed concurrently; any that fail are skipped and reported
    via `assessed`/`total` (an explicit partial-results policy — a failed
    location is never treated as zero risk)."""
    from app.basins import PILOTS

    items = list(PILOTS.items())

    def _assess(entry: tuple[str, Aoi]) -> dict | None:
        pilot_id, aoi = entry
        try:
            r = compute_live_risk(aoi)
        except Exception:
            return None
        return {
            "id": pilot_id,
            "name": aoi.name,
            "tributary": aoi.tributary,
            "center": list(aoi.center),
            "bbox": list(aoi.bbox),
            "probability": r["probability"],
            "level": r["level"],
            "forecast_7d_mm": r["rainfall"]["forecast_7d_mm"],
            "antecedent_3d_mm": r["rainfall"]["antecedent_3d_mm"],
        }

    # Bounded parallelism: rainfall is network I/O, so a small pool collapses
    # ~100 sequential upstream calls into a few batches while respecting the
    # upstream API. 12 keeps us well under Open-Meteo's fair-use limits.
    workers = min(12, max(1, len(items)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(_assess, items))

    ranked = [r for r in results if r is not None]
    ranked.sort(key=lambda x: x["probability"], reverse=True)
    return {
        "top": ranked[:limit],
        "all": ranked,
        "assessed": len(ranked),
        "total": len(items),
    }
