from __future__ import annotations

from typing import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services.music_cache import get_cached, put_cached
from schemas.music import (
    AlbumSummary,
    AlbumWithTracks,
    ArtistDetail,
    SearchAlbumsResponse,
    SearchArtistsResponse,
    SearchTracksResponse,
    TrackSearchItem,
)

router = APIRouter(prefix="/api/music", tags=["music"])

# 월드컵 풀이 최대 512개라 그만큼은 한 번에 받을 수 있어야 한다.
# 실제 iTunes 호출은 services/music_api.py 가 150개씩 청크로 쪼개 처리한다.
MAX_LOOKUP_IDS = 512


def _parse_ids(raw: str) -> list[str]:
    ids = [i.strip() for i in raw.split(",") if i.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="ids가 비어 있습니다")
    if len(ids) > MAX_LOOKUP_IDS:
        raise HTTPException(
            status_code=400, detail=f"한 번에 최대 {MAX_LOOKUP_IDS}개까지 조회할 수 있습니다"
        )
    # 중복은 응답에서 어차피 한 번만 나오므로 미리 걷어낸다(순서 보존).
    return list(dict.fromkeys(ids))


def _cache_hits(cached: dict[str, dict], model: type[BaseModel]) -> dict[str, dict]:
    """응답 스키마로 검증되는 캐시만 남긴다.

    매핑 로직이나 스키마가 바뀌면 예전에 적어둔 payload가 더는 스키마에 안 맞을 수 있다.
    그대로 돌려주면 FastAPI 직렬화에서 500이 나므로, 검증 실패는 캐시 미스로 취급해
    iTunes에서 다시 받아오고 덮어쓴다 — 스스로 낫는다.
    """
    ok = {}
    for item_id, payload in cached.items():
        try:
            model.model_validate(payload)
        except Exception:
            continue
        ok[item_id] = payload
    return ok


async def _lookup_with_cache(
    db: Session,
    item_type: str,
    ids: list[str],
    fetch: Callable[[list[str]], Awaitable[list[dict]]],
    model: type[BaseModel],
) -> list[dict]:
    """캐시에 있는 건 DB에서, 없는 것만 iTunes에서 가져와 요청 순서대로 합친다.

    이 라우트들은 async라 동기 Session을 그대로 부르면 이벤트 루프가 막힌다 —
    DB 작업은 run_in_threadpool 로 뺀다.
    """
    hits, known_missing = await run_in_threadpool(get_cached, db, item_type, ids)
    cached = _cache_hits(hits, model)

    # 캐시에 없고, "없다"고 확인된 것도 아닌 ID만 iTunes에 묻는다.
    to_fetch = [i for i in ids if i not in cached and i not in known_missing]

    fetched: list[dict] = []
    if to_fetch:
        fetched = await fetch(to_fetch)
        await run_in_threadpool(put_cached, db, item_type, fetched, to_fetch)

    merged = dict(cached)
    for item in fetched:
        merged[str(item["id"])] = item

    # 요청 순서를 지키고, 끝내 못 찾은 ID는 뺀다 — 캐시 도입 전과 같은 동작이다.
    return [merged[i] for i in ids if i in merged]



@router.get("/search/artists", response_model=SearchArtistsResponse)
async def search_artists(
    request: Request,
    q: str = Query(..., min_length=1, description="검색어"),
    market: str = Query("KR", description="마켓 코드 (예: KR, JP, US)"),
    limit: int = Query(20, ge=1, le=50, description="최대 결과 수"),
):
    service = request.app.state.music_service
    return await service.search_artists(q, market=market, limit=limit)


@router.get("/search/albums", response_model=SearchAlbumsResponse)
async def search_albums(
    request: Request,
    q: str = Query(..., min_length=1, description="검색어"),
    market: str = Query("KR", description="마켓 코드 (예: KR, JP, US)"),
    limit: int = Query(20, ge=1, le=50, description="최대 결과 수"),
):
    service = request.app.state.music_service
    return await service.search_albums(q, market=market, limit=limit)


@router.get("/artists/{artist_id}", response_model=ArtistDetail)
async def get_artist_detail(request: Request, artist_id: str):
    service = request.app.state.music_service
    return await service.get_artist_detail(artist_id)


@router.get("/artists/{artist_id}/albums", response_model=list[AlbumSummary])
async def get_artist_albums(
    request: Request,
    artist_id: str,
    market: str = Query("KR", description="마켓 코드"),
    limit: int = Query(50, ge=1, le=50, description="최대 결과 수"),
):
    service = request.app.state.music_service
    return await service.get_artist_albums(artist_id, market=market, limit=limit)


@router.get("/albums/{album_id}/tracks", response_model=AlbumWithTracks)
async def get_album_tracks(
    request: Request,
    album_id: str,
    market: str = Query("KR", description="마켓 코드"),
):
    service = request.app.state.music_service
    return await service.get_album_tracks(album_id, market=market)


@router.get("/artists/{artist_id}/top-tracks", response_model=list[TrackSearchItem])
async def get_artist_top_tracks(
    request: Request,
    artist_id: str,
    market: str = Query("KR", description="마켓 코드"),
):
    service = request.app.state.music_service
    return await service.get_artist_top_tracks(artist_id, market=market)


@router.get("/search/tracks", response_model=SearchTracksResponse)
async def search_tracks(
    request: Request,
    q: str = Query(..., min_length=1, description="검색어"),
    market: str = Query("KR", description="마켓 코드 (예: KR, JP, US)"),
    limit: int = Query(20, ge=1, le=50, description="최대 결과 수"),
):
    service = request.app.state.music_service
    return await service.search_tracks(q, market=market, limit=limit)


@router.get("/tracks", response_model=list[TrackSearchItem])
async def get_tracks_by_ids(
    request: Request,
    ids: str = Query(..., description=f"콤마로 구분된 iTunes 트랙 ID (최대 {MAX_LOOKUP_IDS}개)"),
    db: Session = Depends(get_db),
):
    """트랙 ID 목록을 한 번에 조회한다. 존재하지 않는 ID는 결과에서 빠진다.

    DB 캐시를 먼저 보고 없는 것만 iTunes에서 받아온다.
    """
    track_ids = _parse_ids(ids)
    service = request.app.state.music_service
    return await _lookup_with_cache(
        db, "track", track_ids, service.get_tracks_by_ids, TrackSearchItem
    )


@router.get("/albums", response_model=list[AlbumSummary])
async def get_albums_by_ids(
    request: Request,
    ids: str = Query(..., description=f"콤마로 구분된 iTunes 앨범 ID (최대 {MAX_LOOKUP_IDS}개)"),
    db: Session = Depends(get_db),
):
    """앨범 ID 목록을 한 번에 조회한다. 앨범 월드컵의 풀·대진, 탑스터 커버 표시용.

    DB 캐시를 먼저 보고 없는 것만 iTunes에서 받아온다.
    """
    album_ids = _parse_ids(ids)
    service = request.app.state.music_service
    return await _lookup_with_cache(
        db, "album", album_ids, service.get_albums_by_ids, AlbumSummary
    )
