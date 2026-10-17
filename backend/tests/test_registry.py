"""Deterministic checks for the nationwide geographic registry.

These do not touch Earth Engine or the network — they only validate the static
AOI registry (basins.py) so they run fast in CI. Run with ``pytest`` or
standalone: ``python -m tests.test_registry``.
"""

from __future__ import annotations

from app.basins import (
    PILOTS,
    PILOT_REGION,
    VALIDATION_METRICS,
    get_aoi,
    get_basin,
    get_coverage,
    get_region,
    get_validation,
)

# The 28 states and 8 union territories of India (J&K and Ladakh are UTs).
EXPECTED_STATES = {
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal",
}
EXPECTED_UTS = {
    "Andaman & Nicobar Islands", "Chandigarh", "Daman & Diu", "Delhi",
    "Jammu & Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
}


def test_every_aoi_has_a_region() -> None:
    missing = [pid for pid in PILOTS if pid not in PILOT_REGION]
    assert not missing, f"AOIs missing a region: {missing}"


def test_all_states_and_uts_represented() -> None:
    regions = set(PILOT_REGION.values())
    missing_states = EXPECTED_STATES - regions
    missing_uts = EXPECTED_UTS - regions
    assert not missing_states, f"States not covered: {sorted(missing_states)}"
    assert not missing_uts, f"UTs not covered: {sorted(missing_uts)}"


def test_coverage_is_honest_enum() -> None:
    # Unlisted areas must default to "modelled" (never falsely "live").
    for pid in PILOTS:
        assert get_coverage(pid) in {"live", "modelled", "partial"}


def test_regional_river_searches_resolve() -> None:
    # One representative river per macro-region must exist in the registry.
    rivers = {a.tributary for a in PILOTS.values()}
    for river in ["Ganga", "Brahmaputra", "Narmada", "Godavari", "Kaveri",
                  "Mahanadi", "Jhelum", "Krishna"]:
        assert river in rivers, f"river missing from registry: {river}"


def test_test_cities_present() -> None:
    names = " ".join(a.name for a in PILOTS.values()).lower()
    for city in ["srinagar", "chennai", "mumbai", "kochi", "hyderabad",
                 "bengaluru", "kolkata", "ahmedabad", "bhopal", "nagpur",
                 "bhubaneswar", "port blair", "guwahati", "patna"]:
        assert city in names, f"test city missing: {city}"


def test_bboxes_are_within_india_envelope() -> None:
    # Rough India bounding envelope (incl. islands): lon 68-98, lat 6-37.
    for a in PILOTS.values():
        w, s, e, n = a.bbox
        assert 68.0 <= w < e <= 98.5, f"{a.id} lon out of range: {a.bbox}"
        assert 6.0 <= s < n <= 37.5, f"{a.id} lat out of range: {a.bbox}"
        lon, lat = a.center
        assert w <= lon <= e and s <= lat <= n, f"{a.id} center outside bbox"


def test_basin_resolves_for_every_aoi() -> None:
    for pid in PILOTS:
        assert get_basin(pid), f"no basin for {pid}"


def test_get_aoi_raises_for_unknown() -> None:
    try:
        get_aoi("atlantis")
    except KeyError:
        return
    raise AssertionError("get_aoi should raise KeyError for unknown id")


def test_live_set_is_validated_regions_only() -> None:
    # Ganga/Bihar core + every AOI that passed SAR validation at IoU >= 0.50.
    live = {pid for pid in PILOTS if get_coverage(pid) == "live"}
    assert {"patna", "guwahati", "dibrugarh", "majuli"} <= live
    # SAR-validated nationwide areas are now genuinely "live".
    for pid in ["chennai", "nashik", "hyderabad", "kolkata", "surat"]:
        assert get_coverage(pid) == "live", f"{pid} should be validated-live"
    # Areas that did NOT clear the 0.50 IoU bar must stay "modelled".
    for pid in ["mumbai", "kochi", "srinagar", "ahmedabad", "madurai"]:
        assert get_coverage(pid) != "live", f"{pid} should not be 'live'"


def test_validation_metrics_back_the_live_claim() -> None:
    # Every event-validated AOI must be "live", clear the 0.50 IoU bar, and
    # carry real precision/recall/IoU + a documented event id.
    for pid, m in VALIDATION_METRICS.items():
        assert get_coverage(pid) == "live", f"{pid} has metrics but not live"
        assert get_validation(pid) is m
        assert isinstance(m["event"], str) and m["event"]
        assert 0.5 <= float(m["iou"]) <= 1.0, f"{pid} IoU below live bar"
        assert 0.0 <= float(m["precision"]) <= 1.0
        assert 0.0 <= float(m["recall"]) <= 1.0


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"\nAll {len(fns)} registry checks passed. AOIs={len(PILOTS)} "
          f"regions={len(set(PILOT_REGION.values()))}")
