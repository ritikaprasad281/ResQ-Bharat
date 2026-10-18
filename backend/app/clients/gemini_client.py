"""Gemini client — turns structured flood metrics into plain-language, multilingual
briefings, answers what-if questions, and drafts citizen alert messages for flood-
prone locations across India. Always grounded strictly on the numbers we pass in."""

from __future__ import annotations

import json
import random
import time

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.config import settings

# Primary first; fall back to older flash tiers if one is overloaded (503) or
# unavailable (404). Keeps the demo responsive when the newest model spikes.
MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
]

# Vernacular languages matter for flood-prone India, where many at-risk
# residents do not read English. Each entry names the language in its own
# script so Gemini renders phone-readable text. Keys are the short subtag; the
# frontend sends full BCP 47 tags (e.g. "hi-IN") which we normalise below.
LANGUAGES = {
    "en": "English",
    "hi": "Hindi (हिंदी, in Devanagari script)",
    "bn": "Bengali (বাংলা, in Bengali script)",
    "mr": "Marathi (मराठी, in Devanagari script)",
    "te": "Telugu (తెలుగు, in Telugu script)",
    "ta": "Tamil (தமிழ், in Tamil script)",
    "gu": "Gujarati (ગુજરાતી, in Gujarati script)",
    "kn": "Kannada (ಕನ್ನಡ, in Kannada script)",
    "ml": "Malayalam (മലയാളം, in Malayalam script)",
    "pa": "Punjabi (ਪੰਜਾਬੀ, in Gurmukhi script)",
    # Retained regional varieties still accepted for backward compatibility.
    "bho": "Bhojpuri (भोजपुरी, in Devanagari script)",
    "mai": "Maithili (मैथिली, in Devanagari script)",
}

# Short subtags we advertise as fully supported UI + answer languages.
SUPPORTED_LANGUAGES = ["en", "hi", "bn", "mr", "te", "ta", "gu", "kn", "ml", "pa"]

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set in the environment/.env")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def normalize_language(language: str | None) -> str:
    """Reduce any BCP 47 tag (e.g. 'hi-IN', 'pa-Guru-IN') to a supported short
    subtag, falling back to English when the language is unknown."""
    if not language:
        return "en"
    short = language.strip().lower().replace("_", "-").split("-", 1)[0]
    return short if short in LANGUAGES else "en"


def _lang_clause(language: str) -> str:
    code = normalize_language(language)
    name = LANGUAGES.get(code, LANGUAGES["en"])
    if code == "en":
        return "Write in clear, simple English."
    return (
        f"Write the ENTIRE response in {name}. Use simple words an ordinary "
        "villager can understand. Keep all numbers in Arabic numerals (0-9)."
    )


# Transient overloads (503) and rate limits (429) are common when a model
# spikes, so retry the whole model list a few times with exponential backoff
# before surfacing an error. Models that return 404/permission errors are
# dropped from later passes since retrying them cannot help.
_MAX_PASSES = 3


def _generate_with_fallback(contents) -> str:
    client = _get_client()
    last_err: Exception | None = None
    dead_models: set[str] = set()
    for attempt in range(_MAX_PASSES):
        saw_transient = False
        for model in MODELS:
            if model in dead_models:
                continue
            try:
                resp = client.models.generate_content(model=model, contents=contents)
                text = (resp.text or "").strip()
                if text:
                    return text
                last_err = RuntimeError(f"{model} returned an empty response")
            except genai_errors.ServerError as exc:
                last_err = exc  # overloaded / 5xx -> transient, try next model
                saw_transient = True
            except genai_errors.ClientError as exc:
                last_err = exc
                status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
                if status == 429:
                    saw_transient = True  # rate limited -> back off and retry
                else:
                    dead_models.add(model)  # 404 / 400 / 403 -> stop retrying it
        if not saw_transient or len(dead_models) >= len(MODELS):
            break
        if attempt < _MAX_PASSES - 1:
            time.sleep(min(2 ** attempt, 8) + random.random())
    raise RuntimeError(f"All Gemini models failed after retries. Last error: {last_err}")


def _generate(prompt: str) -> str:
    return _generate_with_fallback(prompt)


def _generate_parts(parts: list) -> str:
    """Multimodal generate (e.g. image + text), with the same model fallback."""
    return _generate_with_fallback(parts)


def generate_briefing(context: dict, language: str = "en") -> str:
    """One-paragraph operational flood risk briefing from computed metrics."""
    prompt = (
        "You are a flood early-warning analyst for river basins across India. "
        "Using ONLY the JSON data below, write a concise, factual risk "
        "briefing (max 90 words) for disaster responders. State the current risk "
        "level, the 72-hour outlook and trend, population and buildings exposed, "
        "estimated damage, and the rainfall driver. Do not invent numbers. "
        "If `risk.updated_at` is present, note how fresh the rainfall data is. "
        "If `risk.data_quality.rainfall_complete` is false, say the rainfall feed "
        "is incomplete and the score may be understated. End with one clear "
        "recommended action. "
        + _lang_clause(language)
        + f"\n\nDATA:\n{json.dumps(context, indent=2)}"
    )
    return _generate(prompt)


