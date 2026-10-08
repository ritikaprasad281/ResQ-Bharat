"""Live flood risk scoring.

Blends live/forecast rainfall (Open-Meteo) with antecedent wetness and the
static flood susceptibility of the area (from Earth Engine) into a calibrated
0-1 risk score. This is a transparent early-warning score, not a guaranteed
forecast (see docs/ganga-flood-approach.md).
"""

from __future__ import annotations

import time

import httpx
import ee

from app.basins import Aoi
from app.ee_client import ensure_ee
from app.services.flood_zones import compute_flood_zone_image

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Rainfall (mm) that saturates each sub-score.
ANTECEDENT_SATURATION = 150.0
FORECAST_SATURATION = 250.0


def _rainfall(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum",
        "past_days": 3,
        "forecast_days": 7,
        "timezone": "auto",
    }
    # Open-Meteo occasionally returns a transient 5xx; retry a few times.
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            with httpx.Client(timeout=20) as client:
                resp = client.get(OPEN_METEO_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
            break
        except httpx.HTTPError as exc:
            last_exc = exc
            if attempt == 2:
                raise
            time.sleep(1.0 * (attempt + 1))
    daily = data.get("daily", {})
    dates = daily.get("time", [])
    precip = daily.get("precipitation_sum", []) or []
    precip = [p or 0.0 for p in precip]
    # First 3 entries are past days; remainder is the forecast.
    past = precip[:3]
    forecast = precip[3:]
    return {
        "dates": dates,
        "daily_mm": precip,
        "antecedent_3d_mm": round(sum(past), 1),
        "forecast_3d_mm": round(sum(forecast[:3]), 1),
        "forecast_7d_mm": round(sum(forecast), 1),
    }


def _static_susceptibility(aoi: Aoi) -> float:
    ensure_ee()
    score, region = compute_flood_zone_image(aoi)
    mean = score.reduceRegion(
        reducer=ee.Reducer.mean(), geometry=region, scale=250, maxPixels=1e9
    ).get("confidence")
    val = ee.Number(mean).getInfo()
    return float(val) if val is not None else 0.0


def _level(score: float) -> str:
    if score >= 0.75:
        return "severe"
    if score >= 0.5:
        return "high"
    if score >= 0.25:
        return "medium"
    return "low"


def compute_live_risk(aoi: Aoi) -> dict:
    lon, lat = aoi.center
    rain = _rainfall(lat, lon)
    susceptibility = _static_susceptibility(aoi)

    antecedent = min(rain["antecedent_3d_mm"] / ANTECEDENT_SATURATION, 1.0)
    forecast = min(rain["forecast_7d_mm"] / FORECAST_SATURATION, 1.0)

    # Rainfall only becomes dangerous where the land is susceptible.
    rainfall_pressure = 0.4 * antecedent + 0.6 * forecast
    risk = round(0.35 * susceptibility + 0.65 * rainfall_pressure, 3)
    risk = max(0.0, min(risk, 1.0))

    return {
        "aoi": aoi.id,
        "probability": risk,
        "level": _level(risk),
        "susceptibility": round(susceptibility, 3),
        "rainfall": rain,
        "model": "transparent-weighted-v1",
    }
