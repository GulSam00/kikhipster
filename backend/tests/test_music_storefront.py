"""`services/music_api.py` 의 스토어프론트 규칙 — iTunes 는 `tests/fake_itunes.py` 대역.

여기 규칙은 깨져도 에러가 안 난다(200 OK + 빈 목록, 영어 이름, 커버 없는 칸). 그래서 테스트로 묶는다.
- 배치 lookup 은 KR 먼저, **못 찾은 것만** country 없이 한 번 더(`_lookup_chunked`).
- `/search` 는 KR 을 US 로 바꿔 보낸다(`_search_country`).
- 앨범 상세는 `entity=song` 을 country 없이 부르고, 이름만 KR lookup 으로 갈아끼운다(`_localize_names`).
- KR 판 ID 앨범 상세는 같은 앨범의 그 밖 판(같은 artistId + 정규화 이름 + trackCount ±2)에서 트랙만 빌려 온다.
"""
from __future__ import annotations

import asyncio

import httpx
import pytest

from fake_itunes import KR, US, FakeITunes, album, artist, track
from services.music_api import (
    editions_from_tracks,
    normalize_collection_name,
    pick_sibling_edition,
)

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
    # 실측(2026-11-19 재확인): KR 스토어 전용 ID(예: aespa Armageddon KR판 1745285216,
    # IU Believe in Love 1577664507)는 country 없는 entity=song 에서 결과 0, country=KR 에서
    # collection 1 + track 0 — 그래서 US 카탈로그에 넣지 않는다. 같은 앨범의 그 밖 판
    # ID(1773694541)는 반대로 country 없음에서만 트랙까지 온다(ID 가 다른 별개 레코드).

    result = run(itunes.service().get_album_tracks("1600000001", market="KR"))

    first, second = itunes.calls("/lookup")[:2]
    assert "country" not in first
    assert second["country"] == "KR" and second["entity"] == "song"
    assert result["album"]["title"] == "Armageddon"


def test_album_tracks_search_fallback_goes_to_us_storefront(itunes):
    """③단계(lookup 이 트랙을 안 줄 때 검색으로 채우기)도 `/search` 라 KR 을 US 로 바꿔야 한다.

    2026-11-12 실측(`/search?entity=song&term=aespa Armageddon`, 대상 collectionId 1773694541):
    KR 0건 / US 19건 중 10건 일치 / country 생략 19건 중 10건 일치. KR 로 나가면 트랙이 조용히 0개다.
    """
    itunes.add(album("1773694541", "Armageddon - The 1st Album", "aespa"), US)
    # album_songs 를 비워 둔다 → lookup 은 collection 만 주고 트랙 0개 → ③단계로 간다.
    itunes.search_results = {
        "song": [
            track("1773694600", "Supernova", "aespa", "1773694541", number=1),
            track("1773694601", "Armageddon", "aespa", "1773694541", number=2),
            track("1766846600", "Supernova (Remix)", "aespa", "1766846514"),  # 다른 앨범
        ],
    }

    result = run(itunes.service().get_album_tracks("1773694541", market="KR"))

    (search,) = itunes.calls("/search")
    assert search["country"] == "US" and search["entity"] == "song"
    assert [t["id"] for t in result["tracks"]] == ["1773694600", "1773694601"]


# ── KR 판 ID → 같은 앨범의 그 밖 판에서 트랙 빌려 오기 (이슈 20261119-1455) ─────────────
#
# 실측(2026-11-20, 표본 28건): KR 판 ID 는 ① country 없는 entity=song 결과 0, ② country=KR
# collection 1 + track 0, ③ US 곡 검색 결과는 그 밖 판 ID 로만 와서 collectionId 필터에 0건.

AESPA = "1540251304"
ARMAGEDDON_KR = "1745285216"
ARMAGEDDON = "1773694541"  # 그 밖 판(country 없음에서만 트랙까지 온다)
ARMAGEDDON_NAME = "Armageddon - The 1st Album"


def _armageddon_songs(album_id: str = ARMAGEDDON, count: int = 3, name: str = ARMAGEDDON_NAME) -> list[dict]:
    titles = ["Supernova", "Armageddon", "Set The Tone"]
    return [
        track(
            f"{album_id}{n}", titles[n % 3], "aespa", album_id, number=n + 1,
            artist_id=AESPA, collection_name=name, track_count=count,
            release_date="2024-05-27T12:00:00Z",
        )
        for n in range(count)
    ]


