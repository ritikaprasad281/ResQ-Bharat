"""Validation of predicted flood-prone zones against an observed flood event.

Compares the static flood-prone mask against the actual Sentinel-1 water extent
during a known flood window and reports precision, recall and IoU — the headline
confidence evidence for the project.
"""

from __future__ import annotations

import ee

from app.basins import Aoi
from app.ee_client import ensure_ee
from app.services.flood_zones import WATER_VV_DB, compute_flood_zone_image

# Documented Ganga-basin flood windows usable for validation.
EVENTS: dict[str, dict[str, str]] = {
    "bihar_2019": {
        "label": "Bihar floods (Jul 2019)",
        "start": "2019-07-10",
        "end": "2019-07-25",
    },
    "bihar_2020": {
        "label": "North Bihar floods (Aug 2020)",
        "start": "2020-08-01",
        "end": "2020-08-20",
    },
}


def _observed_flood(region: ee.Geometry, start: str, end: str) -> ee.Image:
    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(region)
        .filterDate(start, end)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .select("VV")
    )
    water = s1.map(lambda i: i.focal_median(50, "circle", "meters").lt(WATER_VV_DB))
    observed = water.max().unmask(0)
    # Remove permanent water so we validate flood extent, not the river itself.
    jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").unmask(0)
    return observed.updateMask(jrc.lt(80)).unmask(0).rename("obs")


def validate_event(aoi: Aoi, event_id: str, min_confidence: float = 0.3) -> dict:
    ensure_ee()
    event = EVENTS.get(event_id)
    if event is None:
        raise KeyError(f"Unknown event '{event_id}'. Valid: {', '.join(EVENTS)}")

    score, region = compute_flood_zone_image(aoi)
    predicted = score.gte(min_confidence).rename("pred")
    observed = _observed_flood(region, event["start"], event["end"])

    tp = predicted.And(observed)
    fp = predicted.And(observed.Not())
    fn = predicted.Not().And(observed)

    counts = (
        ee.Image.cat(
            tp.rename("tp"), fp.rename("fp"), fn.rename("fn")
        )
        .reduceRegion(
            reducer=ee.Reducer.sum(), geometry=region, scale=90, maxPixels=1e9
        )
        .getInfo()
    )
    tp_n = counts.get("tp", 0) or 0
    fp_n = counts.get("fp", 0) or 0
    fn_n = counts.get("fn", 0) or 0

    precision = tp_n / (tp_n + fp_n) if (tp_n + fp_n) else 0.0
    recall = tp_n / (tp_n + fn_n) if (tp_n + fn_n) else 0.0
    iou = tp_n / (tp_n + fp_n + fn_n) if (tp_n + fp_n + fn_n) else 0.0

    return {
        "aoi": aoi.id,
        "event": event_id,
        "event_label": event["label"],
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "iou": round(iou, 3),
        "pixels": {"tp": tp_n, "fp": fp_n, "fn": fn_n},
    }
