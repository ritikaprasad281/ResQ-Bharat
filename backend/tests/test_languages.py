"""Deterministic checks for the multilingual language registry and the
BCP 47 → short-subtag normalization used by the Gemini client. No network or
Earth Engine calls — pure static validation. Run standalone:
``python -m tests.test_languages``.
"""

from __future__ import annotations

from app.clients import gemini_client as gc
from app.routers.api import LANGUAGE_REGISTRY

# The 10 Indian languages the product commits to fully supporting in the UI.
EXPECTED_SHORTS = {"en", "hi", "bn", "mr", "te", "ta", "gu", "kn", "ml", "pa"}


def test_registry_has_all_ten_languages() -> None:
    shorts = {entry["short"] for entry in LANGUAGE_REGISTRY}
    assert shorts == EXPECTED_SHORTS, f"registry shorts mismatch: {shorts}"
    assert len(LANGUAGE_REGISTRY) == 10


def test_registry_entries_are_complete() -> None:
    required = {"code", "short", "englishName", "nativeName", "script", "uiReady"}
    for entry in LANGUAGE_REGISTRY:
        assert required <= set(entry), f"missing fields in {entry}"
        assert entry["uiReady"] is True
        assert entry["code"].endswith("-IN"), f"expected BCP47 -IN: {entry['code']}"
        assert entry["code"].split("-", 1)[0] == entry["short"]
        assert entry["nativeName"].strip(), f"empty nativeName: {entry}"


def test_gemini_knows_every_supported_language() -> None:
    for short in EXPECTED_SHORTS:
        assert short in gc.LANGUAGES, f"gemini_client missing language: {short}"
    assert set(gc.SUPPORTED_LANGUAGES) == EXPECTED_SHORTS


def test_normalize_language_strips_region_and_script() -> None:
    assert gc.normalize_language("hi-IN") == "hi"
    assert gc.normalize_language("pa-Guru-IN") == "pa"
    assert gc.normalize_language("TA-in") == "ta"
    assert gc.normalize_language("bn_IN") == "bn"
    assert gc.normalize_language("en") == "en"


def test_normalize_language_falls_back_to_english() -> None:
    assert gc.normalize_language(None) == "en"
    assert gc.normalize_language("") == "en"
    assert gc.normalize_language("xx-YY") == "en"
    assert gc.normalize_language("klingon") == "en"


def test_lang_clause_targets_the_right_script() -> None:
    # English keeps a plain-English instruction.
    assert "English" in gc._lang_clause("en-IN")
    # A vernacular clause must name the language and demand a full translation.
    clause = gc._lang_clause("ta-IN")
    assert "Tamil" in clause
    assert "ENTIRE response" in clause
    # Unknown languages degrade to English rather than erroring.
    assert "English" in gc._lang_clause("zz")


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"\nAll {len(fns)} language checks passed. "
          f"languages={len(LANGUAGE_REGISTRY)}")
