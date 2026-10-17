"""Agricultural (crop) loss estimation from flood exposure.

This module turns the same flood-prone extent used elsewhere in ResQ Bharat into
a transparent, defensible estimate of flood-related agricultural loss for a study
area: how much cropland is exposed, how much is estimated damaged, and the
indicative monetary value of that damage in Indian Rupees.

Design principles (data credibility first):
  * The *exposed cropland area* is a real satellite measurement — ESA WorldCover
    2021 cropland (10 m) intersected with the modelled flood corridor used by the
    rest of the app (Sentinel-1 SAR + JRC Global Surface Water + SRTM). It is
    labelled "model-estimated", never "reported".
  * The *damaged area* applies a single, documented damage fraction to the
    exposed area (exposed land is not assumed to be 100% destroyed).
  * The *monetary loss* values the damaged area using national-average crop
    yield and price assumptions allocated by a coarse, documented regional
    cropping pattern. These are clearly flagged as assumptions, not measurements.

Nothing here is presented as an official government damage survey. Every figure
carries provenance and a confidence label so the UI can distinguish satellite
measurement from economic assumption. The pure-Python helpers (crop allocation,
monetary valuation, severity classification) are unit-tested without Earth
Engine so the calculations are reproducible and auditable.
"""

from __future__ import annotations

from datetime import datetime, timezone

import ee

from app.basins import PILOTS, Aoi, get_basin, get_coverage, get_region
from app.clients import firestore_client as fs
from app.ee_client import ensure_ee
from app.services.flood_zones import _river_corridor, compute_flood_zone_image
from app.ttl_cache import TTLCache

# Memo for the portfolio rollup (same rationale as impact: pure aggregate over
# cached per-AOI results that change only when a batch re-runs).
_SUMMARY_TTL_SEC = 5 * 60
_summary_cache = TTLCache()

# --- Flood exposure parameters -------------------------------------------
# Flood-prone confidence at/above which land is treated as "exposed". Matches
# the damage.py exposure threshold so cropland and building exposure are
# consistent for the same area.
FLOOD_CONFIDENCE = 0.3

# Fraction of flood-exposed cropland assumed to actually suffer crop damage.
# Exposure is not destruction: shallow/short-duration inundation, bunded fields,
# drainage and crop stage all mean only a portion of exposed crops are lost.
# 0.40 is a representative central value; the low/high band expresses the
# uncertainty and is surfaced in the API so the estimate is never presented as
# exact. Documented assumption — not a measured damage rate.
DAMAGE_FRACTION = 0.40
DAMAGE_FRACTION_LOW = 0.25
DAMAGE_FRACTION_HIGH = 0.55

HECTARE_M2 = 10_000.0

# --- Crop reference (indicative national averages) -----------------------
# yield_t_ha : expected marketable yield in tonnes per hectare.
# price_inr_t: farm-gate / MSP-indicative price in Indian Rupees per tonne.
# These are coarse national averages drawn from public agricultural statistics
# (Agricultural Statistics at a Glance / CACP Minimum Support Prices, indicative
# 2023-24 levels). They are ASSUMPTIONS for estimation, not per-field data, and
# are kept here as a single source of truth so they can be refined later.
CROPS: dict[str, dict[str, object]] = {
    "rice":      {"label": "Rice / paddy", "yield_t_ha": 2.7, "price_inr_t": 20000.0, "season": "Kharif"},
    "wheat":     {"label": "Wheat",        "yield_t_ha": 3.5, "price_inr_t": 22500.0, "season": "Rabi"},
    "maize":     {"label": "Maize",        "yield_t_ha": 3.2, "price_inr_t": 20900.0, "season": "Kharif"},
    "sugarcane": {"label": "Sugarcane",    "yield_t_ha": 80.0, "price_inr_t": 3400.0, "season": "Annual"},
    "cotton":    {"label": "Cotton (seed)", "yield_t_ha": 1.5, "price_inr_t": 70000.0, "season": "Kharif"},
    "pulses":    {"label": "Pulses (gram)", "yield_t_ha": 1.1, "price_inr_t": 54000.0, "season": "Rabi"},
    "oilseeds":  {"label": "Oilseeds (mustard)", "yield_t_ha": 1.4, "price_inr_t": 56000.0, "season": "Rabi"},
    "millets":   {"label": "Millets (bajra/jowar)", "yield_t_ha": 1.5, "price_inr_t": 25000.0, "season": "Kharif"},
    "jute":      {"label": "Jute",         "yield_t_ha": 2.6, "price_inr_t": 50000.0, "season": "Kharif"},
}

