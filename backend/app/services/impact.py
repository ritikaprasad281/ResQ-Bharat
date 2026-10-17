"""Portfolio-level social-impact aggregation across every monitored district.

Rolls up the per-location Growth Watch results (new construction inside the flood
corridor) and the live risk ranking into a single "impact at a glance" summary
for the landing page. Reads only cached values, so it is fast and never triggers
a fresh Earth Engine computation.
"""

from __future__ import annotations

from app.basins import PILOTS
from app.clients import firestore_client as fs
from app.ttl_cache import TTLCache

# The rollup reads only cached per-location results, which change only when a
# batch analysis re-runs (infrequent). A short in-process memo lets repeated
# landing-page loads reuse the aggregate instead of re-reading 100 docs each
# time, while staying fresh within minutes.
_IMPACT_TTL_SEC = 5 * 60
_impact_cache = TTLCache()


def compute_impact() -> dict:
    return _impact_cache.get_or_set("impact", _IMPACT_TTL_SEC, _compute_impact)


def _compute_impact() -> dict:
    buildings = 0
    population = 0
    asset_crore = 0.0
    area_ha = 0.0
    analysed = 0
    rivers: set[str] = set()

    # Read every per-pilot cache concurrently instead of 100 sequential gets.
    paths = [f"pilots/{pid}/cache/new_construction" for pid in PILOTS]
    docs = fs.get_docs(paths)
    for pid, aoi in PILOTS.items():
        rivers.add(aoi.tributary)
        doc = docs.get(f"pilots/{pid}/cache/new_construction")
        if doc and doc.get("new_buildings") is not None:
            analysed += 1
            buildings += int(doc.get("new_buildings", 0) or 0)
            population += int(doc.get("population_at_risk", 0) or 0)
            asset_crore += float(doc.get("asset_value_crore", 0.0) or 0.0)
            area_ha += float(doc.get("new_built_area_ha", 0.0) or 0.0)

    high_risk_now = 0
    try:
        ranking = fs.get_doc("cache/ranking")
        if ranking:
            high_risk_now = sum(
                1
                for x in ranking.get("all", [])
                if x.get("level") in ("high", "severe")
            )
    except Exception:
        high_risk_now = 0

    return {
        "districts_monitored": len(PILOTS),
        "rivers_monitored": len(rivers),
        "locations_analysed": analysed,
        "new_buildings_in_corridor": buildings,
        "people_newly_exposed": population,
        "new_built_area_ha": round(area_ha, 1),
        "asset_value_crore": round(asset_crore, 1),
        "high_risk_now": high_risk_now,
    }
