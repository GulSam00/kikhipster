from __future__ import annotations

import logging
import re

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def _upscale_artwork(url: str | None, size: int = 600) -> str | None:
    """iTunes artworkUrl100을 요청한 해상도로 치환 (공식적으로 지원되는 URL 패턴)."""
    if not url:
        return None
    return url.replace("100x100bb", f"{size}x{size}bb")


# iTunes는 싱글·EP를 컬렉션 이름 끝에 " - Single" / " - EP" 로 붙여 표기한다.
# 실측(앨범 검색 900건): " - Single" 469건(52%), " - EP" 79건(9%). 그 외 꼬리는 전부
# 1~2건짜리 진짜 부제였다("The 2nd Album", "TOKYO DOME (Live)" 등).
#
# 구분자를 반드시 요구한다. 접미만 보면 "...lEP" 처럼 단어 끝이 EP인 제목이 걸리고
# ("Single Version)" 같은 괄호 표기도 오탐이 된다 — 둘 다 실측에서 확인했다.
# 실제 데이터에는 반각 하이픈만 나왔지만 en/em dash 와 대소문자 변형까지 받아둔다.
_SINGLE_EP_SUFFIX = re.compile(r"\s[-–—]\s*(single|ep)\s*$", re.IGNORECASE)

# 제목 **중간**의 EP 표기. 2026-08-31 추가.
#
# 꼬리 규칙만으로는 `NewJeans 2nd EP 'Get Up'` 처럼 표기가 가운데 오는 미니앨범을 놓친다.
# 고유 앨범 4206건 실측에서 이 패턴이 추가로 잡는 것은 3건이고 **전부 정탐**이었다
# (`NewJeans 1st EP 'New Jeans'`, `NewJeans 2nd EP 'Get Up'`,
#  `NewJeans Karaoke Piano EP (Piano Karaoke)`). 오탐 0건.
#
# **대소문자를 구분한다.** 같은 표본에서 소문자 " ep " 는 0건이라 무시로 완화해 봐야
# 얻는 게 없고 `Deep`/`Sleep` 쪽 위험만 커진다. 양쪽 공백도 같은 이유로 필수다.
_ALBUM_EP_MID = re.compile(r"\sEP\s")


def is_single_or_ep(title: str) -> bool:
    """컬렉션 이름이 iTunes의 싱글·EP 표기로 **끝나는가**.

    **일부러 꼬리만 본다** — `_album_type` 과 규칙이 다르다. 이 함수는 필터용이고,
    필터를 켠 쪽이 기대하는 것은 "iTunes가 꼬리로 표기한 싱글·EP"다. 중간 EP까지 거르면
    `include_singles=false` 를 켠 화면이 정규 미니앨범을 잃는다.
    """
    return bool(_SINGLE_EP_SUFFIX.search(title or ""))


