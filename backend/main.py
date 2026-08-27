import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401 — Alembic이 Base.metadata에서 테이블 인식하도록 등록
from config import settings
from database import SessionLocal
from routers.auth import router as auth_router
from routers.comment import router as comment_router
from routers.comment import topster_router as topster_comment_router
from routers.play import router as play_router
from routers.like import router as like_router
from routers.music import router as music_router
from routers.topster import router as topster_router
from routers.tournament import router as tournament_router
from services.music_api import ITunesMusicService
from services.music_cache import purge_expired

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0))
    app.state.http_client = http_client
    app.state.music_service = ITunesMusicService(client=http_client)
    logger.info("iTunes music service initialized (market=%s)", settings.music_default_market)

    # 만료된 캐시 행 정리. 만료분은 다시 조회되면 덮어써지지만 **다시 조회되지 않는 행은
    # 영원히 남는다**. 별도 스케줄러를 두지 않고 기동 시 한 번 턴다 — 배포 원칙상 이 서비스는
    # 상시 구동이 아니라 실습 단위로 띄웠다 내리므로(CLAUDE.md) 기동이 곧 주기다.
    # 실패해도 서비스는 떠야 하므로 예외를 삼킨다.
    db = SessionLocal()
    try:
        await run_in_threadpool(purge_expired, db)
    except Exception:
        logger.exception("music_cache 정리 실패 — 서비스 기동은 계속한다")
    finally:
        db.close()

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
app.include_router(topster_comment_router)
app.include_router(like_router)
app.include_router(tournament_router)
app.include_router(play_router)


@app.get("/")
def root():
    return {"status": "ok", "message": "kikhipster API"}
