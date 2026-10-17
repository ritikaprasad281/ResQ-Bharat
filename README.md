# ResQ Bharat — India Flood Intelligence

**Live app:** https://resqbharat.web.app

AI-powered, satellite-grounded flood intelligence for **river basins across India** — built for the **Google AI Builder Cup**.

ResQ Bharat fuses satellite radar, terrain, built-up surface, cropland, population and live weather into **flood-prone zone maps**, a **transparent live flood-risk score**, **rainfall forecasts**, **floodplain-development monitoring**, **agricultural (crop) loss estimates**, and a **multilingual Gemini assistant** — covering **100 study areas across all 28 states and 8 union territories**.

---

## Required stack (Google AI Builder Cup)

| Requirement | How it's used |
|---|---|
| **Gemini** | Plain-language flood briefings, grounded Q&A, multilingual emergency assistant, SMS/WhatsApp alerts (`gemini-3.8-flash` with a model fallback chain). |
| **Cloud Run** | Hosts the FastAPI backend (satellite + weather + AI compute). |
| **Firestore** | Cross-instance cache for flood-zone GeoJSON, susceptibility, rankings and model outputs. |
| **Firebase Hosting** | Serves the React single-page app. |
| **Pub/Sub** | Publishes citizen flood-alert dispatches. |

Plus **Google Earth Engine** for all server-side geospatial analysis (no local GIS stack required) and **Open-Meteo** for live/forecast rainfall.

---

## Features

- **Flood Intelligence** — Sentinel-1 SAR historical water frequency + terrain (SRTM/HAND) + JRC Global Surface Water, weighted into a 0–1 flood confidence bucketed into 4 risk classes, with live exposure and return-period damage scenarios.
- **Live flood risk** — a transparent, documented blend of rainfall pressure and terrain susceptibility:
  `risk = 0.35 × susceptibility + 0.65 × rainfall_pressure`, where
  `rainfall_pressure = 0.4 × antecedent(3-day) + 0.6 × forecast(7-day)`.
- **Rainfall & Risk Forecast** — 7-day daily outlook plus 6h/24h/72h short-range horizons from Open-Meteo.
- **Floodplain Development** — multi-signal (Dynamic World built-up + Sentinel-2 NDBI/NDVI) detection of new construction inside the flood corridor, with an explainable review-priority score.
- **Crop Loss** — ESA WorldCover cropland intersected with the modelled flood corridor to estimate exposed/damaged hectares and indicative ₹ loss by state cropping mix.
- **Regions needing attention** — live ranking of the highest-risk locations across all 100 study areas.
- **AI Help** — multilingual, safety-first emergency assistant (10 Indian languages) with verified helplines and real maps hand-off (never fabricated facility data).
- **Flood Safety** — offline-friendly preparedness guidance, emergency-kit checklist and family plan (stored locally on device).
- **Model confidence** — validates predicted zones against observed Sentinel-1 flooding for real documented flood events (precision / recall / IoU; `live` tier requires IoU ≥ 0.50).

---

## Coverage

- **100 study areas** across **28 states + 8 union territories** (36 regions), spanning the Ganga, Brahmaputra, Godavari, Krishna, Kaveri, Narmada, Mahanadi, Jhelum and many other basins.
- Honest coverage tiers surfaced in the UI: **live** (SAR-validated), **modelled** (runs on real per-area data but not yet validated), **partial** (steep/ephemeral/island terrain).

---

## Architecture

```
React + Vite + MapLibre (Firebase Hosting)
        │  REST
        ▼
FastAPI (Cloud Run · asia-south1)
        ├── Google Earth Engine  → zones, damage, new construction, crop loss, validation
        ├── Open-Meteo           → live/forecast rainfall (memoized)
        ├── Gemini               → briefings, grounded chat, multilingual emergency help
        ├── Pub/Sub              → citizen alert dispatch
        └── Firestore            → cached GeoJSON, susceptibility, rankings, model outputs
```

