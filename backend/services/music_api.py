from __future__ import annotations

import logging
import re
import unicodedata
from datetime import datetime

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)


# iTunes /search 는 **KR 스토어프론트에서 앨범·곡을 하나도 돌려주지 않는다.**
#
# 2026-09-10 실측 (https://itunes.apple.com/search):
#
# | term        | country | entity      | resultCount |
# |-------------|---------|-------------|-------------|
# | 아이유       | KR      | album       | **0**       |
# | 아이유       | KR      | song        | **0**       |
# | IU (영문)    | KR      | album       | **0**       |
# | IU (영문)    | US      | album       | 3           |
# | 아이유       | US / JP / 생략 | album | 3           |
# | 아이유       | KR      | musicArtist | 2           |
#
# **검색어가 한글이라서가 아니다** — 영문 `IU` 도 KR 에선 0이고, 같은 한글 검색어도
# US·JP 에선 정상이다. 한국에는 iTunes 뮤직 스토어가 없어서(Apple Music 은 별개다)
# KR 스토어프론트의 음악 카탈로그 자체가 비어 있는 것이다. `musicArtist` 만 살아남는
# 이유는 아티스트 엔티티가 스토어프론트에 매이지 않기 때문이다(응답의 `country` 가 None).
#
# 같은 함정을 이미 한 번 겪었다 — `get_album_tracks` 가 country 를 안 넘기는 이유가
# 이것이다(CLAUDE.md 에 기록됨). 그때는 그 호출만 고쳤고, /search 는 그대로 남아 있었다.
#
# **ID 는 스토어프론트를 타지 않는다**(위 실측에서 US·JP 의 `collectionId` 가 동일).
# 그래서 검색만 US 로 돌려도 저장된 탑스터·월드컵의 앨범 ID 와 어긋나지 않는다.
_NO_MUSIC_SEARCH_STOREFRONTS = {"KR"}
_SEARCH_FALLBACK_COUNTRY = "US"


def _search_country(market: str) -> str:
    """/search 에 실제로 넘길 스토어프론트.

    음악 카탈로그가 비어 있는 스토어프론트는 US 로 대신한다. **`/lookup` 에는 쓰지
    않는다** — lookup 은 KR 로도 정상 동작한다(아티스트 앨범 6건 실측).
    """
    return _SEARCH_FALLBACK_COUNTRY if market.upper() in _NO_MUSIC_SEARCH_STOREFRONTS else market


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


# ── KR 판 ↔ 그 밖 판 매칭 (이슈 20261119-1455) ──────────────────────────────────
#
# 같은 앨범이 스토어프론트마다 **다른 collectionId** 를 갖는 경우가 흔하다(aespa Armageddon:
# KR 판 1745285216, 그 밖 판 1773694541). KR 판 ID 는 iTunes 어디서도 트랙을 안 준다 —
# `entity=song` 은 country 없이는 결과 0, `country=KR` 이면 collection 만. 그래서 앨범 상세는
# 같은 앨범의 그 밖 판을 찾아 **트랙만** 빌려 온다. 찾는 키는 2026-11-20 실측(표본 28건)에서
# 정한 "같은 artistId + 정규화한 collectionName" 이고, 판이 여럿이면 trackCount → releaseDate 로
# 하나만 고른다. trackCount 가 크게 다르면 같은 이름의 다른 발매물(싱글 1곡 vs 9곡 앨범,
# Whiplash KR 3곡 판 vs 1곡 판)이라 거절한다.
#
# **합작은 매칭하지 않는다.** `K-POP ScreaM 2` 는 KR 판 artistId(NCT 127 & aespa)와 US 판
# artistId(aespa & NCT 127)가 대표 아티스트 순서 때문에 달랐다. 이름만으로 넓히면 동명
# 다른 앨범을 집어 오는 오매칭이 늘어서, artistId 가 다르면 그냥 못 찾은 것으로 둔다.
SIBLING_MAX_TRACK_COUNT_DIFF = 2


