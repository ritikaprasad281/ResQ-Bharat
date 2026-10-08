"""Pilot areas of interest (AOIs) for the Ganga basin flood project.

Bounding boxes are [west, south, east, north] in WGS84. Kept small so Earth
Engine vector exports stay fast for the live demo.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Aoi:
    id: str
    name: str
    tributary: str
    bbox: tuple[float, float, float, float]
    center: tuple[float, float]  # [lon, lat] for map fly-to


PILOTS: dict[str, Aoi] = {
    "kosi": Aoi(
        id="kosi",
        name="Kosi — North Bihar (Supaul–Saharsa)",
        tributary="Kosi",
        bbox=(86.40, 25.55, 87.25, 26.60),
        center=(86.80, 26.10),
    ),
    "patna": Aoi(
        id="patna",
        name="Ganga main stem — Patna",
        tributary="Ganga",
        bbox=(84.90, 25.50, 85.40, 25.78),
        center=(85.14, 25.61),
    ),
}

DEFAULT_PILOT = "kosi"


def get_aoi(pilot_id: str) -> Aoi:
    aoi = PILOTS.get(pilot_id)
    if aoi is None:
        raise KeyError(
            f"Unknown pilot '{pilot_id}'. Valid: {', '.join(PILOTS)}"
        )
    return aoi
