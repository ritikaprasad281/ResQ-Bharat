# Architecture Overview

ResQ Bharat is a two-tier web application: a React single-page app (SPA) served
as static files, talking over REST to a stateless FastAPI backend. The backend
orchestrates Google Earth Engine, Open-Meteo, Gemini, Firestore, Cloud Storage
and Pub/Sub. There is no self-hosted database or GIS stack — all geospatial
computation runs server-side in Earth Engine, and durable state lives in managed
Google Cloud services.

## Design goals

- **Satellite-grounded, honest outputs.** Every figure carries provenance and a
  coverage/confidence label; the code never fabricates gauge readings or alerts.
- **Fast after warm-up.** Expensive Earth Engine passes are cached in Firestore
  (cross-instance) and accelerated per-instance with short-TTL in-process caches.
- **Stateless backend.** Any Cloud Run instance can serve any request; shared
  state is in Firestore and Cloud Storage.
- **Graceful degradation.** Missing rainfall days, absent imagery, Pub/Sub
  failures and overloaded Gemini models all degrade honestly instead of breaking.

## High-level architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        SPA["React + Vite + MapLibre SPA"]
    end

    subgraph Hosting["Firebase Hosting (site: resqbharat)"]
        Static["Static JS/CSS/HTML bundle"]
    end

    subgraph Run["Cloud Run · asia-south1 (ganga-flood-api)"]
        FastAPI["FastAPI app (app.main)"]
        Routers["routers/api.py"]
        Services["services/*"]
        Clients["clients/*"]
    end

    subgraph Google["External + Google Cloud services"]
        EE["Google Earth Engine"]
        OM["Open-Meteo API"]
        GEM["Gemini (google-genai)"]
        FS["Firestore"]
        GCS["Cloud Storage bucket"]
        PS["Pub/Sub topic"]
    end

    SPA --> Static
    SPA -->|"REST /api/*"| FastAPI
    FastAPI --> Routers --> Services --> Clients
    Services --> EE
    Services --> OM
    Clients --> GEM
    Clients --> FS
    Services --> GCS
    Clients --> PS
```

## End-to-end request flow

A typical "show me the risk for this area" interaction:

```mermaid
sequenceDiagram
    participant U as User
    participant FE as React SPA
    participant API as FastAPI (Cloud Run)
    participant FS as Firestore
    participant EE as Earth Engine
    participant OM as Open-Meteo

    U->>FE: Select study area
    FE->>API: GET /api/risk?pilot=patna
    API->>FS: Read cached susceptibility
    alt Susceptibility cached
        FS-->>API: value
    else Not cached
        API->>EE: Compute flood-zone susceptibility
        EE-->>API: mean confidence
        API->>FS: Cache susceptibility
    end
    API->>OM: Fetch 3-day observed + 7-day forecast rainfall
    OM-->>API: daily precipitation
    API->>API: risk = 0.35*susceptibility + 0.65*rainfall_pressure
    API-->>FE: Risk JSON (score, level, sources, methodology)
    FE-->>U: Render score, map, methodology panel
```

## Layered responsibilities

| Layer | Location | Responsibility |
|---|---|---|
| Presentation | `frontend/src/pages`, `frontend/src/components` | Rendering, map, charts, forms, i18n |
| API client | `frontend/src/api.ts` | Typed fetch wrappers, timeouts, GET de-duplication |
| HTTP routing | `backend/app/routers/api.py` | Endpoint definitions, request validation, caching policy |
| Domain services | `backend/app/services/*` | Risk, forecast, zones, damage, crop loss, imagery, validation |
| Integration clients | `backend/app/clients/*` | Firestore, Gemini, Pub/Sub, Cloud Storage |
| Area registry | `backend/app/basins.py` | 100 study areas, regions, coverage tiers, validation metrics |
| Config | `backend/app/config.py` | Environment-driven settings |

See [System components](system-components.md) for a component-level breakdown and
[Data flow and pipelines](data-flow-and-pipelines.md) for the per-feature pipelines.

## Deployment topology

```mermaid
flowchart LR
    Dev["Developer workstation"]
    GH["GitHub repo"]
    subgraph GCP["Google Cloud project: ganga-flood"]
        CR["Cloud Run: ganga-flood-api<br/>asia-south1"]
        FS["Firestore"]
        GCS["Cloud Storage:<br/>ganga-flood-imagery"]
        PS["Pub/Sub: flood-alerts"]
        EE["Earth Engine"]
    end
    FBH["Firebase Hosting:<br/>resqbharat"]

    Dev -->|git push| GH
    Dev -->|gcloud run deploy --source| CR
    Dev -->|firebase deploy --only hosting| FBH
    CR --> FS
    CR --> GCS
    CR --> PS
    CR --> EE
```

Deployment specifics (regions, service accounts, commands) are in
[Deployment and infrastructure](deployment-and-infrastructure.md).

## Key non-functional properties

- **Statelessness & caching:** [Performance and reliability](performance-and-reliability.md)
- **Secrets & data handling:** [Security and privacy](security-and-privacy.md)
- **Honest coverage tiers:** [Flood-risk methodology](flood-risk-methodology.md)
