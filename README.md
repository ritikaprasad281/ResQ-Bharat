# Ganga Flood Intelligence

AI-powered flood prediction, risk mapping, and damage estimation for the **Ganga river basin** — built for the **Google AI Builder Cup**.

The platform fuses satellite radar, terrain, population, built-up surface, and live weather data to produce **flood-prone zone maps**, a **calibrated live flood-risk score**, and **monetary + life-risk damage estimates**, with a **Gemini**-generated operational briefing and a grounded Q&A assistant.

> ⚠️ AI-generated analysis — validate before operational use. This is an early-warning decision-support tool, not a guaranteed forecast.

---

## Required stack (Google AI Builder Cup)

| Requirement | How it's used |
|---|---|
| **Gemini** | Generates plain-language flood briefings + answers grounded what-if questions (`gemini-3.8-flash` with fallback chain). |
| **Cloud Run** | Hosts the FastAPI backend (satellite + weather + AI compute). |
| **Firestore** | Caches computed flood-zone GeoJSON and model outputs for fast demo loads. |
| **Firebase Hosting** | Serves the React single-page app. |

Plus **Google Earth Engine** for all server-side geospatial analysis (no local GIS stack required).

---

## What it does

- **Flood-prone zone mapping** — Sentinel-1 SAR historical water frequency + low-lying terrain proxy + JRC permanent-water exclusion, weighted into a 0–1 flood confidence and bucketed into 4 risk classes.
- **Live flood risk** — blends Open-Meteo rainfall (3-day antecedent + 7-day forecast) with static susceptibility into a calibrated 0–1 score (low / medium / high / severe).
- **Damage estimation** — GHSL built-up surface + WorldPop exposure under 1-in-10 / 1-in-25 / 1-in-100 depth-damage scenarios, in ₹ crore + a life-risk index.
- **Model confidence** — validates predicted zones against observed Sentinel-1 flooding for past Bihar flood events (precision / recall / IoU).
- **Gemini briefing + chat** — a concise responder briefing and a grounded Q&A assistant, strictly conditioned on the computed metrics.

Pilot stretches: **Kosi (North Bihar, Supaul–Saharsa)** and **Ganga main stem at Patna**.

---

## Architecture

```
React + MapLibre (Firebase Hosting)
        │  REST
        ▼
FastAPI (Cloud Run)
        ├── Google Earth Engine  → zones, damage exposure, validation
        ├── Open-Meteo           → live/forecast rainfall
        ├── Gemini               → briefings + grounded chat
        └── Firestore            → cached zone GeoJSON + outputs
```

---

## Project layout

```
backend/     FastAPI app (Earth Engine, Firestore, Gemini clients + services)
frontend/    React + Vite + TypeScript + MapLibre UI
docs/        Detailed technical approach & methodology
scripts/     Earth Engine connectivity test
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
| GET | `/api/pilots` | List pilot basins |
| GET | `/api/zones?pilot=` | Flood-prone zone GeoJSON (cached) |
| GET | `/api/risk?pilot=` | Live flood-risk score + rainfall |
| GET | `/api/damage?pilot=` | Exposure + scenario damage estimates |
| GET | `/api/events` | Historical flood events for validation |
| GET | `/api/validate?pilot=&event=` | Precision / recall / IoU vs observed flooding |
| POST | `/api/ai/briefing` | Gemini operational briefing |
| POST | `/api/ai/chat` | Grounded Gemini Q&A |

---

## Methodology & data sources

See [docs/ganga-flood-approach.md](docs/ganga-flood-approach.md) for the full technical approach, data-source table, confidence metrics, and design rationale.

---

## Disclaimer

Estimates are derived from public satellite products and published depth-damage curves. Outputs are for decision support and demonstration only and must be validated before any operational or emergency-management use.
