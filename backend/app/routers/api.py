"""API routes for the Ganga flood service."""

from __future__ import annotations

import threading
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.basins import (
    PILOTS,
    get_aoi,
    get_region,
    get_coverage,
    get_basin,
    get_validation as get_validation_metrics,
)
from app.clients import firestore_client as fs
from app.clients import gemini_client
from app.clients import pubsub_client
from app.services.agri_loss import compute_agri_loss, summarize_agri_loss
from app.services.damage import estimate_damage
from app.services.flood_zones import compute_flood_zones_geojson
from app.services.forecast import compute_forecast
from app.services.impact import compute_impact
from app.services.imagery import compute_imagery
from app.services.live_risk import compute_live_risk, rank_live_risk
from app.services.new_construction import analyze_new_construction
from app.services.validation import EVENTS, validate_event

router = APIRouter()


# The 10 Indian languages advertised as fully supported for the UI and AI
# answers. `uiReady` reflects a shipped translation bundle; speech (STT/TTS)
# availability is device-dependent and detected at runtime in the browser.
LANGUAGE_REGISTRY = [
    {"code": "en-IN", "short": "en", "englishName": "English", "nativeName": "English", "script": "Latin", "uiReady": True},
    {"code": "hi-IN", "short": "hi", "englishName": "Hindi", "nativeName": "हिंदी", "script": "Devanagari", "uiReady": True},
    {"code": "bn-IN", "short": "bn", "englishName": "Bengali", "nativeName": "বাংলা", "script": "Bengali", "uiReady": True},
    {"code": "mr-IN", "short": "mr", "englishName": "Marathi", "nativeName": "मराठी", "script": "Devanagari", "uiReady": True},
    {"code": "te-IN", "short": "te", "englishName": "Telugu", "nativeName": "తెలుగు", "script": "Telugu", "uiReady": True},
    {"code": "ta-IN", "short": "ta", "englishName": "Tamil", "nativeName": "தமிழ்", "script": "Tamil", "uiReady": True},
    {"code": "gu-IN", "short": "gu", "englishName": "Gujarati", "nativeName": "ગુજરાતી", "script": "Gujarati", "uiReady": True},
    {"code": "kn-IN", "short": "kn", "englishName": "Kannada", "nativeName": "ಕನ್ನಡ", "script": "Kannada", "uiReady": True},
    {"code": "ml-IN", "short": "ml", "englishName": "Malayalam", "nativeName": "മലയാളം", "script": "Malayalam", "uiReady": True},
    {"code": "pa-IN", "short": "pa", "englishName": "Punjabi", "nativeName": "ਪੰਜਾਬੀ", "script": "Gurmukhi", "uiReady": True},
]


@router.get("/languages")
def list_languages() -> dict:
    """Capability registry of supported languages. `uiReady` is a build-time
    fact (translation bundle shipped); spoken input/output support is detected
    at runtime by the browser and is therefore not asserted here."""
    return {
        "default": "en-IN",
        "fallback": "en",
        "languages": LANGUAGE_REGISTRY,
    }