def answer_question(context: dict, question: str, language: str = "en") -> str:
    """Answer a what-if / explanatory question grounded on the metrics."""
    prompt = (
        "You are a flood-risk analyst for river basins across India "
        "(north, northeast, central, west, east and south). Answer the user's "
        "question using ONLY the JSON context. The `area`, `region` and "
        "`basin` fields tell you which location and river system the user "
        "selected — reason about THAT place, never assume a northern river. "
        "Ground every figure in the context and never fabricate numbers.\n\n"
        "GROUNDING AND HONESTY RULES:\n"
        "- The `risk` object is a MODELLED estimate, not a measured gauge "
        "reading. Call it modelled risk, not an observed water level.\n"
        "- When you cite the risk or rainfall, state how fresh it is using "
        "`risk.updated_at` (e.g. 'as of that timestamp'). The historical and "
        "terrain layers in `risk.sources` are static, not live observations.\n"
        "- If `risk.data_quality.rainfall_complete` is false, warn that the "
        "rainfall feed is incomplete and the score may be understated.\n"
        "- Respect `coverage`: if the area is 'modelled' or 'partial', say the "
        "estimate is not yet validated against recorded floods there.\n"
        "- NEVER invent live measurements, river gauge levels, active alerts, "
        "evacuation orders, shelter or hospital names, capacities, road "
        "conditions, distances, or phone numbers. If asked for any of these, say "
        "you cannot confirm live operational data and point the user to local "
        "authorities or India's emergency number 112.\n"
        "- If the answer cannot be derived from the context, say so plainly.\n\n"
        "ANSWER FORMAT (use short Markdown, keep it tight):\n"
        "1. A direct one- or two-sentence answer.\n"
        "2. **Evidence** — the specific figures from the context, each with its "
        "freshness/timestamp where relevant.\n"
        "3. **What to do** — one or two practical actions.\n"
        "4. **Limitations** — data gaps, modelled-vs-measured caveats, coverage.\n"
        "5. **Sources** — name the `risk.sources` you relied on; add 'call 112' "
        "when it concerns immediate safety.\n"
        "Omit a section only if it genuinely does not apply. "
        + _lang_clause(language)
        + f"\n\nCONTEXT:\n{json.dumps(context, indent=2)}\n\nQUESTION: {question}"
    )
    return _generate(prompt)


def generate_alert_sms(context: dict, language: str = "en") -> str:
    """Short citizen-facing emergency alert, ready to push over SMS / WhatsApp."""
    prompt = (
        "You are an official flood early-warning service. Using ONLY the JSON "
        "data, write ONE short emergency alert message (UNDER 300 characters) to "
        "send to residents by SMS or WhatsApp. Include the place name, the risk "
        "level, the main reason (rainfall), and ONE clear safety instruction. No "
        "hashtags. No emojis except a single warning sign at the start. "
        + _lang_clause(language)
        + f"\n\nDATA:\n{json.dumps(context, indent=2)}"
    )
    return _generate(prompt)


# Public emergency-assistance assistant for flood-affected residents. Grounded
# in general disaster-safety practice; must NOT invent facility-specific data.
_ASSIST_SYSTEM = (
    "You are a public flood-safety assistant for residents of flood-prone North "
    "India. Your goal is to give practical, actionable safety guidance during "
    "floods and other emergencies. Follow these rules strictly:\n"
    "1. If the user describes an immediate threat to life (trapped, rising water "
    "inside the home, person swept away, medical emergency), lead with a short "
    "URGENT warning and tell them to call 112 (India's national emergency "
    "number) immediately, then give concise step-by-step safety actions.\n"
    "2. Prioritise clear, ordered safety steps over long explanations.\n"
    "3. NEVER invent specific hospital names, shelter names, shelter capacity or "
    "open/closed status, road conditions, distances, or phone numbers. If asked "
    "for a specific nearby facility, explain that you cannot confirm live "
    "facility data, and tell the user to use an official map/search for their "
    "stated area and to confirm with local authorities or by calling 112.\n"
    "4. You MAY state well-known official Indian emergency numbers: 112 "
    "(all-in-one emergency), 100 (police), 101 (fire), 102/108 (ambulance), "
    "1070 (state disaster control), 1077 (district disaster control), 1091 "
    "(women), 1098 (child). Do not invent other numbers.\n"
    "5. Never tell anyone to walk, swim or drive through floodwater. Never claim "
    "you have dispatched rescue or shared their location.\n"
    "6. Do not present higher ground as automatically safe; flood depth, access "
    "roads and local orders can change the risk — advise following local "
    "authority instructions.\n"
    "7. Keep answers concise and use simple words. Add a one-line reminder that "
    "official local instructions take priority over AI guidance."
)


