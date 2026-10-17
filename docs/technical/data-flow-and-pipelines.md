# Data Flow and Pipelines

This page describes how each major feature turns raw data into a rendered answer.
All pipelines share two principles: **cache the expensive parts** and **degrade
honestly** when data is missing.

## Flood-risk pipeline

The live risk score blends static terrain susceptibility (Earth Engine) with
live rainfall pressure (Open-Meteo).

```mermaid
flowchart TB
    Start["GET /api/risk?pilot=ID"]
    AOI["Resolve AOI from basins.PILOTS"]
    SusCache{"Susceptibility<br/>cached in Firestore?"}
    EE["Earth Engine:<br/>flood-zone confidence mean"]
    Rain["Open-Meteo:<br/>3-day observed + 7-day forecast"]
    Norm["Normalise sub-scores<br/>(saturating 0-1)"]
    Blend["risk = 0.35*susceptibility<br/>+ 0.65*rainfall_pressure"]
    Level["Classify level<br/>(low/medium/high/severe)"]
    Out["Return risk + rainfall + sources<br/>+ methodology + data_quality"]

    Start --> AOI --> SusCache
    SusCache -->|yes| Rain
    SusCache -->|no| EE --> Rain
    EE -.cache value.-> SusCache
    Rain --> Norm --> Blend --> Level --> Out
```

Normalisation and weights are fixed and published verbatim in the API response
(`methodology`): see [Flood-risk methodology](flood-risk-methodology.md).

The cross-area ranking (`/api/top-risk`, `/api/alerts`) runs `compute_live_risk`
for every area concurrently (bounded thread pool, 12 workers), skips any area
that fails (never zeroing it), and reports `assessed` vs `total`. The ranking is
cached in Firestore with a stale-while-revalidate, single-flight refresh policy
(see [Performance and reliability](performance-and-reliability.md)).

## Satellite change-detection pipeline (floodplain development)

```mermaid
flowchart TB
    Req["GET /api/new-construction?pilot=ID"]
    Region["Analysis rectangle around AOI center"]
    DW["Dynamic World built-probability<br/>baseline vs recent"]
    S2["Sentinel-2 NDBI gain + NDVI loss"]
    Mask["Exclude water / river channel / sandbars"]
    Sig["Combine signals -> confidence 1-3"]
    Corr["Keep within 1.5 km river corridor"]
    Vect["Vectorise + de-noise + min-area filter"]
    Prio["Review-priority score per candidate"]
    Est["Estimate buildings / population / asset value"]
    Out["GeoJSON + stage areas + disclaimer"]

    Req --> Region --> DW --> Sig
    Region --> S2 --> Sig
    Region --> Mask --> Sig
    Sig --> Corr --> Vect --> Prio --> Est --> Out
```

Details and thresholds: [Floodplain development](floodplain-development.md).
Results are cached in Firestore per area (`pilots/{id}/cache/new_construction`).

## Crop-loss pipeline

```mermaid
flowchart TB
    Req["GET /api/agri-loss?pilot=ID"]
    Flood["Flood-zone confidence mask<br/>(>= 0.3) within river corridor"]
    Crop["ESA WorldCover cropland (class 40)"]
    Exp["Exposed cropland = cropland ∩ flood corridor"]
    Dmg["Damaged area = exposed × damage fraction"]
    Alloc["Allocate damaged ha by regional crop mix"]
    Val["Value by yield × price per crop"]
    Sev["Severity (worse of share / value)"]
    Out["Estimate + ranges + assumptions + disclaimer"]

    Req --> Flood --> Exp
    Req --> Crop --> Exp
    Exp --> Dmg --> Alloc --> Val --> Sev --> Out
```

Exposed cropland is a satellite measurement; damaged area and monetary loss are
documented **assumptions**. See [Agriculture crop loss](agriculture-crop-loss.md).

## Before/after imagery pipeline (Cloud Storage cache)

```mermaid
flowchart TB
    Req["GET /api/imagery?pilot=ID"]
    Cache{"Firestore cache<br/>stored == true?"}
    EE["Earth Engine:<br/>Sentinel-2 median composites"]
    Thumb["Download thumbnail PNG via httpx"]
    GCS["Upload PNG to Cloud Storage<br/>(stable public URL)"]
    Store["Cache URLs in Firestore<br/>(only if no upload failed)"]
    Out["Return baseline + recent image URLs"]

    Req --> Cache
    Cache -->|yes| Out
    Cache -->|no| EE --> Thumb --> GCS --> Store --> Out
```

Rendering once to Cloud Storage turns a multi-second Earth Engine recompute into
a sub-200ms cached response and avoids expired thumbnail URLs. Pass `refresh=true`
to force a re-render. Honest `available: false` is preserved when a window has no
usable scenes.

## Gemini request/response sequence

```mermaid
sequenceDiagram
    participant FE as React SPA
    participant API as FastAPI
    participant Svc as Domain services
    participant GEM as Gemini

    FE->>API: POST /api/ai/chat {pilot, question, language}
    API->>Svc: Gather grounded context (risk, damage, forecast)
    Svc-->>API: Structured JSON context
    API->>GEM: Prompt = grounding rules + JSON + question
    loop Model fallback chain
        GEM-->>API: Answer (or ServerError/ClientError -> next model)
    end
    API-->>FE: {answer, language}
    FE-->>FE: Render Markdown + optional read-aloud
```

Gemini only ever receives numbers computed by the backend; it is instructed not
to invent live measurements, facilities, or contact details. See
[AI and Gemini integration](ai-and-gemini-integration.md).

## Failure / fallback workflow

```mermaid
flowchart TB
    Call["Service call"]
    EEf{"Earth Engine<br/>available?"}
    OMf{"Open-Meteo<br/>responds?"}
    GEMf{"Gemini model<br/>responds?"}
    PSf{"Pub/Sub<br/>publishes?"}

    Call --> EEf
    EEf -->|no, at startup| Warn["Log warning, keep /health up"]
    OMf -->|retry x3, then fail| Degrade["Flag missing rainfall days<br/>(score may be understated)"]
    GEMf -->|try next model| Chain["Fallback model chain"]
    GEMf -->|all fail| GErr["Raise RuntimeError -> 5xx to client"]
    PSf -->|exception| Sim["Return simulated receipt<br/>(alert still saved to Firestore)"]
```

Specific fallbacks:

- **Earth Engine init failure** at startup is logged but non-fatal so `/health`
  stays reachable.
- **Open-Meteo** requests retry up to 3 times; missing days are flagged via
  `data_quality.rainfall_complete` rather than silently treated as zero.
- **Gemini** iterates a model fallback chain; only if every model fails does the
  request error.
- **Pub/Sub** publish failures return a simulated dispatch receipt; the alert is
  still generated and recorded in Firestore.
- **Firestore cache writes** are best-effort and wrapped in try/except so a cache
  failure never fails the request.
