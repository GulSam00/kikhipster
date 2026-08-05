from __future__ import annotations

from fastapi import APIRouter, Query, Request

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
