# API Reference

Base URL (production): the Cloud Run service. All application routes are mounted
under `/api`. The frontend sets the base via `VITE_API_BASE`. Responses are JSON.

> This reference is derived from `backend/app/routers/api.py`. Field names reflect
> the actual service responses. Do not assume fields not listed here.

## Health

### `GET /health`

Liveness check. Returns `{ "status": "ok", "project": "<gcp_project>" }`. Not
under `/api`.

## Catalog & languages

### `GET /api/languages`

Capability registry of supported languages. Returns `default` (`en-IN`),
`fallback` (`en`), and a `languages` array with `code`, `short`, `englishName`,
`nativeName`, `script`, `uiReady`. `uiReady` is a build-time fact (translation
bundle shipped); spoken input/output is detected at runtime in the browser and is
not asserted here.

### `GET /api/pilots`

Lists all study areas. Each item: `id`, `name`, `tributary`, `basin`, `region`,
`coverage` (`live`/`modelled`/`partial`), `validation` (SAR metrics or null),
`bbox`, `center`.

## Geospatial

### `GET /api/zones?pilot=<id>&refresh=<bool>`

Flood-prone zone GeoJSON (`FeatureCollection<Polygon>` with `risk_class`, `mean`,
`area_km2`). Cached in Firestore; `refresh=true` recomputes. 404 if the pilot is
unknown.

### `GET /api/risk?pilot=<id>`

Live flood-risk score. Includes `probability`, `level`, `susceptibility`,
`rainfall`, `model`, `updated_at`, `sources`, `methodology`, and `data_quality`
(`rainfall_complete`, `days_available`, `days_expected`).

### `GET /api/forecast?pilot=<id>`

7-day daily outlook plus 6h/24h/72h horizons. Includes `series`, `horizons`,
`peak_72h`, `peak_7d`, `trend`, `issued_at`.

### `GET /api/damage?pilot=<id>`

Exposure and return-period damage. Includes `buildings_exposed`,
`building_area_m2`, `population_exposed`, `cost_per_m2_inr`, and `scenarios`
(1in10/1in25/1in100 with depth, damage factor, est. damage, life-risk index).

### `GET /api/new-construction?pilot=<id>&refresh=<bool>&dw_delta=&ndbi_delta=&ndvi_drop=`

Floodplain construction change detection. Threshold overrides trigger a live,
uncached calibration pass. Returns candidate GeoJSON, per-stage areas, estimates,
and a disclaimer. Cached in Firestore (without overrides).

### `GET /api/imagery?pilot=<id>&refresh=<bool>`

Before/after Sentinel-2 composites. Returns `baseline` and `recent` sides, each
with `label`, `available`, `url` (stable Cloud Storage URL or null), `scenes`,
`cloud_filtered`. Rendered once to Cloud Storage; `refresh=true` re-renders.

### `GET /api/agri-loss?pilot=<id>&refresh=<bool>`

Per-area crop-loss estimate. Includes measured `exposed_cropland_ha`, estimated
`damaged_cropland_ha` (+ ranges), `estimated_loss_inr`/`_crore` (+ ranges),
per-crop breakdown, `severity`, `sources`, `methodology`, `disclaimer`.

### `GET /api/agri-loss-summary`

Nationwide rollup of cached crop-loss estimates (cache-only; fast).

## Rollups & rankings

### `GET /api/impact`

Nationwide exposure rollup (districts/rivers monitored, new buildings in
corridor, people newly exposed, asset value, current high-risk count). Cache-only.

### `GET /api/top-risk?limit=<n>`

Highest live-risk locations. Returns `top`, `all`, `assessed`, `total`,
`generated_at`. Served from the cached ranking (stale-while-revalidate).

### `GET /api/alerts`

Locations under `high`/`severe` alert (sorted by probability). Returns
`alerts`, `count`, `assessed`, `total`, `generated_at`.

## Events & validation

### `GET /api/events`

Documented flood events usable for validation (`id`, `label`, `start`, `end`).

### `GET /api/validate?pilot=<id>&event=<event_id>`

Predicted zones vs observed Sentinel-1 flooding. Returns `precision`, `recall`,
`iou`, and TP/FP/FN pixel counts. 404 for unknown pilot or event.

## Citizen reports

### `GET /api/reports?limit=<n>`

Lists recent citizen hazard reports (newest first).

### `POST /api/reports`

Submits a hazard report. Body: `location` (required), `hazard_type` (required),
`severity` (required), optional `pilot`, `description`, `reporter_name`,
`contact`, `lat`, `lon`. Stored in Firestore; returns the created document. 503 if
the write fails.

## Generative AI

All AI endpoints accept a `language` and optional `response_language` (full BCP 47
from the UI, preferred). The effective answer language is normalised to a
supported short subtag.

### `POST /api/ai/briefing`

Body: `pilot`, `language`, `response_language?`. Returns `{ pilot, language,
briefing }`. Grounded on live risk, damage and forecast for the area.

### `POST /api/ai/chat`

Body: `pilot`, `question`, `language`, `response_language?`, plus optional
telemetry (`detected_language`, `ui_language`, `input_mode`,
`transcription_confidence`). Returns `{ pilot, question, language, answer }`.

### `POST /api/ai/alert`

Body: `pilot`, `language`, `response_language?`. Drafts a localized citizen alert,
publishes it to Pub/Sub (best-effort), records it in Firestore, and returns the
event including a `dispatch` receipt (`published` or `simulated`).

### `POST /api/ai/assist`

Body: `question`, `language`, `response_language?`, optional `location` and voice
telemetry. Public flood-safety assistant not tied to an area; grounded in general
safety practice, explicitly not fabricating facility data.

### `POST /api/ai/situation`

Body: `language`, `response_language?`, `limit` (default 8, capped 1–20). Returns
`{ language, generated_at, assessed, total, high_or_severe_count, report }`.
Synthesises the cached live ranking into a SITREP.

### `POST /api/ai/photo`

**Multipart form** (not JSON). Fields: `file` (image), optional `question`,
`location`, `language`, `response_language`. Server validates MIME
(`image/jpeg|png|webp|heic` else **415**), non-empty body (**400**), ≤ 8 MB
(**413**); a vision failure returns **502**. Returns `{ language, location,
question, assessment }`.

## Error conventions

- Unknown pilot → **404** with a message listing valid ids.
- Report write failure → **503**.
- Photo validation failures → **415 / 413 / 400**; vision failure → **502**.
- Cache write failures never fail a request (best-effort).
