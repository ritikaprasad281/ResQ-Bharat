"""FastAPI entrypoint for the Ganga basin flood prediction service."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.ee_client import init_ee
from app.routers.api import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_ee()
    except Exception as e:  # keep the app up so /health is reachable for debugging
        print(f"[warn] Earth Engine init failed at startup: {e}")
    yield


app = FastAPI(title="Ganga Flood API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "project": settings.gcp_project}