# Coarse dominant cropping pattern by state / UT (shares sum to ~1.0). Used to
# allocate the estimated damaged hectares across crops for monetary valuation.
# This is a documented REGIONAL ASSUMPTION about typical cropping mix, not a
# measured per-location crop map. Unlisted regions use _DEFAULT_PROFILE.
_DEFAULT_PROFILE: dict[str, float] = {
    "rice": 0.40, "wheat": 0.30, "pulses": 0.15, "oilseeds": 0.15,
}

REGION_CROP_PROFILE: dict[str, dict[str, float]] = {
    "Bihar": {"rice": 0.40, "wheat": 0.30, "maize": 0.15, "pulses": 0.10, "sugarcane": 0.05},
    "Uttar Pradesh": {"wheat": 0.35, "rice": 0.30, "sugarcane": 0.20, "pulses": 0.10, "maize": 0.05},
    "Uttarakhand": {"rice": 0.40, "wheat": 0.40, "sugarcane": 0.10, "pulses": 0.10},
    "West Bengal": {"rice": 0.60, "jute": 0.15, "wheat": 0.10, "pulses": 0.10, "oilseeds": 0.05},
    "Assam": {"rice": 0.70, "jute": 0.10, "pulses": 0.10, "oilseeds": 0.10},
    "Punjab": {"wheat": 0.45, "rice": 0.45, "maize": 0.05, "cotton": 0.05},
    "Haryana": {"wheat": 0.40, "rice": 0.30, "cotton": 0.10, "oilseeds": 0.10, "sugarcane": 0.10},
    "Chandigarh": {"wheat": 0.50, "rice": 0.50},
    "Delhi": {"wheat": 0.50, "rice": 0.30, "oilseeds": 0.20},
    "Himachal Pradesh": {"wheat": 0.40, "maize": 0.35, "rice": 0.15, "pulses": 0.10},
    "Jammu & Kashmir": {"rice": 0.45, "wheat": 0.35, "maize": 0.20},
    "Ladakh": {"wheat": 0.50, "millets": 0.30, "pulses": 0.20},
    "Rajasthan": {"wheat": 0.30, "millets": 0.30, "oilseeds": 0.20, "pulses": 0.20},
    "Madhya Pradesh": {"wheat": 0.35, "pulses": 0.25, "oilseeds": 0.20, "rice": 0.20},
    "Chhattisgarh": {"rice": 0.70, "pulses": 0.15, "oilseeds": 0.15},
    "Maharashtra": {"cotton": 0.25, "pulses": 0.20, "oilseeds": 0.20, "sugarcane": 0.20, "millets": 0.15},
    "Gujarat": {"cotton": 0.35, "oilseeds": 0.25, "wheat": 0.20, "rice": 0.20},
    "Goa": {"rice": 0.80, "pulses": 0.20},
    "Daman & Diu": {"rice": 0.70, "pulses": 0.30},
    "Karnataka": {"rice": 0.30, "millets": 0.25, "oilseeds": 0.20, "pulses": 0.15, "sugarcane": 0.10},
    "Telangana": {"rice": 0.50, "cotton": 0.25, "maize": 0.15, "pulses": 0.10},
    "Andhra Pradesh": {"rice": 0.55, "pulses": 0.20, "cotton": 0.15, "oilseeds": 0.10},
    "Tamil Nadu": {"rice": 0.55, "millets": 0.15, "sugarcane": 0.15, "pulses": 0.15},
    "Kerala": {"rice": 0.70, "pulses": 0.15, "oilseeds": 0.15},
    "Puducherry": {"rice": 0.75, "pulses": 0.25},
    "Odisha": {"rice": 0.70, "pulses": 0.15, "oilseeds": 0.15},
    "Jharkhand": {"rice": 0.65, "pulses": 0.20, "maize": 0.15},
    "Arunachal Pradesh": {"rice": 0.65, "maize": 0.20, "millets": 0.15},
    "Nagaland": {"rice": 0.70, "maize": 0.20, "millets": 0.10},
    "Manipur": {"rice": 0.80, "pulses": 0.10, "maize": 0.10},
    "Tripura": {"rice": 0.80, "pulses": 0.10, "oilseeds": 0.10},
    "Mizoram": {"rice": 0.70, "maize": 0.20, "pulses": 0.10},
    "Meghalaya": {"rice": 0.65, "maize": 0.25, "pulses": 0.10},
    "Sikkim": {"maize": 0.40, "rice": 0.35, "pulses": 0.25},
    "Andaman & Nicobar Islands": {"rice": 0.80, "pulses": 0.20},
    "Lakshadweep": {"rice": 0.50, "pulses": 0.50},
}

