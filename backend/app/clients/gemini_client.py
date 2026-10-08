"""Gemini client — turns structured flood metrics into plain-language briefings
and answers what-if questions. Always grounded on the numbers we pass in."""

from __future__ import annotations

import json

from google import genai
from google.genai import errors as genai_errors

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

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set in the environment/.env")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _generate(prompt: str) -> str:
    client = _get_client()
    last_err: Exception | None = None
    for model in MODELS:
        try:
            resp = client.models.generate_content(model=model, contents=prompt)
            return (resp.text or "").strip()
        except (genai_errors.ServerError, genai_errors.ClientError) as exc:
            last_err = exc  # overloaded or unavailable -> try next model
            continue
    raise RuntimeError(f"All Gemini models failed. Last error: {last_err}")


def generate_briefing(context: dict) -> str:
    """One-paragraph operational flood risk briefing from computed metrics."""
    prompt = (
        "You are a flood early-warning analyst for the Ganga basin in India. "
        "Using ONLY the JSON data below, write a concise, factual risk briefing "
        "(max 90 words) for disaster responders. State the risk level, buildings "
        "and population exposed, estimated damage, and the rainfall driver. Do not "
        "invent numbers. End with one clear recommended action.\n\n"
        f"DATA:\n{json.dumps(context, indent=2)}"
    )
    return _generate(prompt)


def answer_question(context: dict, question: str) -> str:
    """Answer a what-if / explanatory question grounded on the metrics."""
    prompt = (
        "You are a flood risk analyst. Answer the user's question using ONLY the "
        "JSON context. If the answer is not derivable, say so. Be concise and "
        "quantitative where possible. Do not fabricate figures.\n\n"
        f"CONTEXT:\n{json.dumps(context, indent=2)}\n\nQUESTION: {question}"
    )
    return _generate(prompt)
