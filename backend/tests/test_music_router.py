"""`/api/music/*` 라우터 — 진짜 서비스 + DB 캐시, iTunes 만 대역(`fake_itunes` 픽스처).

라우터에서 지킬 것:
- 저장된 탑스터의 커버(`/albums?ids=`)는 KR 에 없는 앨범도 채운다.
- 캐시에 맞으면 iTunes 를 **0회** 부른다 — '없음'(tombstone)도 마찬가지.
- 검색은 US 로 나가고, 이름은 KR lookup 으로 바꿔 돌려준다. 두 번째 검색부터 lookup 은 캐시가 받는다.
- 앨범 상세의 트랙 0개 결과는 캐시하지 않는다 — 다음 요청에서 다시 시도한다.
"""
from __future__ import annotations

from fake_itunes import KR, US, album, artist, track

IU_ALBUM = "1500000001"
BEATLES = "1441164426"  # KR 스토어에 없는 앨범
SPRING_DAY = "900001"


def _seed(fake) -> None:
    fake.add(album(IU_ALBUM, "Love poem", "아이유"), KR)
    fake.add(album(IU_ALBUM, "Love poem", "IU"), US)
    fake.add(album(BEATLES, "Abbey Road", "The Beatles"), US)
    fake.add(track(SPRING_DAY, "봄날", "방탄소년단", IU_ALBUM), KR)
    fake.add(track(SPRING_DAY, "Spring Day", "BTS", IU_ALBUM), US)


# ── KR 에 없는 앨범 폴백 ─────────────────────────────────────────────────────


def test_saved_topster_covers_include_album_missing_in_kr(fake_itunes):
    fake, client = fake_itunes
    _seed(fake)

    resp = client.get("/api/music/albums", params={"ids": f"{IU_ALBUM},{BEATLES}"})

    assert resp.status_code == 200
    body = resp.json()
    assert [a["id"] for a in body] == [IU_ALBUM, BEATLES]
    assert body[0]["artist_name"] == "아이유"
    assert body[1]["title"] == "Abbey Road" and body[1]["cover_url"]
    assert [c.get("country") for c in fake.calls("/lookup")] == ["KR", None]


# ── 캐시 적중 시 iTunes 0회 ──────────────────────────────────────────────────


def test_album_batch_cache_hit_makes_zero_itunes_calls(fake_itunes):
    fake, client = fake_itunes
    _seed(fake)
    ids = {"ids": f"{IU_ALBUM},{BEATLES},1999999999"}  # 마지막은 어디에도 없는 ID

    first = client.get("/api/music/albums", params=ids).json()
    assert len(fake.requests) > 0
    fake.reset_calls()

    second = client.get("/api/music/albums", params=ids).json()

    assert second == first and [a["id"] for a in second] == [IU_ALBUM, BEATLES]
    assert fake.requests == []  # '없음'으로 확인된 ID 도 다시 묻지 않는다


def test_track_batch_cache_hit_makes_zero_itunes_calls(fake_itunes):
    fake, client = fake_itunes
    _seed(fake)

    first = client.get("/api/music/tracks", params={"ids": SPRING_DAY}).json()
    assert first[0]["name"] == "봄날"
    fake.reset_calls()

    assert client.get("/api/music/tracks", params={"ids": SPRING_DAY}).json() == first
    assert fake.requests == []


def test_album_detail_cache_hit_makes_zero_itunes_calls(fake_itunes):
    fake, client = fake_itunes
    _seed(fake)
    fake.album_songs[IU_ALBUM] = [track(SPRING_DAY, "Spring Day", "BTS", IU_ALBUM)]

    first = client.get(f"/api/music/albums/{IU_ALBUM}/tracks")
    assert first.status_code == 200
    assert first.json()["tracks"][0]["name"] == "봄날"
    fake.reset_calls()

    second = client.get(f"/api/music/albums/{IU_ALBUM}/tracks")
    assert second.json() == first.json()
    assert fake.requests == []


KR_ONLY = "1745285216"  # KR 판 ID — ② 에서만 collection 이 잡히고 트랙은 어디서도 안 온다
SIBLING = "1773694541"  # 같은 앨범의 그 밖 판
AESPA = "1540251304"


