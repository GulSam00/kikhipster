"""탑스터 CRUD, 권한, 검증, 삭제 연쇄."""
from models.comment import Comment
from models.like import Like


def _payload(**over):
    body = {
        "title": "내 탑스터",
        "width": 3,
        "height": 3,
        "items": [
            {"album_spotify_id": "100", "position": 0},
            {"album_spotify_id": "200", "position": 4},
        ],
    }
    body.update(over)
    return body


def test_create_requires_login(client):
    assert client.post("/api/topsters/", json=_payload()).status_code == 401


def test_create_and_get(client, make_user):
    _, headers = make_user()
    res = client.post("/api/topsters/", json=_payload(), headers=headers)
    assert res.status_code == 201
    created = res.json()
    # UUID PK 가 str 로 직렬화돼야 한다(과거에 행이 생기는 순간 전수 500 이었던 버그).
    assert isinstance(created["id"], str)
    assert [i["position"] for i in created["items"]] == [0, 4]

    got = client.get(f"/api/topsters/{created['id']}")
    assert got.status_code == 200
    assert got.json()["title"] == "내 탑스터"
    assert got.json()["like_count"] == 0 and got.json()["comment_count"] == 0


def test_validation_rejects_bad_grid_color_and_position(client, make_user):
    _, headers = make_user()
    for bad in (
        _payload(width=6),  # 한 변 최대 5
        _payload(background_color="red"),  # #RGB/#RRGGBB 만
        _payload(items=[{"album_spotify_id": "1", "position": 9}]),  # 3x3 밖
    ):
        assert client.post("/api/topsters/", json=bad, headers=headers).status_code == 422


def test_only_owner_can_update_or_delete(client, make_user):
    _, owner = make_user("owner")
    _, other = make_user("other")
    tid = client.post("/api/topsters/", json=_payload(), headers=owner).json()["id"]

    assert client.put(f"/api/topsters/{tid}", json={"title": "x"}, headers=other).status_code == 403
    assert client.delete(f"/api/topsters/{tid}", headers=other).status_code == 403
    assert (
        client.put(f"/api/topsters/{tid}", json={"title": "새 제목"}, headers=owner).status_code
        == 200
    )
    assert client.get(f"/api/topsters/{tid}").json()["title"] == "새 제목"
    assert client.delete(f"/api/topsters/{tid}", headers=owner).status_code == 204
    assert client.get(f"/api/topsters/{tid}").status_code == 404


def test_list_search_and_popular_sort(client, make_user):
    _, headers = make_user()
    a = client.post("/api/topsters/", json=_payload(title="라디오헤드 모음"), headers=headers).json()["id"]
    b = client.post("/api/topsters/", json=_payload(title="재즈 모음"), headers=headers).json()["id"]

    found = client.get("/api/topsters/", params={"q": "라디오"}).json()
    assert [t["id"] for t in found] == [a]

    client.post(f"/api/likes/topster/{b}", headers=headers)
    popular = client.get("/api/topsters/", params={"sort": "popular"}).json()
    assert popular[0]["id"] == b
    assert client.get("/api/topsters/", params={"sort": "nope"}).status_code == 422


def test_view_counter_only_moves_on_post(client, make_user):
    _, headers = make_user()
    tid = client.post("/api/topsters/", json=_payload(), headers=headers).json()["id"]
    client.get(f"/api/topsters/{tid}")
    client.get(f"/api/topsters/{tid}")
    assert client.get(f"/api/topsters/{tid}").json()["view_count"] == 0
    assert client.post(f"/api/topsters/{tid}/view").status_code == 204
    assert client.get(f"/api/topsters/{tid}").json()["view_count"] == 1


def test_delete_cascades_comments_and_likes(client, make_user, db):
    """FK 가 없는 다형성 테이블(comments·likes)이 고아로 남지 않는다."""
    _, headers = make_user()
    tid = client.post("/api/topsters/", json=_payload(), headers=headers).json()["id"]
    cid = client.post(
        f"/api/comments/topster/{tid}/", json={"content": "hi"}, headers=headers
    ).json()["id"]
    client.post(f"/api/likes/topster/{tid}", headers=headers)
    client.post(f"/api/likes/comment/{cid}", headers=headers)

    assert db.query(Like).count() == 2 and db.query(Comment).count() == 1
    assert client.delete(f"/api/topsters/{tid}", headers=headers).status_code == 204
    db.expire_all()
    assert db.query(Like).count() == 0
    assert db.query(Comment).count() == 0