def _album_type(title: str, track_count: int) -> str:
    """iTunes엔 single/album 구분 필드가 없다. 제목 표기를 먼저 믿고 없으면 트랙 수로 추정.

    응답의 `collectionType` 은 실측에서 전건 `"Album"` 이라 쓸모가 없다 — 종류를 담을
    필드는 있는데 iTunes가 채우지 않는다. 구분 정보는 제목 문자열에만 있다.

    트랙 수만으로는 어긋난다 — 실측에서 " - Single" 표기인데 트랙이 2개 이상인 게 89건,
    " - EP" 인데 10곡짜리도 있었다. 반대로 트랙이 1~2개인 진짜 앨범도 있다
    ("In a Silent Way" 2곡 등).
    """
    m = _SINGLE_EP_SUFFIX.search(title or "")
    if m:
        return m.group(1).lower()
    if _ALBUM_EP_MID.search(title or ""):
        return "ep"
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
            "album_type": _album_type(a.get("collectionName", ""), track_count),
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

    # 싱글·EP를 걸러내면 결과가 60% 넘게 사라진다(실측 61%). 요청한 개수를 채우려면
    # iTunes에서 넉넉히 받아와야 한다. iTunes /search 의 limit 상한은 200이다.
    # 필터가 기본으로 꺼진 뒤로는 `include_singles=False` 를 명시한 호출에서만 쓰인다.
    SEARCH_OVERFETCH = 3
    SEARCH_MAX_LIMIT = 200

    async def search_albums(
        self, query: str, market: str = "KR", limit: int = 20, include_singles: bool = True
    ) -> dict:
        """앨범명 또는 아티스트명으로 앨범 검색.

        `include_singles=False` 면 iTunes가 " - Single" / " - EP" 로 표기한 항목을 뺀다.
        **기본값은 포함이다 (2026-08-31 에 제외 → 포함으로 뒤집었다.)**

        원래 요청은 "제목 뒤의 ` - Single` 꼬리가 거추장스럽다" 였는데 2026-08-23 에 그걸
        **항목을 빼는 것**으로 구현했다. 꼬리는 프론트가 표시할 때 떼는 것으로 옮겼고
        (`lib/domain/album-title.ts`), 항목을 빼는 쪽은 대가가 컸다 — iTunes 는 K-POP
        미니앨범을 `- EP` 로 표기해서 `NewJeans 2nd EP 'Get Up'` 같은 정규 발매작이
        통째로 사라졌다(newjeans 검색이 8건만 나오던 이유).

        파라미터는 남겨 둔다. 나중에 "싱글 숨기기" 토글을 붙일 자리다.
        """
        want = min(limit, 50)
        fetch = min(want * self.SEARCH_OVERFETCH, self.SEARCH_MAX_LIMIT) if not include_singles else want

        data = await self._request(
            "/search",
            params={
                "term": query,
                "country": market,
                "media": "music",
                "entity": "album",
                "limit": fetch,
            },
        )
        results = data.get("results", [])
        if not include_singles:
            results = [a for a in results if not is_single_or_ep(a.get("collectionName", ""))]

        items = [self._map_album(a) for a in results[:want]]
        # total 은 iTunes가 준 전체 건수라 필터 이후 개수와 다르다. 필터를 켠 경우
        # 화면에 쓸 수 있는 값은 실제 반환 개수뿐이라 그걸 준다.
        total = data.get("resultCount", len(items)) if include_singles else len(items)
        return {"items": items, "total": total}

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
        self, artist_id: str, market: str = "KR", limit: int = 50,
        include_singles: bool = True,
    ) -> list[dict]:
        """아티스트의 앨범 목록 조회.

        `search_albums` 와 기본값을 맞춘다 — 한쪽만 걸어 두면 같은 아티스트가 화면마다
        다른 목록을 보여준다(2026-08-27에 그래서 맞췄고, 2026-08-31에 함께 포함으로 뒤집었다).
        """
        want = min(limit, 50)
        # 필터를 켠 호출에서만 넉넉히 받아온다 — search_albums 와 같은 이유.
        fetch = min(want * self.SEARCH_OVERFETCH, self.SEARCH_MAX_LIMIT) if not include_singles else want

        data = await self._request(
            "/lookup",
            params={
                "id": artist_id,
                "entity": "album",
                "country": market,
                "limit": fetch,
            },
        )
        # results[0]은 아티스트 레코드 자신(wrapperType=artist) — 앨범 목록은 그 뒤부터.
        albums = [r for r in data.get("results", []) if r.get("wrapperType") == "collection"]
        if not include_singles:
            albums = [a for a in albums if not is_single_or_ep(a.get("collectionName", ""))]
        return [self._map_album(a) for a in albums[:want]]

    async def get_album_tracks(self, album_id: str, market: str = "KR") -> dict:
        """앨범 트랙 목록 조회 (preview_url 포함).

        **iTunes lookup은 스토어프론트마다 다르게 답한다** — 세 갈래를 순서대로 탄다.
        2026-08-28 실측:

        | 요청 | US 앨범(Thriller) | KR 앨범(aespa Armageddon) |
        |------|-------------------|---------------------------|
        | `entity=song` (country 없음 = US) | collection 1 + track 9 | **결과 0** |
        | `entity=song&country=KR`          | collection 1 + track 0 | collection 1 + **track 0** |

        즉 country를 빼면 US 앨범만 되고, KR 앨범은 어느 쪽으로도 트랙이 오지 않는다.
        예전 주석은 "country를 빼면 트랙이 온다"고 적어 뒀는데 그건 US 앨범 한정이었고,
        그대로 두면 K-POP 앨범 상세가 전부 404였다(실제로 그랬다).
        `entity=musicTrack`·`media=music`·다른 country도 전부 확인했지만 안 된다.

        그래서 트랙이 비면 마지막으로 **검색**으로 채운다. 검색 API는 KR 스토어에서도
        preview_url 을 정상으로 준다. 다만 검색은 앨범 전체를 보장하지 않는다 —
        위 앨범에서 11곡 중 10곡이 왔다. 없는 것보다 낫다는 판단이다.
        """
        # ① country 없이 (= US 스토어). US 앨범은 여기서 트랙까지 다 온다.
        results = (
            await self._request(
                # limit 생략 시 트랙을 거의 안 돌려준다(collection 레코드만 옴) → 넉넉히 고정.
                "/lookup",
                params={"id": album_id, "entity": "song", "limit": 200},
            )
        ).get("results", [])
        collection = next((r for r in results if r.get("wrapperType") == "collection"), None)
        raw_tracks = [r for r in results if r.get("wrapperType") == "track"]

        # ② 사용자 스토어프론트. KR 전용 앨범은 여기서만 collection 이 잡힌다.
        if collection is None:
            results = (
                await self._request(
                    "/lookup",
                    params={"id": album_id, "entity": "song", "country": market, "limit": 200},
                )
            ).get("results", [])
            collection = next((r for r in results if r.get("wrapperType") == "collection"), None)
            if not raw_tracks:
                raw_tracks = [r for r in results if r.get("wrapperType") == "track"]

        if not collection:
            raise HTTPException(status_code=404, detail="앨범을 찾을 수 없습니다")

        album = self._map_album(collection)

        # ③ 그래도 트랙이 없으면 검색으로 채운다.
        if not raw_tracks:
            raw_tracks = await self._search_album_tracks(collection, market)

        tracks = []
        for t in raw_tracks:
            mapped = self._map_track(t)
            tracks.append({
                "id": mapped["id"],
                "name": mapped["name"],
                "track_number": t.get("trackNumber", 0),
                "duration_ms": mapped["duration_ms"],
                "preview_url": mapped["preview_url"],
                "artists": mapped["artists"],
            })
        tracks.sort(key=lambda t: t["track_number"] or 0)

        return {"album": album, "tracks": tracks}

    async def _search_album_tracks(self, collection: dict, market: str) -> list[dict]:
        """lookup 이 트랙을 안 줄 때 검색으로 수록곡을 긁어 온다.

        `collectionId` 로 거르므로 다른 앨범의 동명 곡이 섞이지는 않는다.
        검색어에서 " - Single" / " - EP" 같은 꼬리는 떼지 않는다 — 실측에서 붙이든
        떼든 같은 곡이 왔고, 떼면 오히려 다른 앨범이 앞자리를 차지하는 경우가 있었다.
        """
        album_id = str(collection.get("collectionId", ""))
        term = f"{collection.get('artistName', '')} {collection.get('collectionName', '')}".strip()
        if not term or not album_id:
            return []

        data = await self._request(
            "/search",
            params={
                "term": term,
                "entity": "song",
                "media": "music",
                "country": market,
                "limit": 200,
            },
        )
        found = [
            r for r in data.get("results", [])
            if str(r.get("collectionId", "")) == album_id
        ]
        if not found:
            logger.warning("앨범 %s 수록곡을 검색으로도 찾지 못했다 (term=%r)", album_id, term)
        return found

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

    # iTunes lookup은 id를 많이 넘기면 **조용히 잘린다**. 실측: 200개 요청 → 200개 정상,
    # 300개 요청 → 210개만 반환, 512개 → 응답 자체가 깨짐. 그래서 호출부가 몇 개를 넘기든
    # 여기서 청크로 쪼개 부른다. 여유를 두고 150으로 잡았다.
    LOOKUP_CHUNK = 150

    async def _lookup_chunked(self, ids: list[str], wrapper_type: str) -> dict[str, dict]:
        """id 목록을 청크로 나눠 lookup하고 {id: 매핑결과} 를 돌려준다.

        `country`는 넘기지 않는다 — 앨범 lookup에서 트랙이 0개로 잘리는 것과 같은 계열의
        문제를 피하기 위함이고, trackId/collectionId는 전역 고유값이라 필요도 없다.
        """
        mapper = self._map_track if wrapper_type == "track" else self._map_album
        found: dict[str, dict] = {}

        for start in range(0, len(ids), self.LOOKUP_CHUNK):
            chunk = ids[start:start + self.LOOKUP_CHUNK]
            data = await self._request("/lookup", params={"id": ",".join(chunk)})
            for r in data.get("results", []):
                if r.get("wrapperType") != wrapper_type:
                    continue
                key = "trackId" if wrapper_type == "track" else "collectionId"
                found[str(r.get(key))] = mapper(r)

        return found

    async def get_tracks_by_ids(self, track_ids: list[str]) -> list[dict]:
        """트랙 ID 여러 개를 조회한다. 요청 순서를 유지하고, 없는 ID는 결과에서 빠진다."""
        if not track_ids:
            return []
        found = await self._lookup_chunked(track_ids, "track")
        return [found[i] for i in track_ids if i in found]

    async def get_albums_by_ids(self, album_ids: list[str]) -> list[dict]:
        """앨범 ID 여러 개를 조회한다. 앨범 월드컵의 풀·대진 표시에 쓴다."""
        if not album_ids:
            return []
        found = await self._lookup_chunked(album_ids, "collection")
        return [found[i] for i in album_ids if i in found]
