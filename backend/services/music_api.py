from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def _upscale_artwork(url: str | None, size: int = 600) -> str | None:
    """iTunes artworkUrl100을 요청한 해상도로 치환 (공식적으로 지원되는 URL 패턴)."""
    if not url:
        return None
    return url.replace("100x100bb", f"{size}x{size}bb")


def _album_type(track_count: int) -> str:
    """iTunes엔 single/album 구분 필드가 없어 트랙 수로 추정."""
    return "single" if track_count <= 1 else "album"


class ITunesMusicService:
    """iTunes Search API 클라이언트. 인증·API 키 불필요 (공개 API)."""

    BASE_URL = "https://itunes.apple.com"

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def _request(self, path: str, params: dict) -> dict:
        response = await self._client.get(f"{self.BASE_URL}{path}", params=params)

        if response.status_code == 429:
            retry_after = response.headers.get("Retry-After", "unknown")
            logger.error("iTunes rate limit, Retry-After: %s", retry_after)
            raise HTTPException(status_code=503, detail="iTunes 요청 한도 초과. 잠시 후 다시 시도하세요.")

        if response.status_code >= 500:
            logger.error("iTunes 서버 오류: %d", response.status_code)
            raise HTTPException(status_code=502, detail="iTunes 서비스 오류")

        response.raise_for_status()
        return response.json()

    def _map_artist(self, a: dict) -> dict:
        genre = a.get("primaryGenreName")
        return {
            "id": str(a.get("artistId", "")),
            "name": a.get("artistName", ""),
            # iTunes 아티스트 엔티티엔 이미지 필드가 없다 (앨범/트랙 아트워크만 존재).
            # ArtistCard의 마이크 아이콘 폴백으로 처리 — docs/TASKS.md T1 참조.
            "image_url": None,
            "genres": [genre] if genre else [],
            "popularity": 0,
        }

    def _map_album(self, a: dict) -> dict:
        artists = a.get("artistName", "")
        track_count = a.get("trackCount", 0)
        return {
            "id": str(a.get("collectionId", "")),
            "title": a.get("collectionName", ""),
            "cover_url": _upscale_artwork(a.get("artworkUrl100")),
            "artist_name": artists,
            "release_date": a.get("releaseDate", ""),
            "total_tracks": track_count,
            "album_type": _album_type(track_count),
        }

    def _map_track(self, t: dict) -> dict:
        return {
            "id": str(t.get("trackId", "")),
            "name": t.get("trackName", ""),
            "artists": [t.get("artistName", "")] if t.get("artistName") else [],
            "album": {
                "id": str(t.get("collectionId", "")),
                "name": t.get("collectionName", ""),
                "cover_url": _upscale_artwork(t.get("artworkUrl100")),
            },
            "duration_ms": t.get("trackTimeMillis", 0),
            "popularity": 0,
            "explicit": t.get("trackExplicitness") == "explicit",
            "preview_url": t.get("previewUrl"),
        }

    async def search_artists(
        self, query: str, market: str = "KR", limit: int = 20
    ) -> dict:
        """아티스트 이름으로 검색."""
        data = await self._request(
            "/search",
            params={
                "term": query,
                "country": market,
                "media": "music",
                "entity": "musicArtist",
                "limit": min(limit, 50),
            },
        )
        items = [self._map_artist(a) for a in data.get("results", [])]
        return {"items": items, "total": data.get("resultCount", len(items))}

    async def search_albums(
        self, query: str, market: str = "KR", limit: int = 20
    ) -> dict:
        """앨범명 또는 아티스트명으로 앨범 검색."""
        data = await self._request(
            "/search",
            params={
                "term": query,
                "country": market,
                "media": "music",
                "entity": "album",
                "limit": min(limit, 50),
            },
        )
        items = [self._map_album(a) for a in data.get("results", [])]
        return {"items": items, "total": data.get("resultCount", len(items))}

    async def search_tracks(
        self, query: str, market: str = "KR", limit: int = 20
    ) -> dict:
        """곡 이름으로 트랙 검색."""
        data = await self._request(
            "/search",
            params={
                "term": query,
                "country": market,
                "media": "music",
                "entity": "song",
                "limit": min(limit, 50),
            },
        )
        items = [self._map_track(t) for t in data.get("results", [])]
        return {"items": items, "total": data.get("resultCount", len(items))}

    async def get_artist_detail(self, artist_id: str) -> dict:
        """아티스트 상세 정보 조회."""
        data = await self._request("/lookup", params={"id": artist_id})
        results = data.get("results", [])
        if not results:
            raise HTTPException(status_code=404, detail="아티스트를 찾을 수 없습니다")
        return self._map_artist(results[0])

    async def get_artist_albums(
        self, artist_id: str, market: str = "KR", limit: int = 50
    ) -> list[dict]:
        """아티스트의 앨범/싱글 목록 조회."""
        data = await self._request(
            "/lookup",
            params={
                "id": artist_id,
                "entity": "album",
                "country": market,
                "limit": min(limit, 50),
            },
        )
        # results[0]은 아티스트 레코드 자신(wrapperType=artist) — 앨범 목록은 그 뒤부터.
        albums = [r for r in data.get("results", []) if r.get("wrapperType") == "collection"]
        return [self._map_album(a) for a in albums]

    async def get_album_tracks(self, album_id: str, market: str = "KR") -> dict:
        """앨범 트랙 목록 조회 (preview_url 포함)."""
        data = await self._request(
            "/lookup",
            # 두 가지 iTunes lookup 특이사항이 겹친 곳:
            # 1) limit 생략 시 트랙을 거의 안 돌려준다(collection 레코드만 옴) → 넉넉히 고정
            # 2) 여기서 country를 같이 넘기면 트랙 자체가 0개로 잘린다(재현 확인) → 의도적으로 뺌.
            #    collectionId는 전역 고유값이라 country 없이도 앨범 자체는 정확히 찾힌다.
            params={"id": album_id, "entity": "song", "limit": 200},
        )
        results = data.get("results", [])
        collection = next((r for r in results if r.get("wrapperType") == "collection"), None)
        if not collection:
            raise HTTPException(status_code=404, detail="앨범을 찾을 수 없습니다")

        album = self._map_album(collection)
        tracks = []
        for t in results:
            if t.get("wrapperType") != "track":
                continue
            mapped = self._map_track(t)
            tracks.append({
                "id": mapped["id"],
                "name": mapped["name"],
                "track_number": t.get("trackNumber", 0),
                "duration_ms": mapped["duration_ms"],
                "preview_url": mapped["preview_url"],
                "artists": mapped["artists"],
            })

        return {"album": album, "tracks": tracks}

    async def get_artist_top_tracks(
        self, artist_id: str, market: str = "KR"
    ) -> list[dict]:
        """아티스트 트랙 목록 조회.

        iTunes엔 Spotify의 top-tracks 같은 인기순 엔드포인트가 없다.
        lookup으로 받아오는 트랙 목록(발매 관련 순서)을 그대로 쓴다 — 순위 의미 없음.
        """
        data = await self._request(
            "/lookup",
            params={
                "id": artist_id,
                "entity": "song",
                "country": market,
                "limit": 10,
            },
        )
        tracks = [r for r in data.get("results", []) if r.get("wrapperType") == "track"]
        return [self._map_track(t) for t in tracks]
