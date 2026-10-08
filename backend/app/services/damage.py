"""Damage & exposure estimation (fast, raster-based).

Uses GHSL built-up surface (m2) and WorldPop (population) within the flood-prone
mask to estimate buildings exposed, population exposed, and monetary damage across
flood-intensity scenarios. All figures are transparent estimates derived from
published depth-damage curves — not guarantees.
"""

from __future__ import annotations

import ee

from app.basins import Aoi
from app.ee_client import ensure_ee
from app.services.flood_zones import compute_flood_zone_image

# Representative flood depth (m) and fraction-of-value damage per scenario.
SCENARIOS: dict[str, dict[str, float]] = {
    "1in10": {"depth_m": 1.0, "damage_factor": 0.20, "return_period": 10},
    "1in25": {"depth_m": 2.0, "damage_factor": 0.40, "return_period": 25},
    "1in100": {"depth_m": 3.5, "damage_factor": 0.65, "return_period": 100},
}

# Approximate replacement cost of built structures (INR per m2). Configurable.
COST_PER_M2_INR = 15000.0
# Typical building footprint (m2) used to estimate structure count from built area.
AVG_FOOTPRINT_M2 = 70.0


def estimate_damage(aoi: Aoi, min_confidence: float = 0.3) -> dict:
    ensure_ee()
    score, region = compute_flood_zone_image(aoi)
    flood_mask = score.gte(min_confidence)

    built = (
        ee.ImageCollection("JRC/GHSL/P2023A/GHS_BUILT_S")
        .filterDate("2020-01-01", "2021-01-01")
        .first()
        .select("built_surface")
    )
    pop = (
        ee.ImageCollection("WorldPop/GP/100m/pop")
        .filter(ee.Filter.eq("country", "IND"))
        .sort("year", False)
        .first()
        .select("population")
    )

    stats = (
        ee.Image.cat(built.rename("built"), pop.rename("pop"))
        .updateMask(flood_mask)
        .reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=region,
            scale=100,
            maxPixels=1e9,
        )
        .getInfo()
    )
    building_area_m2 = float(stats.get("built") or 0.0)
    pop_exposed = round(float(stats.get("pop") or 0.0))
    buildings_exposed = round(building_area_m2 / AVG_FOOTPRINT_M2)

    scenarios_out = {}
    for name, cfg in SCENARIOS.items():
        monetary = building_area_m2 * COST_PER_M2_INR * cfg["damage_factor"]
        life_risk_index = round(pop_exposed * cfg["damage_factor"] * 0.01, 1)
        scenarios_out[name] = {
            "return_period": cfg["return_period"],
            "depth_m": cfg["depth_m"],
            "damage_factor": cfg["damage_factor"],
            "est_damage_inr": round(monetary, 0),
            "est_damage_crore": round(monetary / 1e7, 2),
            "life_risk_index": life_risk_index,
        }

    return {
        "aoi": aoi.id,
        "buildings_exposed": buildings_exposed,
        "building_area_m2": round(building_area_m2, 0),
        "population_exposed": pop_exposed,
        "cost_per_m2_inr": COST_PER_M2_INR,
        "scenarios": scenarios_out,
        "disclaimer": "Estimates from GHSL built-up surface + published depth-damage curves; validate before operational use.",
    }
