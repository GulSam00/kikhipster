"""`services/music_api.py` 의 스토어프론트 규칙 — iTunes 는 `tests/fake_itunes.py` 대역.

여기 규칙은 깨져도 에러가 안 난다(200 OK + 빈 목록, 영어 이름, 커버 없는 칸). 그래서 테스트로 묶는다.
- 배치 lookup 은 KR 먼저, **못 찾은 것만** country 없이 한 번 더(`_lookup_chunked`).
- `/search` 는 KR 을 US 로 바꿔 보낸다(`_search_country`).
- 앨범 상세는 `entity=song` 을 country 없이 부르고, 이름만 KR lookup 으로 갈아끼운다(`_localize_names`).
"""
from __future__ import annotations

import asyncio

import httpx
import pytest

from fake_itunes import KR, US, FakeITunes, album, track

IU_ALBUM = "1500000001"  # KR·US 양쪽에 있다. KR 은 한국어 이름.
BEATLES = "1441164426"  # KR 스토어에 없다 — 실측에서 KR lookup 이 누락한 그 경우.


@pytest.fixture()
def itunes() -> FakeITunes:
    fake = FakeITunes()
    fake.add(album(IU_ALBUM, "Love poem", "아이유"), KR)
    fake.add(album(IU_ALBUM, "Love poem", "IU"), US)
    fake.add(album(BEATLES, "Abbey Road", "The Beatles"), US)
    return fake


def run(coro):
    return asyncio.run(coro)


# ── _lookup_chunked: KR 먼저 → 못 찾은 것만 country 없이 ─────────────────────


def test_album_missing_in_kr_is_filled_by_lookup_without_country(itunes):
    albums = run(itunes.service().get_albums_by_ids([IU_ALBUM, BEATLES]))

    assert [a["id"] for a in albums] == [IU_ALBUM, BEATLES]  # 폴백이 없으면 비틀즈 칸이 빈다
    assert albums[0]["artist_name"] == "아이유"  # KR 에서 찾은 것은 한국어 이름 그대로
    assert albums[1]["cover_url"].endswith("600x600bb.jpg")

    first, second = itunes.calls("/lookup")
    assert first["country"] == "KR" and set(first["id"].split(",")) == {IU_ALBUM, BEATLES}
    # 폴백은 **못 찾은 ID 만**, country·entity 없이(= US).
    assert second == {"path": "/lookup", "id": BEATLES}


def test_no_fallback_call_when_kr_has_everything(itunes):
    albums = run(itunes.service().get_albums_by_ids([IU_ALBUM]))

    assert albums[0]["artist_name"] == "아이유"
    assert len(itunes.calls("/lookup")) == 1


def test_fallback_does_not_overwrite_korean_names_found_in_kr(itunes):
    """US 응답이 같은 ID 를 영어로 줘도 KR 에서 이미 찾은 것은 다시 묻지 않는다."""
    run(itunes.service().get_albums_by_ids([IU_ALBUM, BEATLES]))
    fallback = itunes.calls("/lookup")[1]
    assert IU_ALBUM not in fallback["id"].split(",")


def test_fallback_is_chunked_and_asks_only_missing_ids(itunes):
    svc = itunes.service()
    ids = [str(2_000_000_000 + n) for n in range(svc.LOOKUP_CHUNK + 10)]
    for i in ids:
        itunes.add(album(i, f"a{i}", "x"), US)
        if i not in (ids[3], ids[-1]):
            itunes.add(album(i, f"a{i}", "x"), KR)

    found = run(svc.get_albums_by_ids(ids))

    assert [a["id"] for a in found] == ids  # 요청 순서 유지, 하나도 안 빠진다
    lookups = itunes.calls("/lookup")
    assert [c.get("country") for c in lookups] == ["KR", "KR", None]  # 150 + 10, 그리고 폴백 1회
    assert lookups[2]["id"].split(",") == [ids[3], ids[-1]]


def test_tracks_use_the_same_fallback_and_drop_unknown_ids(itunes):
    itunes.add(track("900001", "봄날", "방탄소년단", IU_ALBUM), KR)
    itunes.add(track("900001", "Spring Day", "BTS", IU_ALBUM), US)
    itunes.add(track("900002", "Let It Be", "The Beatles", BEATLES), US)

    tracks = run(itunes.service().get_tracks_by_ids(["900002", "999999", "900001"]))

    assert [(t["id"], t["name"]) for t in tracks] == [("900002", "Let It Be"), ("900001", "봄날")]
    first, second = itunes.calls("/lookup")
    assert first["country"] == "KR"
    assert "country" not in second and set(second["id"].split(",")) == {"900002", "999999"}


