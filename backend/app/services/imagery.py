"""Before/after satellite imagery for the Floodplain Development workspace.

Returns real Sentinel-2 (harmonized TOA) true-colour median composites for the
same two observation windows used by the construction change-detection
(``new_construction``), so the imagery the user compares matches the analysis.

The imagery is served as Earth Engine thumbnail URLs (not cached, because those
URLs are time-limited). If a window has no usable scenes, that side is returned
as ``None`` so the UI can show an honest "imagery unavailable" state instead of
a broken image.
"""

from __future__ import annotations

import ee

from app.basins import Aoi
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


def compute_imagery(aoi: Aoi) -> dict:
    ensure_ee()
    region = _analysis_region(aoi)
    coords = region.bounds().coordinates().getInfo()[0]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    bbox = [min(lons), min(lats), max(lons), max(lats)]

    baseline = _composite_url(region, *BASELINE_RANGE)
    recent = _composite_url(region, *RECENT_RANGE)

    def _side(meta: dict | None, key: str) -> dict:
        return {
            "label": _LABELS[key],
            "available": meta is not None,
            "url": meta["url"] if meta else None,
            "scenes": meta["scenes"] if meta else 0,
            "cloud_filtered": meta["cloud_filtered"] if meta else False,
        }

    return {
        "aoi": aoi.id,
        "name": aoi.name,
        "region_bbox": bbox,
        "source": "Copernicus Sentinel-2 (harmonized TOA) via Google Earth Engine",
        "method": (
            "Per-window median true-colour (B4/B3/B2) composite at 10 m, "
            f"scenes with <{int(_CLOUD_PCT)}% cloud preferred."
        ),
        "baseline": _side(baseline, "baseline"),
        "recent": _side(recent, "recent"),
    }