def _kr_only_armageddon(itunes: FakeITunes, *, kr_artist_id: str = AESPA, count: int = 3) -> None:
    """KR 판은 KR 스토어에만(② 에서만 collection 이 잡힌다), 그 밖 판은 US 에만."""
    itunes.add(
        album(ARMAGEDDON_KR, ARMAGEDDON_NAME, "aespa", track_count=count,
              artist_id=kr_artist_id, release_date="2024-05-27T07:00:00Z"),
        KR,
    )
    itunes.add(
        album(ARMAGEDDON, ARMAGEDDON_NAME, "aespa", track_count=count,
              artist_id=AESPA, release_date="2024-05-27T07:00:00Z"),
        US,
    )
    itunes.album_songs[ARMAGEDDON] = _armageddon_songs(count=count)


def test_kr_only_album_borrows_tracks_from_sibling_in_search_results(itunes):
    """A-1: ③ 검색 결과가 그 밖 판 ID 로만 와도 같은 artistId + 이름이면 그 곡을 쓴다(추가 호출 0)."""
    _kr_only_armageddon(itunes)
    itunes.search_results = {
        "song": _armageddon_songs() + [
            # 동명 곡이 든 다른 앨범 — 섞이면 안 된다.
            track("1766846600", "Supernova (Remix)", "aespa", "1766846514",
                  artist_id=AESPA, collection_name="Supernova (Remixes) - Single", track_count=2),
        ],
    }

    result = run(itunes.service().get_album_tracks(ARMAGEDDON_KR, market="KR"))

    # 앨범 식별자·메타는 요청받은 KR 판 그대로, 트랙만 그 밖 판에서.
    assert result["album"]["id"] == ARMAGEDDON_KR
    assert result["album"]["title"] == ARMAGEDDON_NAME
    assert [t["name"] for t in result["tracks"]] == ["Supernova", "Armageddon", "Set The Tone"]
    assert all(t["preview_url"] for t in result["tracks"])
    # 호출은 기존과 같다: ① lookup, ② KR lookup, ③ US 검색, 이름 KR lookup. 아티스트 목록은 안 탄다.
    assert [c["path"] for c in itunes.calls()] == ["/lookup", "/lookup", "/search", "/lookup"]
    assert not [c for c in itunes.calls("/lookup") if c.get("entity") == "album"]


def test_kr_only_album_falls_back_to_artist_album_list(itunes):
    """A-2: 검색이 그 밖 판을 못 보여 주면 아티스트 앨범 목록(country 없음)에서 찾는다 — 정확히 +2회."""
    _kr_only_armageddon(itunes)
    itunes.add(artist(AESPA, "aespa"), US)
    itunes.search_results = {"song": []}

    result = run(itunes.service().get_album_tracks(ARMAGEDDON_KR, market="KR"))

    assert result["album"]["id"] == ARMAGEDDON_KR
    assert [t["name"] for t in result["tracks"]] == ["Supernova", "Armageddon", "Set The Tone"]

    lookups = itunes.calls("/lookup")
    assert len(lookups) == 5 and len(itunes.calls("/search")) == 1  # A-1 경로(4회)보다 정확히 2회 많다
    artist_list, songs = lookups[2], lookups[3]
    assert artist_list == {"path": "/lookup", "id": AESPA, "entity": "album", "limit": "200"}
    # 곡 lookup 에는 country 를 얹지 않는다(CLAUDE.md 함정 — 얹으면 트랙 0개).
    assert songs == {"path": "/lookup", "id": ARMAGEDDON, "entity": "song", "limit": "200"}
    assert lookups[4]["country"] == "KR"  # 이름 한국어화는 한 번 시도한다


def test_sibling_with_closest_track_count_wins(itunes):
    """실측의 Whiplash (English Version): KR 3곡 판에 1곡짜리 판이 붙던 오매칭이 재현되지 않아야 한다."""
    name = "Whiplash (English Version) - Single"
    itunes.add(album("1772644600", name, "aespa", track_count=3, artist_id=AESPA), KR)
    one_song = _armageddon_songs("1772000001", count=1, name=name)
    three_songs = _armageddon_songs("1772000003", count=3, name=name)
    itunes.search_results = {"song": one_song + three_songs}  # 1곡 판이 먼저 온다

    result = run(itunes.service().get_album_tracks("1772644600", market="KR"))

    assert len(result["tracks"]) == 3
    assert {t["id"] for t in result["tracks"]} == {str(t["trackId"]) for t in three_songs}


def test_sibling_with_track_count_diff_over_two_is_rejected(itunes):
    """TWICE `ENEMY - Single` 1곡(KR) ↔ 9곡 판 — 같은 이름이라도 다른 발매물이다."""
    itunes.add(album("1830000001", "ENEMY - Single", "TWICE", track_count=1, artist_id="1203816887"), KR)
    itunes.add(artist("1203816887", "TWICE"), US)
    itunes.add(album("1830000009", "ENEMY", "TWICE", track_count=9, artist_id="1203816887"), US)
    nine = [
        track(f"18300090{n:02d}", f"song {n}", "TWICE", "1830000009", number=n + 1,
              artist_id="1203816887", collection_name="ENEMY", track_count=9)
        for n in range(9)
    ]
    itunes.album_songs["1830000009"] = nine
    itunes.search_results = {"song": nine}

    result = run(itunes.service().get_album_tracks("1830000001", market="KR"))

    assert result["tracks"] == []
    # 아티스트 목록에서도 같은 이유로 거절 → 곡 lookup 은 나가지 않는다.
    assert [c.get("entity") for c in itunes.calls("/lookup")] == ["song", "song", "album", None]


