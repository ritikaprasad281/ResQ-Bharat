"""72-hour / 7-day predictive flood-risk trajectory.

Projects the live risk score forward day-by-day using the Open-Meteo rainfall
forecast and the terrain susceptibility, so responders can see WHEN risk peaks
in the coming week — not just the current value. This is the predictive layer on
top of the transparent live-risk score.
"""

from __future__ import annotations

import time

import httpx

from app.basins import Aoi
from app.services.live_risk import (
    ANTECEDENT_SATURATION,
    FORECAST_SATURATION,
    OPEN_METEO_URL,
    _level,
    _rainfall,
    susceptibility_for,
)
from app.ttl_cache import TTLCache

# Rain that saturates a single day's sub-score (7-day saturation spread over days).
_DAILY_SATURATION = FORECAST_SATURATION / 3.0

# Short-horizon windows (hours). Each window's saturation is the 7-day (168 h)
# forecast saturation scaled linearly to the window length, so the sub-scores
# stay consistent with the daily/live-risk model.
_HORIZON_HOURS = (6, 24, 72)

# Memo for the hourly forecast (same freshness characteristics as daily rain).
_HOURLY_TTL_SEC = 600.0
_hourly_cache = TTLCache()


def _hourly_rainfall(lat: float, lon: float) -> dict | None:
    key = (round(lat, 4), round(lon, 4))
    cached = _hourly_cache.get(key, _HOURLY_TTL_SEC)
    if cached is not None:
        return cached or None  # empty dict sentinel -> treat as miss-but-known
    result = _hourly_rainfall_fetch(lat, lon)
    _hourly_cache.set(key, result or {})
    return result


def _hourly_rainfall_fetch(lat: float, lon: float) -> dict | None:
    """Fetch Open-Meteo hourly precipitation and accumulate it over the next
    6 / 24 / 72 hours starting from the current hour. Returns None on failure so
    the caller can degrade gracefully (the daily outlook still works)."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "precipitation",
        "current": "precipitation",
        "forecast_days": 4,
        "timezone": "auto",
    }
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
                return None
            time.sleep(1.0 * (attempt + 1))
    else:  # pragma: no cover
        if last_exc:
            return None

    hourly = data.get("hourly", {})
    times = hourly.get("time", []) or []
    precip = [float(p or 0.0) for p in hourly.get("precipitation", []) or []]
    now_t = (data.get("current", {}) or {}).get("time")
    try:
        idx = times.index(now_t) if now_t else 0
    except ValueError:
        idx = 0
    windows = {
        h: round(sum(precip[idx : idx + h]), 1) for h in _HORIZON_HOURS
    }
    issued_at = now_t or (times[idx] if idx < len(times) else None)
    return {"issued_at": issued_at, "windows": windows}


def compute_forecast(aoi: Aoi) -> dict:
    lon, lat = aoi.center
    rain = _rainfall(lat, lon)
    susceptibility = susceptibility_for(aoi)

    dates = rain["dates"]
    daily = rain["daily_mm"]

    # The first 3 daily entries are observed past days; the rest is the forecast
    # horizon. For each future day we combine a 3-day trailing wetness proxy with
    # that day's rainfall, then weight by how flood-susceptible the terrain is.
    series: list[dict] = []
    for i in range(3, len(daily)):
        day_rain = float(daily[i])
        trailing = sum(float(x) for x in daily[max(0, i - 2) : i + 1])
        antecedent = min(trailing / ANTECEDENT_SATURATION, 1.0)
        pressure = min(day_rain / _DAILY_SATURATION, 1.0)
        rainfall_pressure = 0.5 * antecedent + 0.5 * pressure
        risk = round(0.35 * susceptibility + 0.65 * rainfall_pressure, 3)
        risk = max(0.0, min(risk, 1.0))
        series.append(
            {
                "date": dates[i] if i < len(dates) else "",
                "rainfall_mm": round(day_rain, 1),
                "risk": risk,
                "level": _level(risk),
            }
        )

    peak_72h = max(series[:3], key=lambda d: d["risk"], default=None)
    peak_7d = max(series, key=lambda d: d["risk"], default=None)

    trend = "steady"
    if series:
        first = series[0]["risk"]
        hi = max(d["risk"] for d in series)
        lo = min(d["risk"] for d in series)
        if hi - first >= 0.08:
            trend = "rising"
        elif first - lo >= 0.08:
            trend = "falling"

    # Short-horizon (6h / 24h / 72h) windows from Open-Meteo hourly precipitation.
    antecedent = min(rain["antecedent_3d_mm"] / ANTECEDENT_SATURATION, 1.0)
    hourly = _hourly_rainfall(lat, lon)
    horizons: list[dict] = []
    issued_at: str | None = None
    if hourly:
        issued_at = hourly["issued_at"]
        for h in _HORIZON_HOURS:
            mm = hourly["windows"].get(h, 0.0)
            window_sat = FORECAST_SATURATION * (h / 168.0)
            pressure = 0.4 * antecedent + 0.6 * min(mm / window_sat, 1.0)
            risk = round(max(0.0, min(0.35 * susceptibility + 0.65 * pressure, 1.0)), 3)
            horizons.append(
                {
                    "window": f"{h}h",
                    "hours": h,
                    "rainfall_mm": mm,
                    "risk": risk,
                    "level": _level(risk),
                }
            )

    return {
        "aoi": aoi.id,
        "name": aoi.name,
        "susceptibility": round(susceptibility, 3),
        "observed_3d_mm": rain["antecedent_3d_mm"],
        "issued_at": issued_at,
        "horizons": horizons,
        "series": series,
        "peak_72h": peak_72h,
        "peak_7d": peak_7d,
        "trend": trend,
        "source": "Open-Meteo global forecast",
        "model": "rainfall-trajectory-v1",
    }
