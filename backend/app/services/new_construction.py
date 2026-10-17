"""Multi-signal construction-change detection in the river corridor.

ALGORITHM v2 (multi-signal). The original v1 used a *single* Dynamic World
"built"-probability delta with tight thresholds. Dynamic World systematically
under-scores Indian semi-urban land and scores construction-in-progress (bare
earth) as "bare" rather than "built", so genuine, visible development fell below
the v1 cut-offs and was discarded — producing almost no detections even where
the before/after imagery clearly shows new settlement.

v2 combines three independent, complementary signals so spectral evidence that
Dynamic World misses is still captured, then classifies each candidate by how
many signals agree (a transparent confidence level — NOT a calibrated
probability):

  1. Dynamic World built-probability increase   (10 m, Sentinel-2 derived)
  2. NDBI increase  (built-up index up — new hard surfaces)   (Sentinel-2 10 m)
  3. NDVI decrease  (vegetation cleared for construction)      (Sentinel-2 10 m)

Water, permanent/seasonal river channel and river sandbars are excluded (NDWI +
JRC occurrence) so water-level changes and bars are not mistaken for building.
Candidates are kept across a wide 1.5 km corridor and each is tagged with its
geodesic distance to the actual (JRC-traced) river channel and whether it falls
inside the HAND-based flood corridor, so the UI can band and filter them rather
than the detector silently clipping at a single distance.
"""

from __future__ import annotations

import math

import ee

from app.basins import Aoi
from app.ee_client import ensure_ee
from app.services.damage import AVG_FOOTPRINT_M2, COST_PER_M2_INR
from app.services.flood_zones import _river_corridor

BUILT_FOOTPRINT_FRACTION = 0.45
HOUSEHOLD_SIZE = 5.0
REPRESENTATIVE_DAMAGE_FACTOR = 0.40

BASELINE_RANGE = ("2015-11-01", "2016-06-30")  # ~10 years ago (wide for coverage)
RECENT_RANGE = ("2026-01-01", "2026-05-01")  # current

# Detect across a generous corridor; distance bands are applied in the UI.
DETECT_BUFFER_M = 1500.0
# Near-river / flood hazard corridor (tighter, elevation-aware HAND proxy).
HAZARD_BUFFER_M = 500.0

ANALYSIS_HALF_WIDTH_KM = 5.0
ANALYSIS_HALF_HEIGHT_KM = ANALYSIS_HALF_WIDTH_KM * (30.0 / 45.0)

# Tunable detection thresholds (exposed on the endpoint for calibration).
DEFAULTS = {
    "dw_delta": 0.12,  # min rise in Dynamic World built probability
    "dw_floor": 0.30,  # min recent built prob for the DW signal
    "ndbi_delta": 0.04,  # min rise in built-up index
    "ndvi_drop": 0.12,  # min fall in vegetation index
    "spectral_dw_floor": 0.15,  # weak DW presence required for a spectral-only hit
}

_VECT_SCALE = 20
_MIN_AREA_M2 = 300.0  # ~3 Sentinel-2 pixels — keep small candidates for review
_S2_BANDS = ["B2", "B3", "B4", "B8", "B11"]

# --- Explainable floodplain-change review-priority score ------------------
# A transparent 0-1 score that ranks which candidates a human should inspect
# first. Each component is normalised to 0-1 before the weighted blend, and the
# weights are published in the API so the UI can show exactly how it is formed.
# This is a REVIEW priority, NOT a calibrated probability of flooding.
PRIORITY_WEIGHTS = {
    "hazard_overlap": 0.40,   # intersects the modelled flood-hazard corridor
    "river_proximity": 0.25,  # closeness to the mapped river channel
    "confidence": 0.25,       # agreement between independent change signals
    "change_area": 0.10,      # larger changes surface sooner
}
PRIORITY_PROXIMITY_REF_M = 500.0   # at/within this distance -> full proximity
PRIORITY_AREA_REF_M2 = 10000.0     # a 1 ha change -> full area component