def test_lookup_skips_records_of_other_wrapper_type(itunes):
    """`/lookup?id=` 는 앨범·트랙 ID 를 가리지 않고 받는다 — 트랙 조회에 앨범 레코드가 섞이면 안 된다."""
    tracks = run(itunes.service().get_tracks_by_ids([IU_ALBUM]))
    assert tracks == []


# ── _search_country: /search 는 US, lookup 은 KR ──────────────────────────────


@pytest.mark.parametrize(
    "method,entity,kwargs",
    [
        ("search_albums", "album", {}),
        ("search_tracks", "song", {}),
        ("search_artists", "musicArtist", {}),
    ],
)
def test_search_with_kr_market_goes_to_us_storefront(itunes, method, entity, kwargs):
    itunes.search_results = {
        "album": [album(IU_ALBUM, "Love poem", "IU")],
        "song": [track("900001", "Spring Day", "BTS", IU_ALBUM)],
        "musicArtist": [{"wrapperType": "artist", "artistId": 3296287, "artistName": "IU"}],
    }

    result = run(getattr(itunes.service(), method)("아이유", market="KR", **kwargs))

    (call,) = itunes.calls("/search")
    assert call["country"] == "US" and call["entity"] == entity
    assert len(result["items"]) == 1  # KR 로 나갔다면 앨범·곡은 0건이었다


def test_search_keeps_other_storefronts_as_is(itunes):
    run(itunes.service().search_albums("x", market="JP"))
    assert itunes.calls("/search")[0]["country"] == "JP"


# ── get_album_tracks / _localize_names ────────────────────────────────────────


def _album_with_tracks(itunes: FakeITunes) -> None:
    itunes.add(album(IU_ALBUM, "You Never Walk Alone", "BTS"), US)
    itunes.add(album(IU_ALBUM, "You Never Walk Alone", "방탄소년단"), KR)
    itunes.album_songs[IU_ALBUM] = [
        track("900002", "Not Today", "BTS", IU_ALBUM, number=2),
        track("900001", "Spring Day", "BTS", IU_ALBUM, number=1),
    ]
    # KR 레코드는 이름만 다르고 미리듣기가 없다 — 덮어쓰면 재생기가 멈춘다.
    itunes.add(track("900001", "봄날", "방탄소년단", IU_ALBUM, preview=None), KR)


def test_album_tracks_lookup_without_country_then_names_from_kr(itunes):
    _album_with_tracks(itunes)

    result = run(itunes.service().get_album_tracks(IU_ALBUM, market="KR"))

    songs, names = itunes.calls("/lookup")
    # 트랙을 받는 호출에는 country 를 얹지 않는다(얹으면 트랙이 0개로 잘린다).
    assert songs["entity"] == "song" and "country" not in songs
    # 이름 호출은 entity 없이 KR 로, 앨범 + 트랙 ID 를 한 번에.
    assert names["country"] == "KR" and "entity" not in names
    assert names["id"].split(",") == [IU_ALBUM, "900001", "900002"]

    assert result["album"]["artist_name"] == "방탄소년단"
    spring, not_today = result["tracks"]  # track_number 순
    assert (spring["name"], spring["artists"]) == ("봄날", ["방탄소년단"])
    assert spring["preview_url"] == "https://audio.example/900001.m4a"  # KR 의 None 으로 안 덮인다
    assert not_today["name"] == "Not Today"  # KR 에 없는 곡은 영어 그대로


def test_album_tracks_page_survives_name_lookup_failure(itunes):
    _album_with_tracks(itunes)
    original = itunes.transport.handler

    def failing_kr_lookup(request):
        if request.url.params.get("country") == "KR":
            itunes.requests.append(request)
            return httpx.Response(500)
        return original(request)

    itunes.transport.handler = failing_kr_lookup

    result = run(itunes.service().get_album_tracks(IU_ALBUM, market="KR"))

    assert result["album"]["artist_name"] == "BTS"
    assert [t["name"] for t in result["tracks"]] == ["Spring Day", "Not Today"]


def test_kr_only_album_is_found_through_market_storefront(itunes):
    """US lookup 에 collection 이 없으면 사용자 스토어프론트(KR)로 한 번 더 묻는다."""
    itunes.add(album("1600000001", "Armageddon", "aespa"), KR)
    # 실측: KR 앨범은 country 없는 entity=song 에서 결과 0 — US 카탈로그에 넣지 않는다.

    result = run(itunes.service().get_album_tracks("1600000001", market="KR"))

    first, second = itunes.calls("/lookup")[:2]
    assert "country" not in first
    assert second["country"] == "KR" and second["entity"] == "song"
    assert result["album"]["title"] == "Armageddon"
