from __future__ import annotations

from typing import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services.music_cache import (
    get_cached,
    get_cached_one,
    put_cached,
    put_cached_one,
)
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


class _AlbumListPayload(BaseModel):
    """목록 응답을 캐시에 넣기 위한 래퍼. JSONB 컬럼이라 최상위가 dict여야 한다."""

    items: list[AlbumSummary]


class _TrackListPayload(BaseModel):
    items: list[TrackSearchItem]


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


async def _detail_with_cache(
    db: Session,
    item_type: str,
    key: str,
    fetch: Callable[[], Awaitable[dict]],
    model: type[BaseModel],
) -> dict:
    """단건 조회 경로의 캐시 래퍼. 배치 경로와 같은 테이블을 쓰되 item_type 으로 갈린다.

    TTL은 인자로 받지 않는다 — `ITEM_TYPE_TTL_DAYS` 가 정본이고 정리(purge)도 같은 표를 본다.

    캐시를 스키마로 한 번 검증하는 이유는 배치 경로와 같다 — 매핑이나 스키마가 바뀌면
    예전 payload가 더는 안 맞고, 그대로 돌려주면 직렬화에서 500이 난다. 검증에 실패하면
    미스로 취급해 다시 받아오고 덮어쓴다.
    """
    cached = await run_in_threadpool(get_cached_one, db, item_type, key)
    if cached is not None:
        try:
            model.model_validate(cached)
            return cached
        except Exception:
            pass

    data = await fetch()
    await run_in_threadpool(put_cached_one, db, item_type, key, data)
    return data


async def _warm_item_cache(db: Session, item_type: str, items: list[dict]) -> None:
    """검색 결과를 배치 캐시에 미리 적어 둔다.

    검색 응답의 항목은 배치 조회 응답과 **같은 스키마**(AlbumSummary / TrackSearchItem)라
    그대로 재사용할 수 있다. 탑스터·월드컵을 만드는 흐름이 늘 "검색 → 고르기 → 저장 →
    목록에서 커버 배치 조회"라서, 여기서 적어 두면 저장 직후의 배치 조회가 캐시에 맞는다.

    `requested` 를 비워 넘기는 게 중요하다 — 넘기면 검색에 안 걸린 ID를 tombstone 으로
    남기는데, 여기서는 "요청한 ID" 자체가 없다.
    """
    if not items:
        return
    await run_in_threadpool(put_cached, db, item_type, items, [])



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
    include_singles: bool = Query(
        False, description='iTunes가 " - Single" / " - EP" 로 표기한 항목을 포함할지'
    ),
    db: Session = Depends(get_db),
):
    """앨범 검색. 기본적으로 싱글·EP는 제외한다 — 탑스터·월드컵에 담을 '앨범'을 고르는 자리다.

    ID 배치 조회(`/albums?ids=`)에는 이 필터를 걸지 않는다. 이미 저장된 탑스터가 싱글을
    담고 있으면 그 커버가 안 나와 화면이 깨진다.

    검색 자체는 캐시하지 않는다(질의어마다 키가 갈려 적중률이 낮다). 대신 결과로 받은
    개별 앨범을 배치 캐시에 적어 둔다 — 사용자가 곧 그중 몇 개를 골라 저장하기 때문이다.
    """
    service = request.app.state.music_service
    result = await service.search_albums(
        q, market=market, limit=limit, include_singles=include_singles
    )
    await _warm_item_cache(db, "album", result.get("items", []))
    return result


@router.get("/artists/{artist_id}", response_model=ArtistDetail)
async def get_artist_detail(request: Request, artist_id: str, db: Session = Depends(get_db)):
    """아티스트 상세. 이름·장르는 사실상 불변이라 길게 캐시한다."""
    service = request.app.state.music_service
    return await _detail_with_cache(
        db,
        "artist_detail",
        artist_id,
        lambda: service.get_artist_detail(artist_id),
        ArtistDetail,
    )