def _priority(props: dict) -> tuple[float, str]:
    """Normalised review-priority score and level from a candidate's features."""
    hazard = 1.0 if props.get("in_hazard") else 0.0
    dist = float(props.get("dist_river_m", 0) or 0)
    proximity = max(0.0, min(1.0, 1.0 - dist / PRIORITY_PROXIMITY_REF_M))
    confidence = (max(1, min(3, int(props.get("confidence", 1)))) - 1) / 2.0
    area_m2 = float(props.get("area_km2", 0) or 0) * 1e6
    area = max(0.0, min(1.0, area_m2 / PRIORITY_AREA_REF_M2))
    score = (
        PRIORITY_WEIGHTS["hazard_overlap"] * hazard
        + PRIORITY_WEIGHTS["river_proximity"] * proximity
        + PRIORITY_WEIGHTS["confidence"] * confidence
        + PRIORITY_WEIGHTS["change_area"] * area
    )
    score = round(score, 3)
    level = "high" if score >= 0.6 else "review" if score >= 0.35 else "lower"
    return score, level


def _analysis_region(aoi: Aoi) -> ee.Geometry:
    lon, lat = aoi.center
    d_lat = ANALYSIS_HALF_HEIGHT_KM / 111.0
    d_lon = ANALYSIS_HALF_WIDTH_KM / (111.32 * math.cos(math.radians(lat)))
    return ee.Geometry.Rectangle([lon - d_lon, lat - d_lat, lon + d_lon, lat + d_lat])


def _built_median(region: ee.Geometry, start: str, end: str) -> ee.Image:
    col = (
        ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
        .filterBounds(region)
        .filterDate(start, end)
        .select("built")
    )
    img = ee.Image(
        ee.Algorithms.If(
            col.size().gt(0), col.median(), ee.Image.constant(0).rename("built")
        )
    )
    return img.unmask(0)


def _mask_s2(img: ee.Image) -> ee.Image:
    """Mask opaque clouds and cirrus using the Sentinel-2 QA60 band."""
    qa = img.select("QA60")
    cloud = qa.bitwiseAnd(1 << 10).eq(0)
    cirrus = qa.bitwiseAnd(1 << 11).eq(0)
    return img.updateMask(cloud.And(cirrus))


def _s2_composite(region: ee.Geometry, start: str, end: str) -> ee.Image:
    """Cloud-masked Sentinel-2 median composite (reflectance 0-1), empty-safe."""
    col = (
        ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
        .filterBounds(region)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
        .map(_mask_s2)
        .select(_S2_BANDS)
    )
    img = ee.Image(
        ee.Algorithms.If(
            col.size().gt(0),
            col.median(),
            ee.Image.constant([0, 0, 0, 0, 0]).rename(_S2_BANDS),
        )
    )
    return img.divide(10000).unmask(0).clip(region)


def _indices(comp: ee.Image) -> tuple[ee.Image, ee.Image, ee.Image]:
    ndvi = comp.normalizedDifference(["B8", "B4"]).unmask(0)
    ndbi = comp.normalizedDifference(["B11", "B8"]).unmask(0)
    ndwi = comp.normalizedDifference(["B3", "B8"]).unmask(0)
    return ndvi, ndbi, ndwi


