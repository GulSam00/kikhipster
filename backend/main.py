import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.music import router as music_router
from services.music_api import SpotifyMusicService
from services.spotify_auth import SpotifyTokenManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0))
    token_manager = SpotifyTokenManager(
        client_id=settings.spotify_client_id,
        client_secret=settings.spotify_client_secret,
    )
    app.state.http_client = http_client
    app.state.token_manager = token_manager
    app.state.music_service = SpotifyMusicService(
        client=http_client, token_manager=token_manager
    )
    logger.info("Spotify music service initialized (market=%s)", settings.spotify_default_market)
    yield
    await http_client.aclose()
    logger.info("HTTP client closed")


app = FastAPI(title="kikhipster API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(music_router)


@app.get("/")
def root():
    return {"status": "ok", "message": "kikhipster API"}
