"""iTunes Search API 대역 — `httpx.MockTransport` 로 진짜 `ITunesMusicService` 앞에 끼운다.

서비스 객체를 통째로 가짜로 바꾸지 않는 이유: 지켜야 할 규칙(KR 먼저 → 못 찾은 것만 country 없이,
검색은 US·이름은 KR lookup)이 전부 `services/music_api.py` **안에** 있다. 서비스를 바꿔 끼우면 그
규칙을 시험하지 못한다. 그래서 바꾸는 것은 HTTP 한 겹뿐이고, 실제 네트워크로는 절대 나가지 않는다
(MockTransport 는 소켓을 열지 않는다).

흉내 내는 iTunes 의 동작은 CLAUDE.md 에 적힌 실측 그대로다.
- `/search` 는 KR 스토어프론트에서 앨범·곡을 **0건** 준다(200 OK). `musicArtist` 만 산다.
- `/lookup?country=KR` 은 이름을 한국어로 주지만 **KR 스토어에 없는 앨범은 통째로 빠진다.**
- `/lookup` 에 country 가 없으면 US 스토어다.
- `entity=song` + `country=KR` 은 collection 만 주고 트랙은 0개다.
"""
from __future__ import annotations

import httpx

from services.music_api import ITunesMusicService

KR = "KR"
US = None  # country 파라미터를 생략한 요청 = US 스토어프론트


def album(album_id: str, name: str, artist: str, track_count: int = 10) -> dict:
    return {
        "wrapperType": "collection",
        "collectionType": "Album",
        "collectionId": int(album_id),
        "collectionName": name,
        "artistName": artist,
        "artworkUrl100": f"https://is1.mzstatic.com/image/thumb/{album_id}/100x100bb.jpg",
        "releaseDate": "2020-01-01T00:00:00Z",
        "trackCount": track_count,
    }


def track(
    track_id: str,
    name: str,
    artist: str,
    album_id: str,
    number: int = 1,
    preview: str | None = "auto",
) -> dict:
    return {
        "wrapperType": "track",
        "kind": "song",
        "trackId": int(track_id),
        "trackName": name,
        "artistName": artist,
        "collectionId": int(album_id),
        "collectionName": f"album {album_id}",
        "artworkUrl100": f"https://is1.mzstatic.com/image/thumb/{album_id}/100x100bb.jpg",
        "trackNumber": number,
        "trackTimeMillis": 200_000,
        "trackExplicitness": "notExplicit",
        "previewUrl": (
            f"https://audio.example/{track_id}.m4a" if preview == "auto" else preview
        ),
    }


def _record_id(r: dict) -> str:
    return str(r["trackId"] if r["wrapperType"] == "track" else r["collectionId"])


class FakeITunes:
    """스토어프론트별 카탈로그를 들고 있다가 iTunes 처럼 답하고, 받은 요청을 전부 적어 둔다."""

    def __init__(self) -> None:
        # {스토어프론트: {id: 원본 레코드}} — 같은 ID 가 스토어마다 다른 이름으로 들어 있을 수 있다.
        self.catalog: dict[str | None, dict[str, dict]] = {KR: {}, US: {}}
        # `entity=song` lookup 이 country 없이 돌려줄 수록곡 {album_id: [track 레코드]}
        self.album_songs: dict[str, list[dict]] = {}
        # `/search` 결과 {entity: [레코드]} — KR 이 아닌 스토어프론트에서만 돌려준다.
        self.search_results: dict[str, list[dict]] = {}
        self.requests: list[httpx.Request] = []
        self.transport = httpx.MockTransport(self._handle)

    # ── 카탈로그 채우기 ──────────────────────────────────────────
    def add(self, record: dict, *storefronts: str | None) -> None:
        for sf in storefronts or (KR, US):
            self.catalog[sf][_record_id(record)] = record

    # ── 요청 기록 조회 ───────────────────────────────────────────
    def calls(self, path: str | None = None) -> list[dict]:
        """받은 요청을 `{"path": ..., **params}` 목록으로. path 로 거를 수 있다."""
        out = []
        for req in self.requests:
            if path and req.url.path != path:
                continue
            out.append({"path": req.url.path, **dict(req.url.params)})
        return out

    def reset_calls(self) -> None:
        self.requests.clear()

    # ── 서비스 만들기 ────────────────────────────────────────────
    def service(self) -> ITunesMusicService:
        return ITunesMusicService(client=httpx.AsyncClient(transport=self.transport))

    # ── iTunes 흉내 ─────────────────────────────────────────────
    def _handle(self, request: httpx.Request) -> httpx.Response:
        if request.url.host != "itunes.apple.com":
            raise AssertionError(f"iTunes 가 아닌 곳으로 요청이 나갔다: {request.url}")
        self.requests.append(request)
        params = request.url.params
        country = (params.get("country") or "").upper() or None

        if request.url.path == "/search":
            results = self._search(params.get("entity"), country)
        elif request.url.path == "/lookup":
            results = self._lookup(params.get("id", "").split(","), params.get("entity"), country)
        else:
            return httpx.Response(404)
        return httpx.Response(200, json={"resultCount": len(results), "results": results})

    def _search(self, entity: str | None, country: str | None) -> list[dict]:
        if country == KR and entity in ("album", "song"):
            return []  # KR 스토어프론트의 음악 카탈로그는 비어 있다
        return list(self.search_results.get(entity, []))

    def _lookup(self, ids: list[str], entity: str | None, country: str | None) -> list[dict]:
        store = self.catalog.get(country, {}) if country in (KR, US) else {}
        if entity is None:
            return [store[i] for i in ids if i in store]
        if entity == "song":
            out = []
            for i in ids:
                if i not in store:
                    continue
                out.append(store[i])
                if country is None:  # entity=song + country=KR 은 트랙이 0개로 잘린다
                    out.extend(self.album_songs.get(i, []))
            return out
        return []
