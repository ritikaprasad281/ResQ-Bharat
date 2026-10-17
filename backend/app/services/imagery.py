"""Before/after satellite imagery for the Floodplain Development workspace.

Returns real Sentinel-2 (harmonized TOA) true-colour median composites for the
same two observation windows used by the construction change-detection
(``new_construction``), so the imagery the user compares matches the analysis.

Each composite is rendered once in Earth Engine, stored as a PNG in Cloud
Storage, and served from a stable public URL cached in Firestore — so repeat
loads skip the (slow) Earth Engine recompute and never hit an expired thumbnail
URL. If a window has no usable scenes, that side is returned as ``None`` so the
UI can show an honest "imagery unavailable" state instead of a broken image.
"""

from __future__ import annotations

from datetime import datetime, timezone

import ee
import httpx

from app.basins import Aoi
from app.clients import firestore_client as fs
from app.clients import storage_client as gcs
from app.ee_client import ensure_ee
from app.services.new_construction import (
    BASELINE_RANGE,
    RECENT_RANGE,
    _analysis_region,
)

# Sentinel-2 harmonized Level-1C (TOA) — available from mid-2015, so both the
# ~2016 baseline and the 2026 window are covered by the SAME sensor/collection,
# keeping the two composites comparable.
_S2 = "COPERNICUS/S2_HARMONIZED"
_RGB = ["B4", "B3", "B2"]
_VIS = {"bands": _RGB, "min": 0, "max": 3000}
_CLOUD_PCT = 40.0

_CACHE_PATH = "pilots/{aoi}/cache/imagery"
_THUMB_TIMEOUT = 60.0

_LABELS = {
    "baseline": "Nov 2015 – Jun 2016",
    "recent": "Jan 2026 – May 2026",
}


def _composite_url(region: ee.Geometry, start: str, end: str) -> dict | None:
    base = (
        ee.ImageCollection(_S2)
        .filterBounds(region)
        .filterDate(start, end)
        .select(_RGB)
    )
    filtered = base.filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", _CLOUD_PCT))
    n = filtered.size().getInfo()
    relaxed = False
    if not n:
        # Fall back to all scenes (early Sentinel-2 coverage can be sparse).
        filtered = base
        n = filtered.size().getInfo()
        relaxed = True
    if not n:
        return None

    composite = filtered.median().clip(region)
    url = composite.visualize(**_VIS).getThumbURL(
        {"region": region, "dimensions": 640, "format": "png", "crs": "EPSG:4326"}
    )
    return {"url": url, "scenes": int(n), "cloud_filtered": not relaxed}


def _persist_side(meta: dict | None, aoi_id: str, key: str) -> dict | None:
    """Download the one-time EE thumbnail and store a stable PNG in Cloud
    Storage. On any failure, fall back to the (time-limited) EE URL rather than
    failing the whole page."""
    if meta is None:
        return None
    try:
        resp = httpx.get(meta["url"], timeout=_THUMB_TIMEOUT)
        resp.raise_for_status()
        stable_url = gcs.upload_png(f"imagery/{aoi_id}/{key}.png", resp.content)
        return {**meta, "url": stable_url, "stored": True}
    except Exception:
        return {**meta, "stored": False}


def compute_imagery(aoi: Aoi, refresh: bool = False) -> dict:
    if not refresh:
        try:
            cached = fs.get_doc(_CACHE_PATH.format(aoi=aoi.id))
        except Exception:
            cached = None
        if cached and cached.get("stored"):
            return cached

    ensure_ee()
    region = _analysis_region(aoi)
    coords = region.bounds().coordinates().getInfo()[0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    bbox = [min(lons), min(lats), max(lons), max(lats)]

    baseline = _persist_side(_composite_url(region, *BASELINE_RANGE), aoi.id, "baseline")
    recent = _persist_side(_composite_url(region, *RECENT_RANGE), aoi.id, "recent")

    def _side(meta: dict | None, key: str) -> dict:
        return {
            "label": _LABELS[key],
            "available": meta is not None,
            "url": meta["url"] if meta else None,
            "scenes": meta["scenes"] if meta else 0,
            "cloud_filtered": meta["cloud_filtered"] if meta else False,
        }

    # Cache only when nothing failed to upload, so a transient storage error
    # retries next time instead of persisting expiring EE URLs.
    upload_failed = any(
        m is not None and not m.get("stored") for m in (baseline, recent)
    )
    result = {
        "aoi": aoi.id,
        "name": aoi.name,
        "region_bbox": bbox,
        "source": "Copernicus Sentinel-2 (harmonized TOA) via Google Earth Engine, served from Cloud Storage",
        "method": (
            "Per-window median true-colour (B4/B3/B2) composite at 10 m, "
            f"scenes with <{int(_CLOUD_PCT)}% cloud preferred."
        ),
        "baseline": _side(baseline, "baseline"),
        "recent": _side(recent, "recent"),
        "stored": not upload_failed,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }
    if not upload_failed:
        try:
            fs.set_doc(_CACHE_PATH.format(aoi=aoi.id), result)
        except Exception:
            pass
    return result

