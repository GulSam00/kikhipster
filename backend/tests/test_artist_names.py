"""아티스트 한국어 이름 — 순수 함수 + 상세/검색 라우트(Wikidata·iTunes 는 가짜로 대체).

해석 규칙의 근거는 `_workspace/spike_ko_names_README.md`.
"""
import httpx
import pytest

from services.artist_names import clean_label, pick_hangul_artist_name


@pytest.mark.parametrize(
    "label,expected",
    [
        ("아이유", "아이유"),
        ("딘 (가수)", "딘"),  # 끝의 동음이의 괄호 표기는 뗀다
        ("NewJeans", None),  # 한글이 없는 '한국어 라벨'은 병기할 이름이 아니다
        ("EXO", None),
        ("", None),
        (None, None),
    ],
)
def test_clean_label(label, expected):
    assert clean_label(label) == expected


def test_pick_hangul_ignores_collaborations_and_foreign():
    names = ["Epik High", "周笔畅 & 에픽하이", "에픽하이", "에픽하이", "혁오 & Sunset Rollercoaster"]
    assert pick_hangul_artist_name(names) == "에픽하이"
    assert pick_hangul_artist_name(["HYUKOH", "Nosaj Thing & 혁오"]) is None
    assert pick_hangul_artist_name([]) is None


class FakeService:
    """music_service 대역. Wikidata 응답은 MockTransport 로, iTunes 쪽은 메서드로 흉내 낸다."""

    def __init__(self, wikidata_label=None, wikidata_fails=False, album_names=()):
        self.wikidata_calls = 0
        self.album_calls = 0
        self._album_names = list(album_names)

        def handler(request: httpx.Request) -> httpx.Response:
            self.wikidata_calls += 1
            if wikidata_fails:
                return httpx.Response(500)
            rows = [{"ko": {"value": wikidata_label}}] if wikidata_label else [{}]
            return httpx.Response(200, json={"results": {"bindings": rows}})

        self._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    async def get_artist_detail(self, artist_id):
        return {"id": artist_id, "name": "IU", "image_url": None, "genres": ["K-Pop"], "popularity": 0}

    async def get_artist_album_artist_names(self, artist_id):
        self.album_calls += 1
        return self._album_names

    async def search_artists(self, q, market="KR", limit=20):
        return {
            "items": [{"id": "111", "name": "IU", "image_url": None, "genres": [], "popularity": 0}],
            "total": 1,
        }


@pytest.fixture()
def use_service(client):
    from main import app

    def _use(service):
        app.state.music_service = service
        return client

    yield _use
    del app.state.music_service


def test_detail_resolves_via_wikidata_and_persists(use_service, db):
    from models.artist_name import ArtistName

    svc = FakeService(wikidata_label="아이유")
    client = use_service(svc)

    body = client.get("/api/music/artists/111").json()
    assert body["name"] == "IU" and body["name_ko"] == "아이유"

    row = db.get(ArtistName, "111")
    assert row.name_ko == "아이유" and row.source == "wikidata"

    # 두 번째 열기는 저장된 값을 쓴다 — 외부 호출이 늘지 않는다.
    assert client.get("/api/music/artists/111").json()["name_ko"] == "아이유"
    assert svc.wikidata_calls == 1


def test_detail_falls_back_to_korean_album_artist_name(use_service, db):
    from models.artist_name import ArtistName

    svc = FakeService(album_names=["Epik High", "周笔畅 & 에픽하이", "에픽하이"])
    body = use_service(svc).get("/api/music/artists/111").json()
    assert body["name_ko"] == "에픽하이"
    assert db.get(ArtistName, "111").source == "itunes_album"


def test_detail_without_korean_name_stores_negative_result(use_service, db):
    from models.artist_name import ArtistName

    svc = FakeService(album_names=["Taylor Swift"])
    client = use_service(svc)
    assert client.get("/api/music/artists/111").json()["name_ko"] is None
    assert db.get(ArtistName, "111").name_ko is None

    client.get("/api/music/artists/111")
    assert svc.wikidata_calls == 1  # '없음'도 기억해서 매번 다시 묻지 않는다


def test_lookup_failure_is_not_persisted_and_page_still_works(use_service, db):
    from models.artist_name import ArtistName

    svc = FakeService(wikidata_fails=True)
    resp = use_service(svc).get("/api/music/artists/111")
    assert resp.status_code == 200
    assert resp.json()["name"] == "IU" and resp.json()["name_ko"] is None
    # 실패를 '없음'으로 적으면 영구히 영어로 남는다.
    assert db.get(ArtistName, "111") is None


def test_search_attaches_only_stored_names(use_service, db):
    from services import artist_names

    svc = FakeService(wikidata_label="아이유")
    client = use_service(svc)

    # 아직 저장 전: 검색은 외부 호출 없이 영어 이름만.
    first = client.get("/api/music/search/artists", params={"q": "IU"}).json()
    assert first["items"][0]["name_ko"] is None
    assert svc.wikidata_calls == 0

    artist_names.save(db, "111", "아이유", "wikidata")
    second = client.get("/api/music/search/artists", params={"q": "IU"}).json()
    assert second["items"][0]["name_ko"] == "아이유"
    assert svc.wikidata_calls == 0