# --- Severity thresholds (documented) ------------------------------------
# Loss is classified on TWO independent axes and the worse of the two is taken:
#   * share  = estimated damaged cropland / total AOI cropland
#   * value  = estimated monetary loss (INR)
# This avoids a large but low-value area or a small high-value area being mislabelled.
SEVERITY_SHARE = [("severe", 0.30), ("high", 0.15), ("moderate", 0.05)]  # else low
SEVERITY_VALUE_INR = [
    ("severe", 50e7),   # >= 50 crore
    ("high", 10e7),     # >= 10 crore
    ("moderate", 1e7),  # >= 1 crore
]  # else low
_SEVERITY_RANK = {"low": 0, "moderate": 1, "high": 2, "severe": 3}

AGRI_SOURCES = [
    {
        "name": "ESA WorldCover 2021 (v200)",
        "kind": "land cover",
        "temporal": "2021, 10 m global",
        "role": "Cropland extent (class 40)",
        "url": "https://esa-worldcover.org/",
    },
    {
        "name": "Sentinel-1 SAR + JRC Global Surface Water + SRTM",
        "kind": "flood extent",
        "temporal": "SAR 2019-2024, JRC 1984-2021, SRTM 2000",
        "role": "Modelled flood-prone corridor (reused from ResQ Bharat risk model)",
        "url": "https://global-surface-water.appspot.com/",
    },
    {
        "name": "Agricultural Statistics at a Glance / CACP MSP",
        "kind": "assumption",
        "temporal": "Indicative 2023-24 national averages",
        "role": "Crop yield, price and regional cropping-mix assumptions",
        "url": "https://desagri.gov.in/",
    },
]

DISCLAIMER = (
    "Model-generated estimate. Flood-exposed cropland is derived from satellite "
    "land cover intersected with a modelled flood extent; damaged area and "
    "monetary loss apply documented damage-fraction, yield and price assumptions "
    "allocated by a coarse regional cropping pattern. These figures are "
    "indicative only and are NOT a substitute for official agricultural damage "
    "surveys or government compensation assessments."
)


# ---------------------------------------------------------------------------
# Pure helpers (unit-tested without Earth Engine)
# ---------------------------------------------------------------------------
def crop_profile_for(region: str) -> dict[str, float]:
    """Return the (normalised) crop-share assumption for a region."""
    profile = REGION_CROP_PROFILE.get(region, _DEFAULT_PROFILE)
    total = sum(profile.values()) or 1.0
    return {crop: share / total for crop, share in profile.items()}


def loss_per_hectare(crop: str) -> float:
    """Full-loss value of one hectare of a crop (INR): yield x price."""
    spec = CROPS[crop]
    return float(spec["yield_t_ha"]) * float(spec["price_inr_t"])


def allocate_crop_losses(damaged_area_ha: float, region: str) -> list[dict]:
    """Split damaged hectares across the regional crop mix and value each.

    Monetary loss for a crop = damaged_area_crop(ha) x yield(t/ha) x price(INR/t).
    The damage fraction is already baked into `damaged_area_ha`, so it is not
    applied again here (no double counting).
    """
    profile = crop_profile_for(region)
    out: list[dict] = []
    for crop, share in sorted(profile.items(), key=lambda kv: kv[1], reverse=True):
        area = round(damaged_area_ha * share, 2)
        per_ha = loss_per_hectare(crop)
        spec = CROPS[crop]
        out.append(
            {
                "crop": crop,
                "label": spec["label"],
                "season": spec["season"],
                "share": round(share, 3),
                "damaged_area_ha": area,
                "yield_t_ha": spec["yield_t_ha"],
                "price_inr_t": spec["price_inr_t"],
                "loss_inr": round(area * per_ha, 0),
            }
        )
    return out