def normalize_collection_name(name: str | None) -> str:
    """판 매칭용 앨범 이름 정규화 — NFKC, ` - EP`/` - Single` 꼬리 제거, 소문자, 공백 축약.

    꼬리를 떼는 이유: 같은 미니앨범이 한 판은 `Whiplash - The 5th Mini Album`, 다른 판은
    `... - EP` 처럼 표기가 갈린다. NFKC 는 전각 문자·호환 문자(`＆` 등) 차이를 지운다.
    """
    s = unicodedata.normalize("NFKC", name or "")
    s = _SINGLE_EP_SUFFIX.sub("", s)
    return " ".join(s.lower().split())


def _record_artist_id(record: dict) -> str:
    """레코드의 대표 아티스트 ID. 곡 레코드는 앨범 아티스트(`collectionArtistId`)가 따로 있으면 그쪽."""
    value = record.get("collectionArtistId") or record.get("artistId")
    return str(value) if value else ""


def _parse_release_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d")
    except ValueError:
        return None


def pick_sibling_edition(target: dict, candidates: list[dict]) -> dict | None:
    """`target`(KR 판 collection 레코드)과 같은 앨범의 다른 판을 `candidates` 에서 하나 고른다.

    후보는 collection 모양의 dict(`collectionId`·`artistId`·`collectionName`·`trackCount`·
    `releaseDate`)다. 조건:
    1. collectionId 가 target 과 다르고
    2. 대표 artistId 가 **같고**(둘 다 있어야 한다 — 합작·Various Artists 는 여기서 빠진다)
    3. 정규화한 collectionName 이 같고
    4. trackCount 차이가 `SIBLING_MAX_TRACK_COUNT_DIFF` 이하
    남은 것 중 trackCount 차이가 작은 것 → releaseDate 가 가까운 것 → 입력 순서.
    """
    target_id = str(target.get("collectionId", ""))
    artist_id = _record_artist_id(target)
    name = normalize_collection_name(target.get("collectionName"))
    if not artist_id or not name:
        return None

    target_count = target.get("trackCount") or 0
    target_date = _parse_release_date(target.get("releaseDate"))

    ranked = []
    for order, c in enumerate(candidates):
        if str(c.get("collectionId", "")) in ("", target_id):
            continue
        if _record_artist_id(c) != artist_id:
            continue
        if normalize_collection_name(c.get("collectionName")) != name:
            continue
        count_diff = abs((c.get("trackCount") or 0) - target_count)
        if count_diff > SIBLING_MAX_TRACK_COUNT_DIFF:
            continue
        c_date = _parse_release_date(c.get("releaseDate"))
        date_diff = (
            abs((c_date - target_date).days) if c_date and target_date else float("inf")
        )
        ranked.append((count_diff, date_diff, order, c))

    if not ranked:
        return None
    ranked.sort(key=lambda r: r[:3])
    return ranked[0][3]


