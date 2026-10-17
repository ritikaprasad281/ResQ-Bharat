"""Unit tests for the agricultural-loss calculation helpers.

These cover the pure-Python estimation logic (crop allocation, monetary
valuation, severity classification and unit handling) without Earth Engine or
any network access, so the loss figures are reproducible and auditable.

Run standalone:  .venv\\Scripts\\python.exe -m tests.test_agri_loss
Or with pytest:  pytest backend/tests/test_agri_loss.py
"""

from __future__ import annotations

from app.services.agri_loss import (
    CROPS,
    DAMAGE_FRACTION,
    REGION_CROP_PROFILE,
    allocate_crop_losses,
    classify_severity,
    crop_profile_for,
    loss_per_hectare,
)


def test_crop_profiles_normalise_to_one():
    """Every regional crop profile must sum to ~1.0 after normalisation."""
    for region in list(REGION_CROP_PROFILE) + ["Unknown-Region"]:
        profile = crop_profile_for(region)
        assert abs(sum(profile.values()) - 1.0) < 1e-9, region
        # Every crop referenced must exist in the crop reference table.
        for crop in profile:
            assert crop in CROPS, f"{region} references unknown crop {crop}"


def test_loss_per_hectare_is_yield_times_price():
    for crop, spec in CROPS.items():
        expected = float(spec["yield_t_ha"]) * float(spec["price_inr_t"])
        assert loss_per_hectare(crop) == expected


def test_allocated_areas_sum_to_damaged_area():
    damaged = 1000.0
    crops = allocate_crop_losses(damaged, "Bihar")
    total = sum(c["damaged_area_ha"] for c in crops)
    # Rounding per crop may introduce a tiny residue; allow 1 ha tolerance.
    assert abs(total - damaged) < 1.0


def test_monetary_loss_matches_manual_computation():
    """Loss for a single-crop region equals area x yield x price exactly."""
    # Goa profile is rice 0.8 / pulses 0.2 — use a region we can reason about.
    damaged = 100.0
    crops = allocate_crop_losses(damaged, "Goa")
    for c in crops:
        per_ha = loss_per_hectare(c["crop"])
        assert c["loss_inr"] == round(c["damaged_area_ha"] * per_ha, 0)


def test_zero_damage_gives_zero_loss():
    crops = allocate_crop_losses(0.0, "Punjab")
    assert all(c["damaged_area_ha"] == 0 for c in crops)
    assert sum(c["loss_inr"] for c in crops) == 0


def test_severity_low_when_small():
    sev = classify_severity(damaged_area_ha=1.0, loss_inr=50_000, cropland_ha=10_000)
    assert sev["level"] == "low"


def test_severity_severe_by_value():
    # Large monetary loss drives severe even if share is modest.
    sev = classify_severity(
        damaged_area_ha=500.0, loss_inr=60e7, cropland_ha=100_000
    )
    assert sev["level"] == "severe"
    assert sev["by_value"] == "severe"


def test_severity_severe_by_share():
    # 40% of cropland damaged -> severe by share even with small absolute value.
    sev = classify_severity(
        damaged_area_ha=400.0, loss_inr=5e6, cropland_ha=1000.0
    )
    assert sev["level"] == "severe"
    assert sev["by_share"] == "severe"


def test_severity_takes_worse_axis():
    # Moderate by value, high by share -> result must be the worse (high).
    sev = classify_severity(
        damaged_area_ha=200.0, loss_inr=2e7, cropland_ha=1000.0
    )
    assert sev["by_value"] == "moderate"
    assert sev["by_share"] == "high"
    assert sev["level"] == "high"


def test_damage_fraction_in_valid_range():
    assert 0.0 < DAMAGE_FRACTION < 1.0


if __name__ == "__main__":
    checks = [
        test_crop_profiles_normalise_to_one,
        test_loss_per_hectare_is_yield_times_price,
        test_allocated_areas_sum_to_damaged_area,
        test_monetary_loss_matches_manual_computation,
        test_zero_damage_gives_zero_loss,
        test_severity_low_when_small,
        test_severity_severe_by_value,
        test_severity_severe_by_share,
        test_severity_takes_worse_axis,
        test_damage_fraction_in_valid_range,
    ]
    for fn in checks:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"\nAll {len(checks)} agri-loss checks passed.")