def _detect(region: ee.Geometry, t: dict) -> dict:
    """Build every intermediate layer of the detection pipeline.

    Returns a dict of ee.Images so both the vectoriser and the stage-count
    diagnostics read from exactly the same masks.
    """
    # --- Dynamic World built-probability change ---
    dw_base = _built_median(region, *BASELINE_RANGE)
    dw_recent = _built_median(region, *RECENT_RANGE)
    dw_gain = dw_recent.subtract(dw_base)

    # --- Sentinel-2 spectral change ---
    base = _s2_composite(region, *BASELINE_RANGE)
    recent = _s2_composite(region, *RECENT_RANGE)
    ndvi_b, ndbi_b, _ = _indices(base)
    ndvi_r, ndbi_r, ndwi_r = _indices(recent)
    ndbi_gain = ndbi_r.subtract(ndbi_b)
    ndvi_loss = ndvi_b.subtract(ndvi_r)

    # --- Exclude water, permanent/seasonal channel and sandbars ---
    occ = (
        ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
        .select("occurrence")
        .unmask(0)
        .clip(region)
    )
    channel = occ.gte(25)  # main/seasonal river channel
    water_now = ndwi_r.gt(0.0)
    land = water_now.Not().And(channel.Not())

    # --- Signals ---
    sig_dw = dw_gain.gte(t["dw_delta"]).And(dw_recent.gte(t["dw_floor"]))
    sig_ndbi = ndbi_gain.gte(t["ndbi_delta"])
    sig_ndvi = ndvi_loss.gte(t["ndvi_drop"])
    sig_spectral = sig_ndbi.And(sig_ndvi).And(dw_recent.gte(t["spectral_dw_floor"]))

    conf = (
        sig_dw.unmask(0)
        .add(sig_ndbi.unmask(0))
        .add(sig_ndvi.unmask(0))
        .rename("conf")
    )

    candidate_all = land.And(sig_dw.Or(sig_spectral))

    # --- Distance to the real river channel (geodesic, metres) ---
    dist = (
        channel.selfMask()
        .distance(ee.Kernel.euclidean(DETECT_BUFFER_M, "meters"), False)
        .rename("dist")
    )
    within = dist.lte(DETECT_BUFFER_M)
    candidate = candidate_all.And(within)

    # --- HAND-based flood corridor as a hazard proxy (0/1) ---
    hazard = _river_corridor(
        region, max_buffer_m=HAZARD_BUFFER_M, height_threshold_m=6.0
    ).rename("hazard")

    return {
        "candidate": candidate,
        "candidate_all": candidate_all,
        "conf": conf,
        "dist": dist,
        "hazard": hazard,
        "land": land,
        "sig_dw": sig_dw.And(land),
        "sig_spectral": sig_spectral.And(land),
    }


def _vectorize(layers: dict, region: ee.Geometry) -> dict:
    mask = (
        layers["candidate"]
        .selfMask()
        .rename("new")
        .reproject("EPSG:4326", None, _VECT_SCALE)
    )
    # Drop single isolated pixels only — do NOT morphologically erode small
    # structures (that was part of why v1 lost genuine small construction).
    clean = mask.updateMask(mask.connectedPixelCount(25, True).gte(2)).selfMask()

    stack = (
        clean.rename("new")
        .addBands(layers["conf"])
        .addBands(layers["dist"])
        .addBands(layers["hazard"])
    )
    vectors = stack.reduceToVectors(
        geometry=region,
        scale=_VECT_SCALE,
        eightConnected=True,
        maxPixels=1e9,
        geometryType="polygon",
        labelProperty="new",
        reducer=ee.Reducer.mean(),
    )
    vectors = vectors.map(
        lambda f: f.set("area_km2", f.area(maxError=10).divide(1e6))
    )
    vectors = vectors.filter(ee.Filter.gt("area_km2", _MIN_AREA_M2 / 1e6))
    vectors = vectors.map(lambda f: f.simplify(maxError=15))
    return vectors.getInfo()


def _stage_areas(layers: dict, region: ee.Geometry) -> dict:
    """Pixel-count to hectare area at each pipeline stage (one EE round-trip)."""
    px_to_ha = (_VECT_SCALE * _VECT_SCALE) / 1e4
    stage_img = ee.Image.cat(
        [
            layers["sig_dw"].unmask(0).rename("dw"),
            layers["sig_spectral"].unmask(0).rename("spectral"),
            layers["candidate_all"].unmask(0).rename("candidate"),
            layers["candidate"].unmask(0).rename("corridor"),
        ]
    )
    sums = stage_img.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=region,
        scale=_VECT_SCALE,
        maxPixels=1e9,
    ).getInfo()
    return {k: round(float(v or 0) * px_to_ha, 1) for k, v in sums.items()}