def classify_severity(
    damaged_area_ha: float, loss_inr: float, cropland_ha: float
) -> dict:
    """Classify agricultural loss severity on share and value axes.

    Returns the worse of the two classifications with the basis made explicit so
    the label is never arbitrary.
    """
    share = (damaged_area_ha / cropland_ha) if cropland_ha > 0 else 0.0

    by_share = "low"
    for level, thr in SEVERITY_SHARE:
        if share >= thr:
            by_share = level
            break

    by_value = "low"
    for level, thr in SEVERITY_VALUE_INR:
        if loss_inr >= thr:
            by_value = level
            break

    level = by_share if _SEVERITY_RANK[by_share] >= _SEVERITY_RANK[by_value] else by_value
    basis = "damaged share of cropland" if level == by_share else "estimated monetary loss"
    return {
        "level": level,
        "basis": basis,
        "share_of_cropland": round(share, 4),
        "by_share": by_share,
        "by_value": by_value,
    }


def _crore(inr: float) -> float:
    return round(inr / 1e7, 3)


# ---------------------------------------------------------------------------
# Earth Engine computation
# ---------------------------------------------------------------------------
def compute_agri_loss(aoi: Aoi) -> dict:
    """Estimate flood-related agricultural loss for a study area.

    Measures flood-exposed cropland from satellite land cover, applies the
    documented damage fraction to estimate damaged area, and values that area
    using the regional crop-mix / yield / price assumptions.
    """
    ensure_ee()
    score, region = compute_flood_zone_image(aoi)
    flood_mask = score.gte(FLOOD_CONFIDENCE)
    corridor = _river_corridor(region)

    worldcover = (
        ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").clip(region)
    )
    cropland = worldcover.eq(40)  # ESA WorldCover class 40 = Cropland
    exposed = cropland.updateMask(flood_mask).updateMask(corridor)

    area_ha = ee.Image.pixelArea().divide(HECTARE_M2)
    bands = ee.Image.cat(
        area_ha.updateMask(cropland).rename("cropland_ha"),
        area_ha.updateMask(exposed).rename("exposed_ha"),
    )
    stats = bands.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=region,
        scale=30,
        maxPixels=1e9,
    ).getInfo()

    cropland_ha = round(float(stats.get("cropland_ha") or 0.0), 1)
    exposed_ha = round(float(stats.get("exposed_ha") or 0.0), 1)
    damaged_ha = round(exposed_ha * DAMAGE_FRACTION, 1)
    damaged_low = round(exposed_ha * DAMAGE_FRACTION_LOW, 1)
    damaged_high = round(exposed_ha * DAMAGE_FRACTION_HIGH, 1)

    region_name = get_region(aoi.id)
    crops = allocate_crop_losses(damaged_ha, region_name)
    loss_inr = round(sum(c["loss_inr"] for c in crops), 0)
    loss_low = round(sum(
        c["damaged_area_ha"] * (DAMAGE_FRACTION_LOW / DAMAGE_FRACTION)
        * loss_per_hectare(c["crop"])
        for c in crops
    ), 0) if damaged_ha else 0.0
    loss_high = round(sum(
        c["damaged_area_ha"] * (DAMAGE_FRACTION_HIGH / DAMAGE_FRACTION)
        * loss_per_hectare(c["crop"])
        for c in crops
    ), 0) if damaged_ha else 0.0

    severity = classify_severity(damaged_ha, loss_inr, cropland_ha)
    loss_per_ha = round(loss_inr / damaged_ha, 0) if damaged_ha > 0 else 0.0

    coverage = get_coverage(aoi.id)
    confidence = (
        "estimated (SAR-validated flood extent)"
        if coverage == "live"
        else "estimated (modelled flood extent)"
    )

    return {
        "aoi": aoi.id,
        "name": aoi.name,
        "region": region_name,
        "basin": get_basin(aoi.id),
        "tributary": aoi.tributary,
        "center": list(aoi.center),
        "bbox": list(aoi.bbox),
        "coverage": coverage,
        "data_confidence": confidence,
        "cropland_ha": cropland_ha,
        "exposed_cropland_ha": exposed_ha,
        "damaged_cropland_ha": damaged_ha,
        "damaged_area_range_ha": {"low": damaged_low, "high": damaged_high},
        "damage_fraction": DAMAGE_FRACTION,
        "damage_fraction_range": {"low": DAMAGE_FRACTION_LOW, "high": DAMAGE_FRACTION_HIGH},
        "estimated_loss_inr": loss_inr,
        "estimated_loss_crore": _crore(loss_inr),
        "estimated_loss_range_inr": {"low": loss_low, "high": loss_high},
        "loss_per_hectare_inr": loss_per_ha,
        "crops": crops,
        "crop_types": len(crops),
        "primary_crop": crops[0]["label"] if crops else None,
        "severity": severity,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "sources": AGRI_SOURCES,
        "methodology": {
            "exposed_area": (
                "ESA WorldCover 2021 cropland (class 40) intersected with the "
                "modelled flood corridor (flood confidence >= "
                f"{FLOOD_CONFIDENCE}) at 30 m."
            ),
            "damaged_area": (
                f"exposed cropland x damage fraction {DAMAGE_FRACTION} "
                f"(range {DAMAGE_FRACTION_LOW}-{DAMAGE_FRACTION_HIGH})."
            ),
            "monetary_loss": (
                "sum over crops of damaged_area(ha) x yield(t/ha) x price(INR/t), "
                "with damaged area allocated by the regional cropping-mix assumption."
            ),
            "severity": (
                "worse of damaged-share-of-cropland and absolute monetary-loss "
                "thresholds; see severity.basis."
            ),
        },
        "disclaimer": DISCLAIMER,
    }