def test_collaboration_with_different_artist_id_is_not_matched(itunes):
    """합작 `K-POP ScreaM 2`: KR 판(NCT 127 & aespa)과 US 판(aespa & NCT 127)의 artistId 가 다르다."""
    collab_kr, collab_us = "1235849306", AESPA
    name = "K-POP ScreaM 2"
    itunes.add(album("1550000001", name, "NCT 127 & aespa", track_count=3, artist_id=collab_kr), KR)
    itunes.add(artist(collab_kr, "NCT 127 & aespa"), US)
    itunes.add(album("1550000002", name, "aespa & NCT 127", track_count=3, artist_id=collab_us), US)
    itunes.album_songs["1550000002"] = _armageddon_songs("1550000002", name=name)
    itunes.search_results = {"song": _armageddon_songs("1550000002", name=name)}

    result = run(itunes.service().get_album_tracks("1550000001", market="KR"))

    assert result["album"]["id"] == "1550000001"
    assert result["tracks"] == []


def test_album_tracks_by_same_id_still_wins_over_siblings(itunes):
    """검색 결과에 요청 ID 의 곡이 있으면 그 밖 판은 보지 않는다(기존 동작)."""
    _kr_only_armageddon(itunes)
    own = _armageddon_songs(ARMAGEDDON_KR, count=2)
    itunes.search_results = {"song": _armageddon_songs() + own}

    result = run(itunes.service().get_album_tracks(ARMAGEDDON_KR, market="KR"))

    assert [t["id"] for t in result["tracks"]] == [str(t["trackId"]) for t in own]


# ── 매칭 순수 함수 ────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Armageddon - The 1st Album", "armageddon - the 1st album"),
        ("Whiplash - EP", "whiplash"),
        ("ENEMY - Single", "enemy"),
        ("ENEMY – single ", "enemy"),  # en dash, 소문자, 꼬리 공백
        ("  Drama   -  The 4th Mini Album ", "drama - the 4th mini album"),
        ("ＭＯＲＥ ＆ ＭＯＲＥ", "more & more"),  # 전각 → NFKC
        ("Sleep", "sleep"),  # 단어 끝 ep 는 꼬리가 아니다
        (None, ""),
    ],
)
def test_normalize_collection_name(raw, expected):
    assert normalize_collection_name(raw) == expected


def _edition(cid, name="Drama - EP", artist_id=AESPA, count=4, date="2023-11-10T00:00:00Z"):
    return {"collectionId": cid, "collectionName": name, "artistId": artist_id,
            "trackCount": count, "releaseDate": date}


def test_pick_sibling_prefers_track_count_then_release_date():
    target = _edition("1", name="Drama - The 4th Mini Album - EP", count=6)
    picked = pick_sibling_edition(target, [
        _edition("2", name="Drama - The 4th Mini Album", count=4),             # 차이 2
        _edition("3", name="drama - the 4th mini album", count=5, date="2024-01-01T00:00:00Z"),
        _edition("4", name="Drama - The 4th Mini Album", count=7, date="2023-11-11T00:00:00Z"),
    ])
    assert picked["collectionId"] == "4"  # 차이 1 인 둘 중 날짜가 가까운 쪽


def test_pick_sibling_rejects_self_other_artist_and_big_count_gap():
    target = _edition("1", count=4)
    assert pick_sibling_edition(target, [
        _edition("1"),                       # 자기 자신
        _edition("2", artist_id="999"),      # 다른 artistId
        _edition("3", count=7),              # 차이 3
        _edition("4", name="Drama (Remixes)"),
    ]) is None
    assert pick_sibling_edition(_edition("1", artist_id=None), [_edition("2")]) is None


def test_editions_from_tracks_groups_by_collection():
    songs = _armageddon_songs() + [
        track("1", "feat", "aespa & X", ARMAGEDDON, artist_id="777",
              collection_name=ARMAGEDDON_NAME, track_count=3, release_date="2024-06-01T00:00:00Z"),
    ]
    (edition,) = editions_from_tracks(songs, AESPA)
    assert edition["collectionId"] == ARMAGEDDON and edition["artistId"] == AESPA
    assert edition["trackCount"] == 3 and edition["releaseDate"].startswith("2024-06-01")
