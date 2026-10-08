"""Flood-prone zone mapping in Earth Engine.

Confidence combines three independent signals (see docs/ganga-flood-approach.md):
  1. Observed Sentinel-1 SAR flood frequency across past monsoons (strongest).
  2. JRC Global Surface Water seasonal occurrence.
  3. DEM low-lying proxy (height above local drainage approximation).
Permanent open water is excluded so zones represent floodable *land*.
"""

from __future__ import annotations

import ee

from app.basins import Aoi
from app.ee_client import ensure_ee

# Monsoon season drives flooding in the Ganga basin.
MONSOON_START_MONTH = 6
MONSOON_END_MONTH = 10
# VV backscatter below this (dB) is classified as water.
WATER_VV_DB = -16.0


def _sar_flood_frequency(region: ee.Geometry, start_year: int, end_year: int) -> ee.Image:
    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(region)
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.calendarRange(MONSOON_START_MONTH, MONSOON_END_MONTH, "month"))
        .filter(ee.Filter.calendarRange(start_year, end_year, "year"))
        .select("VV")
    )

    def to_water(img: ee.Image) -> ee.Image:
        smoothed = img.focal_median(50, "circle", "meters")
        return smoothed.lt(WATER_VV_DB).rename("water")

    # Mean of boolean water masks = fraction of scenes a pixel was flooded.
    return ee.ImageCollection(s1.map(to_water)).mean().unmask(0)


def _low_lying_proxy(region: ee.Geometry) -> ee.Image:
    """Approximate height-above-drainage: lower relative elevation -> more floodable."""
    dem = ee.Image("USGS/SRTMGL1_003").select("elevation").clip(region)
    local_min = dem.focal_min(1500, "circle", "meters")
    hand = dem.subtract(local_min)  # metres above local low point
    # Map 0..10 m above drainage to 1..0 floodability.
    return hand.multiply(-0.1).add(1).clamp(0, 1)


def compute_flood_zone_image(
    aoi: Aoi, start_year: int = 2019, end_year: int = 2024
) -> tuple[ee.Image, ee.Geometry]:
    ensure_ee()
    region = ee.Geometry.Rectangle(list(aoi.bbox))

    sar_freq = _sar_flood_frequency(region, start_year, end_year).clip(region)
    jrc = (
        ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
        .select("occurrence")
        .unmask(0)
        .divide(100)
        .clip(region)
    )
    low_lying = _low_lying_proxy(region)

    permanent_water = jrc.gt(0.8)

    # Weighted confidence score in [0, 1].
    score = (
        sar_freq.multiply(0.55)
        .add(jrc.multiply(0.20))
        .add(low_lying.multiply(0.25))
        .updateMask(permanent_water.Not())
        .rename("confidence")
    )
    return score, region


def compute_flood_zones_geojson(
    aoi: Aoi,
    start_year: int = 2019,
    end_year: int = 2024,
    min_confidence: float = 0.2,
    scale: int = 150,
) -> dict:
    """Return flood-prone zones as a GeoJSON FeatureCollection with confidence."""
    score, region = compute_flood_zone_image(aoi, start_year, end_year)

    flood_prone = score.gte(min_confidence)
    # Bucket confidence into classes so vectorized polygons are coherent.
    classes = (
        score.multiply(100)
        .where(score.lt(0.4), 1)
        .where(score.gte(0.4).And(score.lt(0.6)), 2)
        .where(score.gte(0.6).And(score.lt(0.8)), 3)
        .where(score.gte(0.8), 4)
        .updateMask(flood_prone)
        .toInt()
        .rename("risk_class")
    )

    vectors = classes.addBands(score).reduceToVectors(
        geometry=region,
        scale=scale,
        geometryType="polygon",
        eightConnected=True,
        labelProperty="risk_class",
        reducer=ee.Reducer.mean(),
        maxPixels=1e9,
    )
    # Simplify + drop slivers for a clean map.
    vectors = vectors.map(
        lambda f: f.simplify(maxError=60).set(
            "area_km2", f.geometry().area(maxError=30).divide(1e6)
        )
    ).filter(ee.Filter.gt("area_km2", 0.05))

    return vectors.getInfo()