# A compact per-location record kept in the portfolio summary so the frontend
# table/map/charts can render without computing every AOI live.
_SUMMARY_FIELDS = (
    "aoi", "name", "region", "basin", "tributary", "center", "bbox",
    "coverage", "data_confidence", "cropland_ha", "exposed_cropland_ha",
    "damaged_cropland_ha", "estimated_loss_inr", "estimated_loss_crore",
    "loss_per_hectare_inr", "primary_crop", "crop_types",
)


def _summary_row(doc: dict) -> dict:
    row = {k: doc.get(k) for k in _SUMMARY_FIELDS}
    sev = doc.get("severity") or {}
    row["severity"] = sev.get("level")
    row["severity_basis"] = sev.get("basis")
    row["updated_at"] = doc.get("updated_at")
    return row


def summarize_agri_loss() -> dict:
    """Portfolio rollup across study areas with a cached agri-loss estimate.

    Reads only cached per-AOI results (never triggers a fresh Earth Engine run),
    so it is fast. Study areas not yet computed are reported as `pending` rather
    than fabricated, keeping the dashboard honest about data availability.
    """
    return _summary_cache.get_or_set("summary", _SUMMARY_TTL_SEC, _summarize_agri_loss)


def _summarize_agri_loss() -> dict:
    rows: list[dict] = []
    total_cropland = 0.0
    total_exposed = 0.0
    total_damaged = 0.0
    total_loss = 0.0
    crop_set: set[str] = set()
    severity_counts = {"low": 0, "moderate": 0, "high": 0, "severe": 0}

    # Read every cached per-AOI result concurrently (one batch, not 100 gets).
    docs = fs.get_docs([f"pilots/{pid}/cache/agri_loss" for pid in PILOTS])

    for pid in PILOTS:
        doc = docs.get(f"pilots/{pid}/cache/agri_loss")
        if not doc or doc.get("exposed_cropland_ha") is None:
            continue
        rows.append(_summary_row(doc))
        total_cropland += float(doc.get("cropland_ha") or 0.0)
        total_exposed += float(doc.get("exposed_cropland_ha") or 0.0)
        total_damaged += float(doc.get("damaged_cropland_ha") or 0.0)
        total_loss += float(doc.get("estimated_loss_inr") or 0.0)
        for c in doc.get("crops", []) or []:
            if (c.get("damaged_area_ha") or 0) > 0:
                crop_set.add(c.get("crop"))
        lvl = (doc.get("severity") or {}).get("level")
        if lvl in severity_counts:
            severity_counts[lvl] += 1

    rows.sort(key=lambda r: r.get("estimated_loss_inr") or 0, reverse=True)
    analysed = len(rows)
    rivers = {r.get("tributary") for r in rows if r.get("tributary")}

    return {
        "locations_total": len(PILOTS),
        "locations_analysed": analysed,
        "locations_pending": len(PILOTS) - analysed,
        "total_cropland_ha": round(total_cropland, 1),
        "total_exposed_cropland_ha": round(total_exposed, 1),
        "total_damaged_cropland_ha": round(total_damaged, 1),
        "total_estimated_loss_inr": round(total_loss, 0),
        "total_estimated_loss_crore": _crore(total_loss),
        "rivers_affected": len(rivers),
        "crop_types_affected": len(crop_set),
        "severity_counts": severity_counts,
        "locations": rows,
        "sources": AGRI_SOURCES,
        "disclaimer": DISCLAIMER,
    }