def _seed_kr_only(fake, with_sibling: bool) -> None:
    name = "Armageddon - The 1st Album"
    fake.add(album(KR_ONLY, name, "aespa", track_count=1, artist_id=AESPA), KR)
    fake.add(artist(AESPA, "aespa"), US)
    if with_sibling:
        fake.add(album(SIBLING, name, "aespa", track_count=1, artist_id=AESPA), US)
        fake.album_songs[SIBLING] = [
            track("1773694600", "Supernova", "aespa", SIBLING, artist_id=AESPA,
                  collection_name=name, track_count=1),
        ]


def test_album_detail_with_zero_tracks_is_not_cached(fake_itunes):
    fake, client = fake_itunes
    _seed_kr_only(fake, with_sibling=False)

    first = client.get(f"/api/music/albums/{KR_ONLY}/tracks")
    assert first.status_code == 200 and first.json()["tracks"] == []
    fake.reset_calls()

    second = client.get(f"/api/music/albums/{KR_ONLY}/tracks")
    assert second.json()["tracks"] == []
    assert len(fake.requests) > 0  # 0곡은 저장되지 않아 다시 iTunes 에 묻는다


def test_album_detail_borrowed_from_sibling_is_cached_under_kr_id(fake_itunes):
    fake, client = fake_itunes
    _seed_kr_only(fake, with_sibling=True)

    first = client.get(f"/api/music/albums/{KR_ONLY}/tracks").json()
    assert first["album"]["id"] == KR_ONLY
    assert [t["name"] for t in first["tracks"]] == ["Supernova"]
    fake.reset_calls()

    assert client.get(f"/api/music/albums/{KR_ONLY}/tracks").json() == first
    assert fake.requests == []


# ── 검색은 US, 이름은 KR lookup ──────────────────────────────────────────────


def test_album_search_goes_to_us_and_names_come_from_kr_lookup(fake_itunes):
    fake, client = fake_itunes
    _seed(fake)
    fake.search_results["album"] = [album(IU_ALBUM, "Love poem", "IU")]

    resp = client.get("/api/music/search/albums", params={"q": "아이유"})  # market 기본값 KR

    assert resp.status_code == 200
    assert [a["artist_name"] for a in resp.json()["items"]] == ["아이유"]
    (search,) = fake.calls("/search")
    assert search["country"] == "US" and search["entity"] == "album"
    (lookup,) = fake.calls("/lookup")
    assert lookup["country"] == "KR" and lookup["id"] == IU_ALBUM

    # 두 번째 검색부터 이름 lookup 은 DB 캐시가 받는다.
    fake.reset_calls()
    client.get("/api/music/search/albums", params={"q": "아이유"})
    assert [c["path"] for c in fake.calls()] == ["/search"]


def test_track_search_goes_to_us_and_names_come_from_kr_lookup(fake_itunes):
    fake, client = fake_itunes
    _seed(fake)
    fake.search_results["song"] = [track(SPRING_DAY, "Spring Day", "BTS", IU_ALBUM)]

    resp = client.get("/api/music/search/tracks", params={"q": "spring day"})

    item = resp.json()["items"][0]
    assert (item["name"], item["artists"]) == ("봄날", ["방탄소년단"])
    assert fake.calls("/search")[0]["country"] == "US"
    assert fake.calls("/lookup")[0]["country"] == "KR"


def test_artist_search_goes_to_us_storefront(fake_itunes):
    fake, client = fake_itunes
    fake.search_results["musicArtist"] = [
        {"wrapperType": "artist", "artistId": 3296287, "artistName": "IU"}
    ]

    resp = client.get("/api/music/search/artists", params={"q": "아이유"})

    assert resp.json()["items"][0]["id"] == "3296287"
    assert fake.calls("/search")[0]["country"] == "US"


def test_search_item_unresolved_by_lookup_is_kept_and_cached(fake_itunes):
    """검색은 주는데 lookup 은 KR·US 어디서도 못 푸는 앨범 — 버리지 않고, tombstone 도 덮는다."""
    fake, client = fake_itunes
    ghost = "1508421225"
    fake.search_results["album"] = [album(ghost, "Ghost", "Someone")]

    resp = client.get("/api/music/search/albums", params={"q": "ghost"})
    assert [a["id"] for a in resp.json()["items"]] == [ghost]

    fake.reset_calls()
    cover = client.get("/api/music/albums", params={"ids": ghost}).json()
    assert [a["id"] for a in cover] == [ghost]  # 하루짜리 '없음'으로 남지 않았다
    assert fake.requests == []
