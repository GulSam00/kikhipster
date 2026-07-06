import logging

import httpx
from fastapi import HTTPException

from services.spotify_auth import SpotifyTokenManager

logger = logging.getLogger(__name__)


class SpotifyMusicService:
    """Spotify Web API 클라이언트 (토큰 자동 관리)."""

    BASE_URL = "https://api.spotify.com/v1"

    def __init__(
        self, client: httpx.AsyncClient, token_manager: SpotifyTokenManager
    ) -> None:
        self._client = client
        self._token_manager = token_manager

    async def _request(
        self, method: str, path: str, params: dict | None = None
    ) -> dict:
        """인증 헤더 자동 첨부. 401 시 토큰 갱신 후 1회 재시도."""
        url = f"{self.BASE_URL}{path}"

        for attempt in range(2):
            token = await self._token_manager.get_token(self._client)
            headers = {"Authorization": f"Bearer {token}"}

            response = await self._client.request(
                method, url, params=params, headers=headers
            )

            if response.status_code == 401 and attempt == 0:
                logger.warning("Spotify 401 — 토큰 무효화 후 재시도")
                await self._token_manager.invalidate()
                continue

            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Spotify에서 리소스를 찾을 수 없습니다")

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "unknown")
                logger.error("Spotify rate limit, Retry-After: %s", retry_after)
                raise HTTPException(status_code=503, detail="Spotify 요청 한도 초과. 잠시 후 다시 시도하세요.")

            if response.status_code >= 500:
                logger.error("Spotify 서버 오류: %d", response.status_code)
                raise HTTPException(status_code=502, detail="Spotify 서비스 오류")

            response.raise_for_status()
            return response.json()

        raise HTTPException(status_code=502, detail="Spotify 인증 실패")

    async def search_artists(
        self, query: str, market: str = "KR", limit: int = 20
    ) -> dict:
        """아티스트 이름으로 검색."""
        data = await self._request(
            "GET",
            "/search",
            params={"type": "artist", "q": query, "market": market, "limit": min(limit, 50)},
        )
        artists_data = data.get("artists", {})
        items = []
        for a in artists_data.get("items", []):
            images = a.get("images", [])
            items.append({
                "id": a.get("id", ""),
                "name": a.get("name", ""),
                "image_url": images[0]["url"] if images else None,
                "genres": a.get("genres", []),
                "popularity": a.get("popularity", 0),
                "followers": a.get("followers", {}).get("total", 0),
            })
        return {"items": items, "total": artists_data.get("total", 0)}

    async def search_albums(
        self, query: str, market: str = "KR", limit: int = 20
    ) -> dict:
        """앨범명 또는 아티스트명으로 앨범 검색."""
        data = await self._request(
            "GET",
            "/search",
            params={"type": "album", "q": query, "market": market, "limit": min(limit, 50)},
        )
        albums_data = data.get("albums", {})
        items = []
        for a in albums_data.get("items", []):
            images = a.get("images", [])
            artists = a.get("artists", [])
            items.append({
                "id": a.get("id", ""),
                "title": a.get("name", ""),
                "cover_url": images[0]["url"] if images else None,
                "artist_name": artists[0].get("name", "") if artists else "",
                "release_date": a.get("release_date", ""),
                "total_tracks": a.get("total_tracks", 0),
                "album_type": a.get("album_type", "album"),
            })
        return {"items": items, "total": albums_data.get("total", 0)}

    async def get_artist_detail(self, artist_id: str) -> dict:
        """아티스트 상세 정보 조회."""
        a = await self._request("GET", f"/artists/{artist_id}")
        images = a.get("images", [])
        return {
            "id": a.get("id", ""),
            "name": a.get("name", ""),
            "image_url": images[0]["url"] if images else None,
            "genres": a.get("genres", []),
            "popularity": a.get("popularity", 0),
            "followers": a.get("followers", {}).get("total", 0),
        }

    async def get_artist_albums(
        self, artist_id: str, market: str = "KR", limit: int = 50
    ) -> list[dict]:
        """아티스트의 앨범/싱글 목록 조회."""
        data = await self._request(
            "GET",
            f"/artists/{artist_id}/albums",
            params={"market": market, "limit": min(limit, 50), "include_groups": "album,single"},
        )
        items = []
        for a in data.get("items", []):
            images = a.get("images", [])
            artists = a.get("artists", [])
            items.append({
                "id": a.get("id", ""),
                "title": a.get("name", ""),
                "cover_url": images[0]["url"] if images else None,
                "artist_name": artists[0].get("name", "") if artists else "",
                "release_date": a.get("release_date", ""),
                "total_tracks": a.get("total_tracks", 0),
                "album_type": a.get("album_type", "album"),
            })
        return items

    async def get_album_tracks(self, album_id: str, market: str = "KR") -> dict:
        """앨범 트랙 목록 조회 (preview_url 포함)."""
        data = await self._request("GET", f"/albums/{album_id}", params={"market": market})

        images = data.get("images", [])
        artists = data.get("artists", [])
        album = {
            "id": data.get("id", ""),
            "title": data.get("name", ""),
            "cover_url": images[0]["url"] if images else None,
            "artist_name": artists[0].get("name", "") if artists else "",
            "release_date": data.get("release_date", ""),
            "total_tracks": data.get("total_tracks", 0),
            "album_type": data.get("album_type", "album"),
        }

        tracks = []
        for t in data.get("tracks", {}).get("items", []):
            track_artists = [ta.get("name", "") for ta in t.get("artists", [])]
            tracks.append({
                "id": t.get("id", ""),
                "name": t.get("name", ""),
                "track_number": t.get("track_number", 0),
                "duration_ms": t.get("duration_ms", 0),
                "preview_url": t.get("preview_url"),
                "artists": track_artists,
            })

        return {"album": album, "tracks": tracks}
