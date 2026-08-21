import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401 — Alembic이 Base.metadata에서 테이블 인식하도록 등록
from config import settings
from routers.auth import router as auth_router
from routers.comment import router as comment_router
from routers.like import router as like_router
from routers.music import router as music_router
from routers.topster import router as topster_router
from routers.tournament import router as tournament_router
from services.music_api import ITunesMusicService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0))
    app.state.http_client = http_client
    app.state.music_service = ITunesMusicService(client=http_client)
    logger.info("iTunes music service initialized (market=%s)", settings.music_default_market)
    yield
    await http_client.aclose()
    logger.info("HTTP client closed")


app = FastAPI(title="kikhipster API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(music_router)
app.include_router(topster_router)
app.include_router(comment_router)
app.include_router(like_router)
app.include_router(tournament_router)


@app.get("/")
def root():
    return {"status": "ok", "message": "kikhipster API"}
