# Configuration and Environment

Backend configuration is centralised in `backend/app/config.py` using
`pydantic-settings`, which reads from environment variables and an optional
`.env` file. Frontend configuration uses Vite environment variables.

## Backend settings

| Setting | Env var | Default | Purpose |
|---|---|---|---|
| `gcp_project` | `GCP_PROJECT` | `ganga-flood` | GCP project for EE, Firestore, Storage, Pub/Sub |
| `gemini_api_key` | `GEMINI_API_KEY` | `""` | Gemini API key (required for AI features) |
| `pubsub_alert_topic` | `PUBSUB_ALERT_TOPIC` | `flood-alerts` | Pub/Sub topic for alert dispatch |
| `imagery_bucket` | `IMAGERY_BUCKET` | `ganga-flood-imagery` | Cloud Storage bucket for composites |
| `cors_origins` | `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Comma-separated allowed origins |

`cors_origin_list` splits `cors_origins` on commas. The env file is read from
`.env` (UTF-8); unknown keys are ignored.

> **Secrets:** `GEMINI_API_KEY` is the only secret here. It must be provided via
> environment/secret manager and is never logged or returned in responses. On
> Cloud Run, Earth Engine/Firestore/Storage/Pub/Sub authenticate via the attached
> service account, not an embedded key.

## Frontend settings

| Env var | Purpose |
|---|---|
| `VITE_API_BASE` | Backend base URL (defaults to `http://localhost:8080` in `api.ts`) |
| `resq.uiLanguage.v1` (localStorage) | Persisted UI language selection |

Set `VITE_API_BASE` in `frontend/.env` to point the SPA at the deployed backend.

## Local development

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env   # then set GCP_PROJECT and GEMINI_API_KEY
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8080
```

Earth Engine needs Application Default Credentials with the right scopes:

```powershell
gcloud auth application-default login --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/earthengine"
```

### Frontend

```powershell
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Dependencies

- **Backend** (`requirements.txt`): fastapi, uvicorn[standard], python-multipart,
  earthengine-api, google-cloud-firestore, google-cloud-pubsub,
  google-cloud-storage, google-genai, httpx, python-dotenv, pydantic,
  pydantic-settings. `python-multipart` is required for the multipart
  `POST /api/ai/photo` upload.
- **Frontend** (`package.json`): react, react-dom, react-router-dom, maplibre-gl,
  react-map-gl, recharts, i18next (+ react-i18next, browser-languagedetector),
  react-markdown, remark-gfm, framer-motion, lucide-react; built with Vite +
  TypeScript + Tailwind.

> Env-var names above match `backend/app/config.py`. If a `.env.example` exists,
> keep it aligned with this table. Never commit a real `GEMINI_API_KEY`.