def editions_from_tracks(tracks: list[dict], artist_id: str) -> list[dict]:
    """곡 레코드 목록을 소속 앨범(판)별로 묶어 `pick_sibling_edition` 의 후보 모양으로 만든다.

    곡 레코드에도 소속 앨범의 `collectionName`·`trackCount` 가 실려 있다. 판의 artistId 는
    그 판의 곡 중 하나라도 `artist_id` 면 그것으로 본다 — 피처링 곡은 곡 아티스트가 달라질 수
    있어서다. releaseDate 는 곡들 중 가장 늦은 날짜(선공개 싱글이 앞서 나오는 경우를 감안).
    """
    by_collection: dict[str, dict] = {}
    for t in tracks:
        cid = str(t.get("collectionId", ""))
        if not cid:
            continue
        edition = by_collection.setdefault(cid, {
            "collectionId": cid,
            "artistId": _record_artist_id(t),
            "collectionName": t.get("collectionName", ""),
            "trackCount": t.get("trackCount") or 0,
            "releaseDate": t.get("releaseDate") or "",
        })
        if _record_artist_id(t) == artist_id:
            edition["artistId"] = artist_id
        if (t.get("releaseDate") or "") > edition["releaseDate"]:
            edition["releaseDate"] = t["releaseDate"]
    return list(by_collection.values())


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
                "country": _search_country(market),
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
                "country": _search_country(market),
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
                "country": _search_country(market),
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

    async def get_artist_album_artist_names(self, artist_id: str) -> list[str]:
        """KR 앨범 레코드의 `artistName` 목록 — 한국어 이름 보완용(`services/artist_names.py`).

        앨범 목록 조회(`get_artist_albums`)와 달리 매핑하지 않고 이름만 돌려준다.
        """
        data = await self._request(
            "/lookup",
            params={"id": artist_id, "entity": "album", "country": "KR", "limit": 20},
        )
        return [r["artistName"] for r in data.get("results", []) if r.get("artistName")]

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

        그래서 트랙이 비면 **검색**으로 채운다(③). 단 검색은 `country=KR` 이면 곡이 0건이라
        (2026-11-12 재실측) US 스토어프론트로 보낸다 — `_search_album_tracks`.
        (예전 이 자리의 "검색 API는 KR 스토어에서도 preview_url 을 정상으로 준다"는 틀렸다.)
        검색은 앨범 전체를 보장하지 않는다 — 위 앨범에서 11곡 중 10곡이 왔다.
        없는 것보다 낫다는 판단이다.

        2026-11-12 재실측에서는 같은 Armageddon(1773694541)이 ①(country 없음)에서
        collection 1 + track 10 으로 왔고, ②(`country=KR`)는 결과 0이었다. iTunes 쪽
        동작이 바뀐 것으로 보이며 ①~③ 순서는 그대로 둔다(③은 ①②가 트랙을 못 줄 때만 탄다).

        **2026-11-19 재실측 — 동작이 바뀐 게 아니라 ID 가 다른 앨범이었다.** aespa 는 같은
        앨범이 스토어프론트마다 **다른 collectionId** 를 가진다(아티스트 lookup
        `entity=album` 을 KR/country 없음으로 비교: aespa 69 vs 79건 중 43건이 KR 에만 있다).
        Armageddon 은 KR 판 `1745285216`, 그 밖 판 `1773694541` 이다. 08-28 표의 KR 앨범은
        KR 판이었을 것으로 보이고(재현이 그대로 된다), 11-12 는 그 밖 판을 잰 것이다.
        모든 요청 `entity=song&limit=200`, 수치는 collection + track:

        | 앨범 (collectionId) | ① country 없음 | ② `country=KR` |
        |---------------------|----------------|----------------|
        | aespa Armageddon KR판 (1745285216) | 결과 0 | 1 + **0** |
        | aespa Whiplash KR판 (1772644600)   | 결과 0 | 1 + **0** |
        | aespa iScreaM Vol.26 (1890393604)  | 결과 0 | 1 + **0** |
        | IU Believe in Love (1577664507)    | 결과 0 | 1 + **0** |
        | aespa Armageddon 그 밖 판 (1773694541) | 1 + 10 | 결과 0 |
        | aespa LEMONADE (1893742002)        | 1 + 12 | 결과 0 |
        | IU Palette (1229073300)            | 1 + 10 | 1 + 0 |
        | NewJeans Get Up (1695951888)       | 1 + 6  | 1 + 0 |
        | ZICO TELEVISION (1804661544)       | 1 + 5  | 1 + 0 |
        | 대조군 Thriller (269572838)        | 1 + 9  | 1 + 0 |

        - ② 는 여전히 필요하다 — KR 전용 ID 의 collection 을 주는 유일한 단계다(빼면 404).
        - `entity=song` 에 `country=KR` 을 붙이면 트랙은 **어느 앨범이든 0** 이다(위 10건 전부).
        - KR 전용 ID 는 ③ 검색의 `collectionId` 필터만으로는 트랙이 안 채워진다 — US 검색
          결과는 그 밖 판 ID 로 온다(`aespa Armageddon - The 1st Album`: 18건 중 1745285216 0건 /
          1773694541 10건, country 생략도 같다). ③ 을 US 로 보낸 수정(이슈 1548)은 그 밖 판
          ID 에만 효과가 있었고, KR 판 ID 는 그 뒤에도 트랙 0개로 열렸다.

        **2026-11-23 (이슈 20261119-1455) — KR 판은 그 밖 판에서 트랙을 빌려 온다.**
        - ③-a 검색 결과에 `collectionId` 일치 곡이 없으면, **같은 artistId + 정규화한 앨범
          이름 + trackCount 차이 ≤2** 인 판의 곡을 받는다(`pick_sibling_edition`). 기존 검색
          호출을 그대로 쓰므로 추가 호출 0회. 표본 28건 중 23건이 여기서 찾혔다.
        - ③-b 그래도 0곡이면 아티스트 앨범 목록(`lookup entity=album`, country 없음)에서 같은
          규칙으로 그 밖 판 ID 를 찾아 `entity=song` 으로 트랙을 받는다(추가 호출 2회,
          `_sibling_tracks_from_artist`). ③-a 와 합쳐 표본 26/28.
        - 응답의 `album`(ID·이름·커버)은 **요청받은 KR 판 그대로**다 — 링크·저장된 ID 와
          어긋나지 않게. 곡 이름은 `_localize_names` 가 KR lookup 을 한 번 시도하지만 그 밖 판
          곡은 대부분 KR 에 없어(실측 23건 중 2건만 응답) 영문으로 남는다.
        - 끝내 못 찾으면(합작처럼 artistId 가 판마다 다르거나, 그 밖 판이 아예 없으면) 지금처럼
          트랙 0개 + 경고 로그. 라우터는 0곡 결과를 캐시하지 않는다(`routers/music.py`).
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

        # ③ 그래도 트랙이 없으면 검색으로 채운다(같은 ID → 없으면 같은 앨범의 그 밖 판).
        if not raw_tracks:
            raw_tracks = await self._search_album_tracks(collection, market)

        # ③-b 검색으로도 못 찾으면 아티스트 앨범 목록에서 그 밖 판을 찾는다.
        if not raw_tracks:
            raw_tracks = await self._sibling_tracks_from_artist(collection)
            if not raw_tracks:
                logger.warning(
                    "앨범 %s 수록곡을 어느 판에서도 찾지 못했다 — 트랙 0개로 응답한다",
                    album["id"],
                )

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

        await self._localize_names(album, tracks)
        return {"album": album, "tracks": tracks}

    async def _localize_names(self, album: dict, tracks: list[dict]) -> None:
        """앨범 상세의 **표시 이름만** KR 표기로 갈아끼운다 (제자리 수정).

        이 경로는 `entity=song` 을 써야 트랙이 오는데, 거기에 `country=KR` 을 얹으면
        트랙이 0개로 잘린다(위 표). 그래서 이름은 따로 물어본다 — `entity` 없는 lookup
        하나로 collection 과 track 을 같이 받으므로 **요청은 1회 늘 뿐**이고, 결과는
        `album_tracks` 캐시에 30일 남는다.

        **바꾸는 것은 `title`/`name`/아티스트명뿐이다.** `preview_url`·`track_number`·
        `duration_ms` 는 ①~③ 단계에서 이미 확인된 값이라 그대로 둔다 — KR 응답에 없거나
        다를 수 있고, 미리듣기가 조용히 사라지면 재생기가 통째로 멈춘다.

        실패해도 조용히 넘어간다. 이름이 영어로 남을 뿐 화면은 그대로 뜬다.
        """
        ids = [album["id"]] + [t["id"] for t in tracks if t.get("id")]
        ids = [i for i in ids if i]
        if not ids:
            return

        try:
            data = await self._request(
                "/lookup",
                params={"id": ",".join(ids[: self.LOOKUP_CHUNK]), "country": self.LOOKUP_COUNTRY},
            )
        except Exception:
            logger.warning("KR 이름 조회 실패, 영문 표기를 유지한다 (album=%s)", album["id"])
            return

        by_id = {}
        for r in data.get("results", []):
            key = "trackId" if r.get("wrapperType") == "track" else "collectionId"
            if r.get(key):
                by_id[str(r[key])] = r

        localized = by_id.get(album["id"])
        if localized:
            album["title"] = localized.get("collectionName") or album["title"]
            album["artist_name"] = localized.get("artistName") or album["artist_name"]

        for t in tracks:
            localized = by_id.get(t["id"])
            if not localized:
                continue
            t["name"] = localized.get("trackName") or t["name"]
            if localized.get("artistName"):
                t["artists"] = [localized["artistName"]]

    async def _search_album_tracks(self, collection: dict, market: str) -> list[dict]:
        """lookup 이 트랙을 안 줄 때 검색으로 수록곡을 긁어 온다.

        **`/search` 이므로 `_search_country()` 를 거친다**(KR → US). 2026-11-12 실측
        `/search?entity=song&term=aespa Armageddon`, 대상 앨범 collectionId 1773694541:

        | country | 결과 | 대상 앨범과 일치 |
        |---------|------|------------------|
        | KR      | 0    | 0                |
        | US      | 19   | 10 (11곡 중, 전부 preview_url 있음) |
        | 생략    | 19   | 10               |

        표본 하나 더(`IU Love poem`): KR 0건, US 14건(그중 `Love Poem - EP` 6곡).
        예전에 여기 `country=market` 을 그대로 넘겨 검색이 늘 0건이었다(이슈 1548). 다만 US 로
        바꾼 것만으로 풀리는 것은 **그 밖 판 ID** 뿐이다 — KR 판 ID 는 검색 결과에 아예 안 나온다.

        거르는 순서:
        1. `collectionId` 가 같은 곡. 다른 앨범의 동명 곡은 섞이지 않는다.
        2. 없으면 **같은 앨범의 그 밖 판** 곡 — 같은 artistId + 정규화 이름 + trackCount 차이
           ≤2, 판이 여럿이면 trackCount → releaseDate 로 하나(`pick_sibling_edition`). KR 판
           ID(2026-11-20 표본 28건)는 1 에 하나도 안 걸리고 2 로 23건이 찾혔다. 같은 검색
           응답을 다시 거를 뿐이라 추가 호출은 없다.

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
                "country": _search_country(market),
                "limit": 200,
            },
        )
        songs = [r for r in data.get("results", []) if r.get("wrapperType", "track") == "track"]
        found = [r for r in songs if str(r.get("collectionId", "")) == album_id]
        if found:
            return found

        sibling = pick_sibling_edition(
            collection, editions_from_tracks(songs, _record_artist_id(collection))
        )
        if sibling is None:
            logger.info("앨범 %s 수록곡이 검색 결과에 없다 (term=%r)", album_id, term)
            return []

        sibling_id = str(sibling["collectionId"])
        logger.info("앨범 %s 수록곡을 같은 앨범의 다른 판 %s 에서 빌려 온다 (검색)", album_id, sibling_id)
        return [r for r in songs if str(r.get("collectionId", "")) == sibling_id]

    async def _sibling_tracks_from_artist(self, collection: dict) -> list[dict]:
        """아티스트 앨범 목록에서 같은 앨범의 그 밖 판을 찾아 그 판의 곡을 받는다 (추가 호출 2회).

        `_search_album_tracks` 의 검색이 그 밖 판을 못 보여 줄 때의 폴백이다(실측: TWICE
        `Breakthrough` 는 US 검색이 동명 다른 곡만 줬고, aespa `Dirty Work (Remixes)` 는 검색 0건).

        - 목록 호출은 **country 를 넘기지 않는다** — KR 목록은 그 KR 판 자신만 담고 있다.
        - 곡 호출은 `entity=song` 이라 역시 country 없이(CLAUDE.md 함정: 얹으면 트랙 0개).
        - artistId 가 없는 레코드(Various Artists 등)는 호출하지 않고 빈 목록.
        """
        artist_id = _record_artist_id(collection)
        if not artist_id:
            return []

        data = await self._request(
            "/lookup",
            params={"id": artist_id, "entity": "album", "limit": self.SEARCH_MAX_LIMIT},
        )
        albums = [r for r in data.get("results", []) if r.get("wrapperType") == "collection"]
        sibling = pick_sibling_edition(collection, albums)
        if sibling is None:
            return []

        sibling_id = str(sibling["collectionId"])
        data = await self._request(
            "/lookup",
            params={"id": sibling_id, "entity": "song", "limit": 200},
        )
        tracks = [
            r for r in data.get("results", [])
            if r.get("wrapperType") == "track" and str(r.get("collectionId", "")) == sibling_id
        ]
        logger.info(
            "앨범 %s 수록곡을 같은 앨범의 다른 판 %s 에서 빌려 온다 (아티스트 목록, %d곡)",
            collection.get("collectionId"), sibling_id, len(tracks),
        )
        return tracks

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

    # 배치 lookup 이 먼저 물어보는 스토어프론트.
    #
    # **`/lookup` 은 `/search` 와 반대로 KR 에서 이름을 한국어로 준다.** 2026-09-10 실측:
    # `Spring Day`→`봄날`, `For Lovers Who Hesitate`→`주저하는 연인들을 위해`,
    # `BTS`→`방탄소년단`, `IU`→`아이유`, `Kim Kwang Seok`→`김광석`.
    # 검색 결과 80건 대조에서 **아티스트명은 거의 전부, 곡 제목은 절반가량** 바뀌었고
    # 앨범 제목은 안 바뀌었다(발매사가 등록한 표기라 스토어프론트와 무관).
    #
    # `lang=ko_kr` 은 효과가 없다 — 공식 지원이 `en_us`/`ja_jp` 뿐이고 실제로도 응답이 같다.
    LOOKUP_COUNTRY = "KR"

    async def _lookup_pass(
        self, ids: list[str], wrapper_type: str, country: str | None = None
    ) -> dict[str, dict]:
        """청크로 쪼개 lookup 한 번 훑고 {id: 매핑결과} 를 돌려준다."""
        mapper = self._map_track if wrapper_type == "track" else self._map_album
        key = "trackId" if wrapper_type == "track" else "collectionId"
        found: dict[str, dict] = {}

        for start in range(0, len(ids), self.LOOKUP_CHUNK):
            chunk = ids[start:start + self.LOOKUP_CHUNK]
            params = {"id": ",".join(chunk)}
            if country:
                params["country"] = country
            data = await self._request("/lookup", params=params)
            for r in data.get("results", []):
                if r.get("wrapperType") != wrapper_type:
                    continue
                found[str(r.get(key))] = mapper(r)

        return found

    async def _lookup_chunked(self, ids: list[str], wrapper_type: str) -> dict[str, dict]:
        """id 목록을 lookup 해 {id: 매핑결과} 를 돌려준다. **KR 먼저, 못 찾은 것만 US 로 한 번 더.**

        KR 을 먼저 부르는 이유는 이름이 한국어로 오기 때문이다(`LOOKUP_COUNTRY` 주석).
        **그런데 KR 스토어에 없는 앨범은 통째로 안 온다** — 실측에서 서양권을 섞은 30건 중
        2건(비틀즈)이 KR 에서만 누락됐다. 그래서 2단이다. 폴백이 없으면 저장된 탑스터의
        커버가 조용히 사라진다.

        폴백 호출에는 `country` 를 넘기지 않는다(= US). `entity` 도 안 넘긴다 —
        앨범 lookup 에 `entity=song` 을 얹으면 트랙이 0개로 잘리는 함정이 따로 있다.
        `trackId`/`collectionId` 는 전역 고유값이라 스토어프론트가 달라도 같은 값이다.
        """
        found = await self._lookup_pass(ids, wrapper_type, self.LOOKUP_COUNTRY)

        missing = [i for i in ids if i not in found]
        if missing:
            found.update(await self._lookup_pass(missing, wrapper_type))

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
