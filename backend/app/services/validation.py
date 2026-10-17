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

# Documented flood windows usable for validation. The observed extent is pulled
# from Sentinel-1 SAR for the window, so each entry is an observation window —
# metrics are computed from real satellite data, not a hand-drawn extent.
#
# All windows are post-October 2014 (the Sentinel-1 era) and correspond to
# well-documented major Indian flood events. They let us validate the modelled
# flood-prone mask against observed SAR water extent basin-by-basin, which is
# the only honest way to promote an area from "modelled" to "live".
EVENTS: dict[str, dict[str, str]] = {
    # ---- North & east (Ganga / Brahmaputra core) ----
    "assam_2026": {
        "label": "Assam floods (monsoon 2026)",
        "start": "2026-06-15",
        "end": "2026-08-15",
    },
    "assam_2022": {
        "label": "Assam & Barak Valley floods (Jun 2022)",
        "start": "2022-06-15",
        "end": "2022-07-05",
    },
    "bihar_2026": {
        "label": "Bihar floods (Aug–Sep 2026)",
        "start": "2026-08-01",
        "end": "2026-09-20",
    },
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
    "delhi_2023": {
        "label": "Yamuna floods, Delhi (Jul 2023)",
        "start": "2023-07-09",
        "end": "2023-07-22",
    },
    "punjab_2023": {
        "label": "Punjab & Himachal floods, Sutlej/Beas (Jul 2023)",
        "start": "2023-07-08",
        "end": "2023-07-20",
    },
    # ---- West ----
    "maharashtra_2021": {
        "label": "Konkan & W. Maharashtra floods (Jul 2021)",
        "start": "2021-07-20",
        "end": "2021-07-31",
    },
    "maharashtra_2019": {
        "label": "Kolhapur–Sangli floods (Aug 2019)",
        "start": "2019-08-01",
        "end": "2019-08-15",
    },
    "gujarat_2017": {
        "label": "Gujarat floods, Banaskantha/Ahmedabad (Jul 2017)",
        "start": "2017-07-20",
        "end": "2017-08-05",
    },
    "gujarat_2024": {
        "label": "Gujarat floods, Vadodara/Saurashtra (Aug 2024)",
        "start": "2024-08-24",
        "end": "2024-09-05",
    },
    "goa_2021": {
        "label": "Goa floods (Jul 2021)",
        "start": "2021-07-22",
        "end": "2021-07-30",
    },
    # ---- Central ----
    "mp_2022": {
        "label": "Madhya Pradesh floods (Aug 2022)",
        "start": "2022-08-20",
        "end": "2022-09-05",
    },
    "mp_2019": {
        "label": "Narmada valley floods, M.P. (Sep 2019)",
        "start": "2019-09-08",
        "end": "2019-09-20",
    },
    "rajasthan_2024": {
        "label": "E. Rajasthan floods, Chambal (Aug 2024)",
        "start": "2024-08-01",
        "end": "2024-08-20",
    },
    # ---- South ----
    "kerala_2018": {
        "label": "Kerala floods (Aug 2018)",
        "start": "2018-08-08",
        "end": "2018-08-25",
    },
    "kerala_2019": {
        "label": "Kerala floods (Aug 2019)",
        "start": "2019-08-08",
        "end": "2019-08-20",
    },
    "tn_chennai_2021": {
        "label": "Tamil Nadu NE-monsoon floods (Nov 2021)",
        "start": "2021-11-06",
        "end": "2021-11-30",
    },
    "tn_michaung_2023": {
        "label": "Cyclone Michaung floods, Tamil Nadu (Dec 2023)",
        "start": "2023-12-03",
        "end": "2023-12-18",
    },
    "karnataka_2019": {
        "label": "North Karnataka floods (Aug 2019)",
        "start": "2019-08-05",
        "end": "2019-08-20",
    },
    "krishna_2019": {
        "label": "Krishna basin floods (Aug 2019)",
        "start": "2019-08-01",
        "end": "2019-08-20",
    },
    "godavari_2022": {
        "label": "Godavari floods, Bhadrachalam (Jul 2022)",
        "start": "2022-07-10",
        "end": "2022-07-25",
    },
    "telangana_2020": {
        "label": "Hyderabad & Telangana floods (Oct 2020)",
        "start": "2020-10-11",
        "end": "2020-10-25",
    },
    "bengaluru_2022": {
        "label": "Bengaluru urban floods (Sep 2022)",
        "start": "2022-08-30",
        "end": "2022-09-12",
    },
    # ---- East ----
    "odisha_2022": {
        "label": "Mahanadi floods, Odisha (Aug 2022)",
        "start": "2022-08-12",
        "end": "2022-08-25",
    },
    "wb_2021": {
        "label": "South Bengal floods (Aug 2021)",
        "start": "2021-07-30",
        "end": "2021-08-10",
    },
    "sikkim_teesta_2023": {
        "label": "Teesta GLOF floods, Sikkim/N. Bengal (Oct 2023)",
        "start": "2023-10-04",
        "end": "2023-10-14",
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