@router.get("/pilots")
def list_pilots() -> dict:
    return {
        "pilots": [
            {
                "id": a.id,
                "name": a.name,
                "tributary": a.tributary,
                "basin": get_basin(a.id),
                "region": get_region(a.id),
                "coverage": get_coverage(a.id),
                "validation": get_validation_metrics(a.id),
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


@router.get("/new-construction")
def get_new_construction(
    pilot: str,
    refresh: bool = False,
    dw_delta: float | None = None,
    ndbi_delta: float | None = None,
    ndvi_drop: float | None = None,
) -> dict:
    """Newly-built construction in the flood corridor with risk estimates.

    Optional threshold overrides (dw_delta/ndbi_delta/ndvi_drop) run a live,
    uncached calibration pass for the development diagnostics panel.
    """
    aoi = _aoi(pilot)
    overrides = {
        k: v
        for k, v in (
            ("dw_delta", dw_delta),
            ("ndbi_delta", ndbi_delta),
            ("ndvi_drop", ndvi_drop),
        )
        if v is not None
    }
    cache_path = f"pilots/{pilot}/cache/new_construction"
    if not refresh and not overrides:
        cached = fs.get_doc(cache_path)
        if cached and cached.get("aoi") and cached.get("algorithm_version"):
            return cached
    result = analyze_new_construction(aoi, overrides or None)
    if not overrides:
        try:
            fs.set_doc(cache_path, result)
        except Exception:
            pass
    return result


@router.get("/agri-loss")
def get_agri_loss(pilot: str, refresh: bool = False) -> dict:
    """Flood-related agricultural crop-loss estimate for a study area.

    Exposed cropland is measured from satellite land cover intersected with the
    modelled flood corridor; damaged area and monetary loss apply documented
    assumptions. Cached in Firestore because the Earth Engine pass is expensive.
    """
    aoi = _aoi(pilot)
    cache_path = f"pilots/{pilot}/cache/agri_loss"
    if not refresh:
        cached = fs.get_doc(cache_path)
        if cached and cached.get("exposed_cropland_ha") is not None:
            return cached
    result = compute_agri_loss(aoi)
    try:
        fs.set_doc(cache_path, result)
    except Exception:
        pass
    return result


@router.get("/agri-loss-summary")
def get_agri_loss_summary() -> dict:
    """Portfolio rollup of cached agricultural-loss estimates across study areas."""
    return summarize_agri_loss()


@router.get("/imagery")
def get_imagery(pilot: str, refresh: bool = False) -> dict:
    """Before/after Sentinel-2 true-colour composites for the two analysis
    windows. Rendered once, stored in Cloud Storage, and served from a stable
    public URL cached in Firestore. Pass ``refresh=true`` to re-render."""
    return compute_imagery(_aoi(pilot), refresh=refresh)


@router.get("/risk")
def get_risk(pilot: str) -> dict:
    aoi = _aoi(pilot)
    result = compute_live_risk(aoi)
    try:
        fs.set_doc(f"pilots/{pilot}/live/risk", result)
    except Exception:
        pass
    return result


@router.get("/forecast")
def get_forecast(pilot: str) -> dict:
    """7-day predictive risk trajectory with the 72-hour peak."""
    return compute_forecast(_aoi(pilot))


@router.get("/impact")
def get_impact() -> dict:
    """Portfolio-level social-impact rollup across all monitored districts."""
    return compute_impact()


@router.get("/top-risk")
def get_top_risk(limit: int = 3) -> dict:
    """Live ranking of the highest flood-risk zones across the basin."""
    ranking = _cached_ranking()
    all_items = ranking.get("all", [])
    return {
        "top": all_items[:limit],
        "all": all_items,
        "assessed": ranking.get("assessed", len(all_items)),
        "total": ranking.get("total", len(all_items)),
        "generated_at": ranking.get("generated_at"),
    }


@router.get("/alerts")
def get_alerts() -> dict:
    """Places currently under a high/severe flood alert (empty if none)."""
    ranking = _cached_ranking()
    alerts = [
        item
        for item in ranking.get("all", [])
        if item.get("level") in ("high", "severe")
    ]
    alerts.sort(key=lambda x: x.get("probability", 0.0), reverse=True)
    return {
        "generated_at": ranking.get("generated_at"),
        "assessed": ranking.get("assessed", len(ranking.get("all", []))),
        "total": ranking.get("total", len(ranking.get("all", []))),
        "count": len(alerts),
        "alerts": alerts,
    }


# A full basin ranking is expensive (live rainfall for every zone). It is cached
# in Firestore (cross-instance source of truth) and mirrored in-process, with a
# short freshness TTL plus a longer stale window. When stale-but-usable we serve
# the last good result immediately and refresh in the background (single-flight,
# so a burst of requests never stampedes into N concurrent recomputes).
_RANKING_TTL_SEC = 5 * 60
_RANKING_STALE_SEC = 30 * 60
_ranking_lock = threading.Lock()
_ranking_mem: dict | None = None


def _ranking_age(doc: dict | None) -> float | None:
    if not doc or not doc.get("generated_at"):
        return None
    try:
        gen = datetime.fromisoformat(doc["generated_at"])
        return (datetime.now(timezone.utc) - gen).total_seconds()
    except Exception:
        return None


def _recompute_ranking() -> dict:
    global _ranking_mem
    result = rank_live_risk(limit=len(PILOTS))
    result["generated_at"] = datetime.now(timezone.utc).isoformat()
    _ranking_mem = result
    try:
        fs.set_doc("cache/ranking", result)
    except Exception:
        pass
    return result


def _background_refresh_ranking() -> None:
    # Single-flight: if a refresh already holds the lock, skip this one.
    if not _ranking_lock.acquire(blocking=False):
        return
    try:
        _recompute_ranking()
    finally:
        _ranking_lock.release()


def _cached_ranking() -> dict:
    global _ranking_mem
    cached = _ranking_mem
    if cached is None:
        try:
            cached = fs.get_doc("cache/ranking")
        except Exception:
            cached = None
        if cached:
            _ranking_mem = cached

    age = _ranking_age(cached)
    if cached is not None and age is not None and age < _RANKING_TTL_SEC:
        return cached
    if cached is not None and age is not None and age < _RANKING_STALE_SEC:
        # Serve stale immediately, refresh out of band (stale-while-revalidate).
        threading.Thread(target=_background_refresh_ranking, daemon=True).start()
        return cached

    # Cold or too stale: compute synchronously, but single-flight so concurrent
    # callers coalesce onto one recompute instead of stampeding.
    with _ranking_lock:
        fresh_age = _ranking_age(_ranking_mem)
        if _ranking_mem is not None and fresh_age is not None and fresh_age < _RANKING_TTL_SEC:
            return _ranking_mem
        return _recompute_ranking()


class ReportRequest(BaseModel):
    pilot: str | None = None
    location: str = Field(..., min_length=1, max_length=120)
    hazard_type: str = Field(..., min_length=1, max_length=60)
    severity: str = Field(..., min_length=1, max_length=20)
    description: str = Field("", max_length=1000)
    reporter_name: str = Field("Anonymous", max_length=80)
    contact: str = Field("", max_length=120)
    lat: float | None = None
    lon: float | None = None


@router.post("/reports")
def submit_report(req: ReportRequest) -> dict:
    """Citizen hazard report during a live event."""
    data = req.model_dump()
    data["status"] = "reported"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    try:
        doc_id = fs.add_doc("reports", data)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Could not save report: {e}")
    return {"id": doc_id, **data}


@router.get("/reports")
def list_reports(limit: int = 50) -> dict:
    try:
        reports = fs.query_collection("reports", order_by="created_at", limit=limit)
    except Exception:
        reports = []
    return {"count": len(reports), "reports": reports}


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
    language: str = "en"
    # Preferred answer language (full BCP 47 from the UI); falls back to `language`.
    response_language: str | None = None


def _answer_language(req) -> str:
    """Resolve the effective answer language from either the new
    `response_language` field or the legacy `language` field."""
    chosen = getattr(req, "response_language", None) or getattr(req, "language", None)
    return gemini_client.normalize_language(chosen)


@router.post("/ai/briefing")
def ai_briefing(req: BriefingRequest) -> dict:
    aoi = _aoi(req.pilot)
    risk = compute_live_risk(aoi)
    forecast = compute_forecast(aoi)
    context = {
        "area": aoi.name,
        "region": get_region(aoi.id),
        "basin": get_basin(aoi.id),
        "coverage": get_coverage(aoi.id),
        "risk": risk,
        "damage": estimate_damage(aoi),
        "forecast_peak_72h": forecast.get("peak_72h"),
        "forecast_peak_7d": forecast.get("peak_7d"),
        "trend": forecast.get("trend"),
    }
    language = _answer_language(req)
    text = gemini_client.generate_briefing(context, language)
    try:
        fs.set_doc(f"pilots/{req.pilot}/live/briefing", {"text": text})
    except Exception:
        pass
    return {"pilot": req.pilot, "language": language, "briefing": text}


class ChatRequest(BaseModel):
    pilot: str
    question: str
    language: str = "en"
    response_language: str | None = None
    # Optional voice/context signals from the frontend (telemetry only).
    detected_language: str | None = None
    ui_language: str | None = None
    input_mode: str | None = None
    transcription_confidence: float | None = None


@router.post("/ai/chat")
def ai_chat(req: ChatRequest) -> dict:
    aoi = _aoi(req.pilot)
    context = {
        "area": aoi.name,
        "region": get_region(aoi.id),
        "basin": get_basin(aoi.id),
        "coverage": get_coverage(aoi.id),
        "risk": compute_live_risk(aoi),
        "damage": estimate_damage(aoi),
        "forecast": compute_forecast(aoi),
    }
    language = _answer_language(req)
    answer = gemini_client.answer_question(context, req.question, language)
    return {
        "pilot": req.pilot,
        "question": req.question,
        "language": language,
        "answer": answer,
    }


class AlertRequest(BaseModel):
    pilot: str
    language: str = "en"
    response_language: str | None = None


@router.post("/ai/alert")
def ai_alert(req: AlertRequest) -> dict:
    """Draft a localized citizen alert and dispatch it as an event (Pub/Sub)."""
    aoi = _aoi(req.pilot)
    risk = compute_live_risk(aoi)
    forecast = compute_forecast(aoi)
    context = {
        "area": aoi.name,
        "risk_level": risk["level"],
        "probability": risk["probability"],
        "rainfall_forecast_7d_mm": risk["rainfall"]["forecast_7d_mm"],
        "peak_72h": forecast.get("peak_72h"),
    }
    language = _answer_language(req)
    message = gemini_client.generate_alert_sms(context, language)
    event = {
        "pilot": req.pilot,
        "area": aoi.name,
        "language": language,
        "level": risk["level"],
        "probability": risk["probability"],
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    dispatch = pubsub_client.publish_alert(event)
    event["dispatch"] = dispatch
    try:
        fs.add_doc("alert_dispatches", event)
    except Exception:
        pass
    return event


class AssistRequest(BaseModel):
    question: str
    language: str = "en"
    response_language: str | None = None
    location: str | None = None
    detected_language: str | None = None
    ui_language: str | None = None
    input_mode: str | None = None
    transcription_confidence: float | None = None


@router.post("/ai/assist")
def ai_assist(req: AssistRequest) -> dict:
    """Public, location-aware flood-safety assistant for affected residents.

    Not tied to a pilot basin; grounds the answer in general disaster-safety
    practice and is explicitly instructed not to fabricate facility data.
    """
    language = _answer_language(req)
    answer = gemini_client.answer_emergency(req.question, req.location, language)
    return {
        "question": req.question,
        "language": language,
        "location": req.location,
        "answer": answer,
    }


class SituationRequest(BaseModel):
    language: str = "en"
    response_language: str | None = None
    limit: int = 8


@router.post("/ai/situation")
def ai_situation(req: SituationRequest) -> dict:
    """AI situation report: synthesises the live cross-area ranking into a
    decision-ready SITREP for control-room officers. Grounded strictly on the
    same ranking the UI shows (interpretation, not new facts)."""
    ranking = _cached_ranking()
    all_items = ranking.get("all", [])
    limit = max(1, min(req.limit, 20))
    top = [
        {
            "name": it.get("name"),
            "region": get_region(it.get("id", "")),
            "level": it.get("level"),
            "probability": it.get("probability"),
            "forecast_7d_mm": it.get("forecast_7d_mm"),
            "antecedent_3d_mm": it.get("antecedent_3d_mm"),
        }
        for it in all_items[:limit]
    ]
    alert_count = sum(
        1 for it in all_items if it.get("level") in ("high", "severe")
    )
    context = {
        "generated_at": ranking.get("generated_at"),
        "assessed": ranking.get("assessed", len(all_items)),
        "total": ranking.get("total", len(all_items)),
        "high_or_severe_count": alert_count,
        "top_areas": top,
    }
    language = _answer_language(req)
    report = gemini_client.generate_situation_report(context, language)
    return {
        "language": language,
        "generated_at": ranking.get("generated_at"),
        "assessed": context["assessed"],
        "total": context["total"],
        "high_or_severe_count": alert_count,
        "report": report,
    }


# Reject oversized uploads early; Gemini vision needs only a modest image.
_MAX_PHOTO_BYTES = 8 * 1024 * 1024
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}


@router.post("/ai/photo")
async def ai_photo(
    file: UploadFile = File(...),
    question: str | None = Form(None),
    location: str | None = Form(None),
    language: str = Form("en"),
    response_language: str | None = Form(None),
) -> dict:
    """Multimodal flood-photo assessment (Gemini vision): a resident uploads a
    photo of their surroundings and gets an honest, safety-first hazard
    assessment. Never fabricates depth figures, facilities, or locations."""
    mime = (file.content_type or "").lower()
    if mime not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Please upload a JPEG, PNG, WEBP or HEIC image.",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image upload.")
    if len(data) > _MAX_PHOTO_BYTES:
        raise HTTPException(
            status_code=413, detail="Image too large (max 8 MB)."
        )
    language = gemini_client.normalize_language(response_language or language)
    try:
        answer = gemini_client.assess_flood_photo(
            data, mime, question, location, language
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Vision analysis failed: {e}")
    return {
        "language": language,
        "location": location,
        "question": question,
        "assessment": answer,
    }



def _aoi(pilot: str):
    try:
        return get_aoi(pilot)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