def analyze_new_construction(aoi: Aoi, thresholds: dict | None = None) -> dict:
    ensure_ee()
    t = {**DEFAULTS, **(thresholds or {})}
    region = _analysis_region(aoi)
    layers = _detect(region, t)

    geojson = _vectorize(layers, region)
    stage_ha = _stage_areas(layers, region)

    # Round the reduced per-feature properties and clamp confidence to 1..3.
    for f in geojson["features"]:
        p = f["properties"]
        conf = int(round(p.get("conf", 1) or 1))
        p["confidence"] = max(1, min(3, conf))
        p["dist_river_m"] = round(float(p.get("dist", 0) or 0), 0)
        p["in_hazard"] = bool((p.get("hazard") or 0) >= 0.5)
        score, level = _priority(p)
        p["priority"] = score
        p["priority_level"] = level
        p.pop("conf", None)
        p.pop("dist", None)
        p.pop("hazard", None)
        p.pop("new", None)

    new_built_area_m2 = (
        sum(f["properties"]["area_km2"] for f in geojson["features"]) * 1e6
    )
    footprint_area_m2 = new_built_area_m2 * BUILT_FOOTPRINT_FRACTION
    new_buildings = round(footprint_area_m2 / AVG_FOOTPRINT_M2)
    population_at_risk = round(new_buildings * HOUSEHOLD_SIZE)
    asset_value_inr = footprint_area_m2 * COST_PER_M2_INR
    expected_damage_inr = asset_value_inr * REPRESENTATIVE_DAMAGE_FACTOR

    retained_ha = round(new_built_area_m2 / 1e4, 1)
    stages = [
        {"stage": "DW built-probability increase", "area_ha": stage_ha["dw"]},
        {"stage": "Spectral settlement (NDBI up & NDVI down)", "area_ha": stage_ha["spectral"]},
        {"stage": "Combined candidates", "area_ha": stage_ha["candidate"]},
        {"stage": "Within 1.5 km river corridor", "area_ha": stage_ha["corridor"]},
        {"stage": "Retained (min-area + de-noise)", "area_ha": retained_ha},
    ]

    return {
        "aoi": aoi.id,
        "name": aoi.name,
        "period": {"baseline": "2016", "recent": "2026", "years": 10},
        "algorithm_version": "multi-signal-v2 (DW built + S2 NDBI/NDVI, HAND hazard)",
        "detection": {
            "buffer_m": DETECT_BUFFER_M,
            "scale_m": _VECT_SCALE,
            "min_area_m2": _MIN_AREA_M2,
            "source": "Sentinel-2 (10 m) + Dynamic World (10 m)",
            "thresholds": t,
        },
        "stages": stages,
        "candidate_count": len(geojson["features"]),
        "priority": {
            "weights": PRIORITY_WEIGHTS,
            "proximity_ref_m": PRIORITY_PROXIMITY_REF_M,
            "area_ref_m2": PRIORITY_AREA_REF_M2,
            "levels": {"high": ">= 0.6", "review": ">= 0.35", "lower": "< 0.35"},
            "note": (
                "Normalised review-priority (0-1): flood-hazard overlap, "
                "river proximity, change-signal agreement and change area. Ranks "
                "what to inspect first, not a probability of flooding."
            ),
        },
        "new_built_area_m2": round(new_built_area_m2, 0),
        "new_built_area_ha": retained_ha,
        "new_buildings": new_buildings,
        "population_at_risk": population_at_risk,
        "cost_per_m2_inr": COST_PER_M2_INR,
        "asset_value_inr": round(asset_value_inr, 0),
        "asset_value_crore": round(asset_value_inr / 1e7, 2),
        "expected_damage_inr": round(expected_damage_inr, 0),
        "expected_damage_crore": round(expected_damage_inr / 1e7, 2),
        "damage_factor": REPRESENTATIVE_DAMAGE_FACTOR,
        "geojson": geojson,
        "disclaimer": (
            "Change inferred from Sentinel-2 spectral change (NDBI/NDVI) and "
            "Dynamic World built-probability (2016 vs 2026). 10 m imagery cannot "
            "confirm individual buildings — polygons are land-cover change "
            "candidates and counts are estimates. Validate before use."
        ),
    }