def answer_emergency(
    question: str, location: str | None = None, language: str = "en"
) -> str:
    """Answer a public flood-emergency help question, safety-first and honest
    about the absence of live facility data."""
    loc = (location or "").strip()
    loc_clause = (
        f"The user's stated location/area is: {loc!r}. Use it only to tailor "
        "general guidance; do NOT fabricate facilities or distances for it."
        if loc
        else "The user has not shared a location. Give location-independent "
        "guidance and, where relevant, suggest they add a locality for more "
        "tailored advice."
    )
    prompt = (
        _ASSIST_SYSTEM
        + "\n\n"
        + loc_clause
        + "\n"
        + _lang_clause(language)
        + f"\n\nUSER QUESTION: {question}"
    )
    return _generate(prompt)


def generate_situation_report(context: dict, language: str = "en") -> str:
    """Train-wide flood situation report synthesised from the live ranking.

    Grounded strictly on the ranking we pass in (the same numbers the UI shows),
    so it adds interpretation and prioritisation — not new facts."""
    prompt = (
        "You are the lead analyst in a national flood control room. Using ONLY "
        "the JSON situational data below (a live ranking across all monitored "
        "areas), write a concise SITUATION REPORT for duty officers. Do not "
        "invent any area, number, or alert that is not in the data.\n\n"
        "STRUCTURE (short Markdown):\n"
        "1. **Headline** — one sentence: how many areas are under high/severe "
        "alert out of how many assessed, and the single most urgent location.\n"
        "2. **Priority areas** — a short bullet list of the top areas by "
        "probability, each as: name (region) — level, probability as a "
        "percentage, and the main rainfall driver (forecast_7d_mm / "
        "antecedent_3d_mm). Keep to the areas actually in the data.\n"
        "3. **Where to focus** — 2-3 practical coordination actions implied by "
        "the pattern (e.g. pre-position resources in the top cluster). Do not "
        "name specific teams, assets, shelters, or phone numbers.\n"
        "4. **Caveats** — note the data freshness from `generated_at`, that "
        "`assessed` may be fewer than `total` (some areas not scored this "
        "cycle), and that these are MODELLED risks, not gauge readings.\n"
        "Keep the whole report under 180 words. "
        + _lang_clause(language)
        + f"\n\nSITUATION DATA:\n{json.dumps(context, indent=2)}"
    )
    return _generate(prompt)


_PHOTO_SYSTEM = (
    "You are a flood-safety assistant analysing a photo a resident has shared "
    "of their surroundings during a possible flood. Assess ONLY what is visibly "
    "evident in the image and give safety guidance. Rules:\n"
    "1. If the image shows an immediate life threat (deep or fast-moving water, "
    "someone in the water, water entering a home, a person stranded), lead with "
    "a short URGENT line telling them to call 112 immediately.\n"
    "2. Estimate water depth ONLY in qualitative, reference-based terms (e.g. "
    "'around knee height against the parked vehicle'); NEVER give a precise "
    "centimetre/metre figure and say depth cannot be measured from a photo.\n"
    "3. Flag visible hazards: current/flow, submerged obstacles, proximity to "
    "electrical lines/poles/meters, open drains or manholes, contamination "
    "(sewage/fuel sheen), and unstable structures.\n"
    "4. NEVER invent a location, facility, road, distance, or phone number, and "
    "never claim you have alerted anyone or know what is outside the frame.\n"
    "5. If the photo does not actually show flooding or is unclear, say so "
    "honestly and give general preparedness advice instead of guessing.\n"
    "6. Keep it concise and ordered. End with a one-line reminder that local "
    "authority instructions and 112 take priority over this AI assessment."
)


def assess_flood_photo(
    image_bytes: bytes,
    mime_type: str,
    question: str | None = None,
    location: str | None = None,
    language: str = "en",
) -> str:
    """Multimodal: assess visible flood hazards in a user photo (Gemini vision)."""
    loc = (location or "").strip()
    q = (question or "").strip()
    loc_clause = (
        f"The resident says this is near: {loc!r}. Use it only to phrase general "
        "guidance; do not fabricate facilities or distances."
        if loc
        else "No location was provided; keep guidance location-independent."
    )
    q_clause = f"Their specific question: {q}" if q else (
        "They did not ask a specific question; give the most useful hazard "
        "assessment and safety steps for what the photo shows."
    )
    prompt = (
        _PHOTO_SYSTEM
        + "\n\n"
        + loc_clause
        + "\n"
        + q_clause
        + "\n"
        + _lang_clause(language)
        + "\n\nAnalyse the attached image now."
    )
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    return _generate_parts([image_part, prompt])
