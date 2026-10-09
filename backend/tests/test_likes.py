"""좋아요 토글·조회·배치."""


def test_toggle_needs_login(client):
    assert client.post("/api/likes/track/123").status_code == 401


def test_toggle_on_off_and_counts(client, make_user):
    _, a = make_user("a")
    _, b = make_user("b")

    first = client.post("/api/likes/track/123", headers=a).json()
    assert first == {"liked": True, "like_count": 1}
    assert client.post("/api/likes/track/123", headers=b).json()["like_count"] == 2

    off = client.post("/api/likes/track/123", headers=a).json()
    assert off == {"liked": False, "like_count": 1}


def test_status_reflects_viewer(client, make_user):
    _, a = make_user()
    client.post("/api/likes/album/9", headers=a)
    assert client.get("/api/likes/album/9", headers=a).json() == {"liked": True, "like_count": 1}
    # 비로그인은 수만 본다.
    assert client.get("/api/likes/album/9").json() == {"liked": False, "like_count": 1}


def test_batch_returns_status_per_id(client, make_user):
    _, a = make_user()
    client.post("/api/likes/track/1", headers=a)
    res = client.get("/api/likes/batch/track", params={"ids": "1,2"}, headers=a)
    assert res.status_code == 200
    body = res.json()
    assert body["1"] == {"liked": True, "like_count": 1}
    assert body["2"] == {"liked": False, "like_count": 0}


def test_batch_route_is_not_shadowed_by_target_route(client):
    """선언 순서가 바뀌면 /batch/track 이 target_type='batch' 로 잡힌다."""
    res = client.get("/api/likes/batch/track", params={"ids": "1"})
    assert res.status_code == 200 and "1" in res.json()
