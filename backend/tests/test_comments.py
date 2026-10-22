"""댓글: 로그인·비로그인 작성, 소유 판정, 신고."""
from models.comment import Comment

TOKEN = {"X-Guest-Token": "guest-token-aaaaaaaaaaaaaaaa"}
OTHER = {"X-Guest-Token": "guest-token-bbbbbbbbbbbbbbbb"}


def _topster(client, headers):
    return client.post(
        "/api/topsters/", json={"title": "t", "width": 1, "height": 1}, headers=headers
    ).json()["id"]


def test_guest_can_write_and_token_is_stored_hashed(client, make_user, db):
    _, owner = make_user()
    tid = _topster(client, owner)

    res = client.post(
        f"/api/comments/topster/{tid}/", json={"content": "hi", "nickname": "손님"}, headers=TOKEN
    )
    assert res.status_code == 201
    body = res.json()
    assert body["author_nickname"] == "손님" and body["user"] is None and body["is_mine"] is True

    row = db.query(Comment).one()
    assert row.guest_token_hash and "guest-token" not in row.guest_token_hash  # 평문 아님


def test_empty_nickname_becomes_anonymous(client, make_user):
    _, owner = make_user()
    tid = _topster(client, owner)
    res = client.post(
        f"/api/comments/topster/{tid}/", json={"content": "hi", "nickname": "  "}, headers=TOKEN
    )
    assert res.json()["author_nickname"] == "익명"


def test_logged_in_comment_uses_account_nickname(client, make_user):
    _, owner = make_user("함상준")
    tid = _topster(client, owner)
    res = client.post(
        f"/api/comments/topster/{tid}/", json={"content": "hi", "nickname": "무시됨"}, headers=owner
    )
    assert res.json()["author_nickname"] == "함상준"


def test_only_the_author_can_edit_and_delete(client, make_user):
    _, owner = make_user()
    tid = _topster(client, owner)
    cid = client.post(
        f"/api/comments/topster/{tid}/", json={"content": "v1"}, headers=TOKEN
    ).json()["id"]
    path = f"/api/comments/topster/{tid}/{cid}"

    assert client.put(path, json={"content": "hack"}, headers=OTHER).status_code in (403, 404)
    assert client.delete(path, headers=OTHER).status_code in (403, 404)

    edited = client.put(path, json={"content": "v2"}, headers=TOKEN)
    assert edited.status_code == 200 and edited.json()["edited_at"] is not None
    assert client.delete(path, headers=TOKEN).status_code == 204


def test_list_marks_ownership_per_viewer(client, make_user):
    _, owner = make_user()
    tid = _topster(client, owner)
    client.post(f"/api/comments/topster/{tid}/", json={"content": "mine"}, headers=TOKEN)

    mine = client.get(
        f"/api/comments/topster/{tid}/", params={"guest_token": TOKEN["X-Guest-Token"]}
    ).json()
    theirs = client.get(f"/api/comments/topster/{tid}/").json()
    assert mine[0]["is_mine"] is True
    assert theirs[0]["is_mine"] is False


def test_duplicate_report_is_rejected_with_409(client, make_user):
    _, owner = make_user()
    tid = _topster(client, owner)
    cid = client.post(
        f"/api/comments/topster/{tid}/", json={"content": "x"}, headers=TOKEN
    ).json()["id"]
    path = f"/api/comments/topster/{tid}/{cid}/report"

    assert client.post(path, json={"reason": "스팸"}, headers=OTHER).status_code == 204
    assert client.post(path, json={"reason": "스팸"}, headers=OTHER).status_code == 409


def test_report_without_any_identity_is_rejected(client, make_user):
    _, owner = make_user()
    tid = _topster(client, owner)
    cid = client.post(
        f"/api/comments/topster/{tid}/", json={"content": "x"}, headers=TOKEN
    ).json()["id"]
    assert client.post(f"/api/comments/topster/{tid}/{cid}/report", json={}).status_code == 400


def test_target_type_is_validated(client):
    assert client.get("/api/comments/album/1/").status_code == 422


def test_legacy_topster_alias_shares_the_same_rows(client, make_user):
    _, owner = make_user()
    tid = _topster(client, owner)
    client.post(f"/api/topsters/{tid}/comments/", json={"content": "legacy"}, headers=TOKEN)
    assert len(client.get(f"/api/comments/topster/{tid}/").json()) == 1