@router.get("/artists/{artist_id}/albums", response_model=list[AlbumSummary])
async def get_artist_albums(
    request: Request,
    artist_id: str,
    market: str = Query("KR", description="마켓 코드"),
    limit: int = Query(50, ge=1, le=50, description="최대 결과 수"),
    include_singles: bool = Query(
        False, description='iTunes가 " - Single" / " - EP" 로 표기한 항목을 포함할지'
    ),
    db: Session = Depends(get_db),
):
    """아티스트의 앨범 목록. 앨범 검색과 같은 기준으로 싱글·EP를 기본 제외한다.

    **응답을 가르는 파라미터를 전부 캐시 키에 넣는다.** market·limit·include_singles 중
    하나라도 빠지면 필터를 끈 요청이 켠 결과를 받는 식으로 섞인다.
    TTL이 짧은 쪽(LISTING)인 이유는 신보가 나오면 목록이 실제로 바뀌기 때문이다.
    """
    service = request.app.state.music_service
    key = f"{artist_id}:{market}:{limit}:{int(include_singles)}"

    async def fetch() -> dict:
        albums = await service.get_artist_albums(
            artist_id, market=market, limit=limit, include_singles=include_singles
        )
        # 캐시 payload는 dict여야 한다(JSONB 컬럼) — 목록은 한 겹 감싼다.
        return {"items": albums}

    cached = await _detail_with_cache(
        db, "artist_albums", key, fetch, _AlbumListPayload
    )
    items = cached["items"]
    # 목록 항목도 배치 캐시에 적어 둔다 — 아티스트 페이지에서 고른 앨범이 곧 탑스터로 간다.
    await _warm_item_cache(db, "album", items)
    return items


@router.get("/albums/{album_id}/tracks", response_model=AlbumWithTracks)
async def get_album_tracks(
    request: Request,
    album_id: str,
    market: str = Query("KR", description="마켓 코드"),
    db: Session = Depends(get_db),
):
    """앨범 상세 + 트랙 목록. 발매된 앨범의 트랙 구성은 바뀌지 않아 길게 캐시한다."""
    service = request.app.state.music_service
    result = await _detail_with_cache(
        db,
        "album_tracks",
        f"{album_id}:{market}",
        lambda: service.get_album_tracks(album_id, market=market),
        AlbumWithTracks,
    )
    await _warm_item_cache(db, "track", result.get("tracks", []))
    return result


@router.get("/artists/{artist_id}/top-tracks", response_model=list[TrackSearchItem])
async def get_artist_top_tracks(
    request: Request,
    artist_id: str,
    market: str = Query("KR", description="마켓 코드"),
    db: Session = Depends(get_db),
):
    """아티스트의 트랙 목록. 앨범 목록과 같은 이유로 TTL이 짧다."""
    service = request.app.state.music_service

    async def fetch() -> dict:
        return {"items": await service.get_artist_top_tracks(artist_id, market=market)}

    cached = await _detail_with_cache(
        db, "artist_top_tracks", f"{artist_id}:{market}", fetch, _TrackListPayload
    )
    items = cached["items"]
    await _warm_item_cache(db, "track", items)
    return items


@router.get("/search/tracks", response_model=SearchTracksResponse)
async def search_tracks(
    request: Request,
    q: str = Query(..., min_length=1, description="검색어"),
    market: str = Query("KR", description="마켓 코드 (예: KR, JP, US)"),
    limit: int = Query(20, ge=1, le=50, description="최대 결과 수"),
    db: Session = Depends(get_db),
):
    """곡 검색. 앨범 검색과 같은 이유로 결과 항목만 배치 캐시에 적어 둔다."""
    service = request.app.state.music_service
    result = await service.search_tracks(q, market=market, limit=limit)
    await _warm_item_cache(db, "track", result.get("items", []))
    return result


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
