"""API routes for the Ganga flood service."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.basins import PILOTS, get_aoi
from app.clients import firestore_client as fs
from app.clients import gemini_client
from app.services.damage import estimate_damage
from app.services.flood_zones import compute_flood_zones_geojson
from app.services.live_risk import compute_live_risk
from app.services.validation import EVENTS, validate_event

router = APIRouter()


@router.get("/pilots")
def list_pilots() -> dict:
    return {
        "pilots": [
            {
                "id": a.id,
                "name": a.name,
                "tributary": a.tributary,
                "bbox": a.bbox,
                "center": a.center,
            }
            for a in PILOTS.values()
        ]
    }


@router.get("/zones")
def get_zones(pilot: str, refresh: bool = False) -> dict:
    aoi = _aoi(pilot)
    cache_path = f"pilots/{pilot}/cache/zones"
    if not refresh:
        cached = fs.get_doc(cache_path)
        if cached and cached.get("geojson"):
            return cached["geojson"]
    geojson = compute_flood_zones_geojson(aoi)
    try:
        fs.set_doc(cache_path, {"geojson": geojson})
    except Exception:
        pass  # caching is best-effort; never fail the request on it
    return geojson


@router.get("/damage")
def get_damage(pilot: str) -> dict:
    return estimate_damage(_aoi(pilot))


@router.get("/risk")
def get_risk(pilot: str) -> dict:
    aoi = _aoi(pilot)
    result = compute_live_risk(aoi)
    try:
        fs.set_doc(f"pilots/{pilot}/live/risk", result)
    except Exception:
        pass
    return result


@router.get("/events")
def list_events() -> dict:
    return {"events": [{"id": k, **v} for k, v in EVENTS.items()]}


@router.get("/validate")
def get_validation(pilot: str, event: str) -> dict:
    try:
        return validate_event(_aoi(pilot), event)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


class BriefingRequest(BaseModel):
    pilot: str


@router.post("/ai/briefing")
def ai_briefing(req: BriefingRequest) -> dict:
    aoi = _aoi(req.pilot)
    context = {
        "area": aoi.name,
        "risk": compute_live_risk(aoi),
        "damage": estimate_damage(aoi),
    }
    text = gemini_client.generate_briefing(context)
    try:
        fs.set_doc(f"pilots/{req.pilot}/live/briefing", {"text": text})
    except Exception:
        pass
    return {"pilot": req.pilot, "briefing": text}


class ChatRequest(BaseModel):
    pilot: str
    question: str


@router.post("/ai/chat")
def ai_chat(req: ChatRequest) -> dict:
    aoi = _aoi(req.pilot)
    context = {
        "area": aoi.name,
        "risk": compute_live_risk(aoi),
        "damage": estimate_damage(aoi),
    }
    answer = gemini_client.answer_question(context, req.question)
    return {"pilot": req.pilot, "question": req.question, "answer": answer}


def _aoi(pilot: str):
    try:
        return get_aoi(pilot)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