Performance: expensive work is cached in Firestore (cross-instance source of truth) and accelerated per-instance with a short-TTL in-process cache, parallel ranking/reads, and a stale-while-revalidate single-flight ranking cache. Risk-algorithm accuracy is preserved exactly (see `backend/tests/`).

---

## Project layout

```
backend/
  app/
    main.py              FastAPI app
    basins.py            100 study-area registry (states/UTs, rivers, coverage)
    config.py            settings (env-driven)
    ee_client.py         Earth Engine init
    ttl_cache.py         in-process TTL cache (per-instance acceleration)
    clients/             firestore / gemini / pubsub clients
    routers/api.py       all REST endpoints
    services/            risk, forecast, flood_zones, damage, impact,
                         new_construction, imagery, agri_loss, validation, live_risk
  scripts/               one-off cache-warming + latency probe
  tests/                 offline unit tests (registry, languages, agri-loss, perf)
frontend/
  src/
    pages/               Home, Flood Intelligence, Floodplain, Crop Loss,
                         Report, AI Help, Flood Safety, About
    components/          map, charts, panels, search, language, voice
    i18n/ + locales/     10 Indian languages
    api.ts, types.ts, lib.ts
docs/                    detailed technical approach & methodology
```

---

## Local development

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env   # then set GCP_PROJECT and GEMINI_API_KEY
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8080
```

Requires Google Cloud ADC with the Earth Engine scope:

```powershell
gcloud auth application-default login --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/earthengine"
```

Run the offline tests:

```powershell
.\.venv\Scripts\python.exe -m tests.test_registry
.\.venv\Scripts\python.exe -m tests.test_perf
.\.venv\Scripts\python.exe -m tests.test_agri_loss
```

### Frontend

```powershell
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Set `VITE_API_BASE` in `frontend/.env` to the backend URL (defaults to `http://localhost:8080`).

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/api/pilots` | List study areas (region, coverage, validation) |
| GET | `/api/zones?pilot=` | Flood-prone zone GeoJSON (cached) |
| GET | `/api/risk?pilot=` | Live flood-risk score + rainfall + methodology |
| GET | `/api/forecast?pilot=` | 7-day + 6h/24h/72h rainfall & risk forecast |
| GET | `/api/damage?pilot=` | Exposure + return-period damage estimates |
| GET | `/api/new-construction?pilot=` | Floodplain development detection |
| GET | `/api/imagery?pilot=` | Before/after satellite imagery |
| GET | `/api/agri-loss?pilot=` | Per-area crop-loss estimate |
| GET | `/api/agri-loss-summary` | Nationwide crop-loss rollup |
| GET | `/api/impact` | Nationwide exposure rollup |
| GET | `/api/top-risk?limit=` | Highest live-risk locations |
| GET | `/api/alerts` | Locations under high/severe alert |
| GET | `/api/events` | Historical flood events for validation |
| GET | `/api/validate?pilot=&event=` | Precision / recall / IoU vs observed flooding |
| GET/POST | `/api/reports` | Citizen hazard reports |
| POST | `/api/ai/briefing` | Gemini operational briefing |
| POST | `/api/ai/chat` | Grounded Gemini Q&A |
| POST | `/api/ai/alert` | Citizen alert (SMS/WhatsApp copy + Pub/Sub dispatch) |
| POST | `/api/ai/assist` | Multilingual emergency assistant |

---

## Methodology & data sources

Core datasets: **Sentinel-1 SAR**, **JRC Global Surface Water v1.4** (1984–2021), **SRTM**, **GHSL built-up surface**, **WorldPop**, **ESA WorldCover**, **Dynamic World**, **Open-Meteo**. See [docs/ganga-flood-approach.md](docs/ganga-flood-approach.md) for the full approach, data-source table, confidence metrics and design rationale.

---

## Disclaimer

Estimates are derived from public satellite products, live weather forecasts and published depth-damage/crop-loss assumptions. Outputs are for decision support and demonstration only and must be validated before any operational or emergency-management use. In an emergency, call **112**.
