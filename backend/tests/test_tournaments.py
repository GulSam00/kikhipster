"""월드컵 정의·플레이(대진·투표)·랭킹·삭제 연쇄."""
from models.comment import Comment
from models.like import Like
from models.tournament import TournamentPlay


def _create(client, headers, n=8, **over):
    body = {
        "title": "월드컵",
        "item_type": "track",
        "item_ids": [str(1000 + i) for i in range(n)],
    }
    body.update(over)
    return client.post("/api/tournaments/", json=body, headers=headers)


def _play(client, tid, size, headers=None):
    return client.post(
        f"/api/tournaments/{tid}/plays", json={"size": size}, headers=headers or {}
    )


def _finish(client, play, headers=None, pick="a"):
    """모든 경기를 a(또는 b) 쪽으로 몰아 끝까지 진행한다. 마지막 응답을 돌려준다."""
    headers = headers or {}
    pid = play["id"]
    while True:
        cur = client.get(f"/api/plays/{pid}").json()
        pending = [r for r in cur["rounds"] if not r["winner_id"]]
        if cur["status"] == "completed" or not pending:
            return cur
        top = max(r["round_num"] for r in pending)
        match = min((r for r in pending if r["round_num"] == top), key=lambda r: r["match_num"])
        winner = match["item_a_id"] if pick == "a" else match["item_b_id"]
        res = client.post(
            f"/api/plays/{pid}/rounds/{match['id']}/vote",
            json={"winner_id": winner},
            headers=headers,
        )
        assert res.status_code == 200, res.text


def test_create_requires_login_and_validates_pool_size(client, make_user):
    assert _create(client, {}).status_code == 401
    _, headers = make_user()
    assert _create(client, headers, n=3).status_code == 422  # 최소 4개
    assert _create(client, headers, item_type="artist").status_code == 422
    assert _create(client, headers, n=4).status_code == 201


def test_detail_and_available_sizes(client, make_user):
    _, headers = make_user()
    tid = _create(client, headers, n=20).json()["id"]
    detail = client.get(f"/api/tournaments/{tid}").json()
    assert detail["item_count"] == 20
    assert detail["available_sizes"] == [4, 8, 16]  # 풀보다 큰 강수는 안 나온다


def test_only_owner_can_edit_or_delete_and_type_is_fixed(client, make_user):
    _, owner = make_user("owner")
    _, other = make_user("other")
    tid = _create(client, owner).json()["id"]

    assert client.put(f"/api/tournaments/{tid}", json={"title": "x"}, headers=other).status_code == 403
    assert client.delete(f"/api/tournaments/{tid}", headers=other).status_code == 403
    assert client.put(f"/api/tournaments/{tid}", json={"title": "수정"}, headers=owner).status_code == 200
    assert client.get(f"/api/tournaments/{tid}").json()["title"] == "수정"


def test_play_rejects_invalid_or_oversized_bracket(client, make_user):
    _, headers = make_user()
    tid = _create(client, headers, n=8).json()["id"]
    assert _play(client, tid, 5).status_code == 400  # 허용 강수 아님
    assert _play(client, tid, 16).status_code == 400  # 풀(8)보다 큼
    assert _play(client, tid, 8).status_code == 201


def test_anonymous_play_builds_full_first_round_and_finishes(client, make_user):
    _, headers = make_user()
    tid = _create(client, headers, n=8).json()["id"]
    play = _play(client, tid, 8).json()  # 비로그인

    first = [r for r in play["rounds"] if r["round_num"] == 3]  # 8강 = 지수 3
    assert len(first) == 4 and play["status"] == "in_progress"
    # 풀에서 겹치지 않게 8개를 뽑았다.
    ids = [r["item_a_id"] for r in first] + [r["item_b_id"] for r in first]
    assert len(set(ids)) == 8

    done = _finish(client, play)
    assert done["status"] == "completed" and done["winner_item_id"] in ids
    # 8강 4 + 준결승 2 + 결승 1 = 7경기, 모두 승자가 있다.
    assert len(done["rounds"]) == 7 and all(r["winner_id"] for r in done["rounds"])


def test_vote_guards(client, make_user):
    _, headers = make_user()
    tid = _create(client, headers, n=4).json()["id"]
    play = _play(client, tid, 4).json()
    match = play["rounds"][0]
    path = f"/api/plays/{play['id']}/rounds/{match['id']}/vote"

    assert client.post(path, json={"winner_id": "not-in-match"}).status_code == 400
    assert client.post(path, json={"winner_id": match["item_a_id"]}).status_code == 200
    assert client.post(path, json={"winner_id": match["item_b_id"]}).status_code == 400  # 이미 투표


def test_owned_play_can_only_be_continued_by_its_owner(client, make_user):
    _, owner = make_user("owner")
    _, other = make_user("other")
    tid = _create(client, owner, n=4).json()["id"]
    play = _play(client, tid, 4, headers=owner).json()
    match = play["rounds"][0]
    path = f"/api/plays/{play['id']}/rounds/{match['id']}/vote"
    body = {"winner_id": match["item_a_id"]}

    assert client.post(path, json=body).status_code == 403  # 비로그인
    assert client.post(path, json=body, headers=other).status_code == 403
    assert client.post(path, json=body, headers=owner).status_code == 200


def test_ranking_counts_championships_and_matches(client, make_user):
    _, headers = make_user()
    tid = _create(client, headers, n=4).json()["id"]
    for _ in range(3):
        _finish(client, _play(client, tid, 4).json())

    res = client.get(f"/api/tournaments/{tid}/ranking")
    assert res.status_code == 200
    body = res.json()
    assert body["total_plays"] == 3
    items = body["items"]
    assert sum(i["championship_count"] for i in items) == 3  # 판마다 우승 1명
    assert [i["rank"] for i in items] == sorted(i["rank"] for i in items)
    for i in items:
        assert 0 <= i["championship_rate"] <= 1 and 0 <= i["match_win_rate"] <= 1
        assert i["match_win_count"] <= i["match_count"]


def test_delete_cascades_plays_comments_and_likes(client, make_user, db):
    _, headers = make_user()
    tid = _create(client, headers, n=4).json()["id"]
    _finish(client, _play(client, tid, 4).json())
    client.post(f"/api/comments/tournament/{tid}/", json={"content": "hi"}, headers=headers)
    client.post(f"/api/likes/tournament/{tid}", headers=headers)
    assert db.query(TournamentPlay).count() == 1 and db.query(Like).count() == 1

    assert client.delete(f"/api/tournaments/{tid}", headers=headers).status_code == 204
    db.expire_all()
    assert db.query(TournamentPlay).count() == 0
    assert db.query(Like).count() == 0
    assert db.query(Comment).count() == 0


def test_list_sort_and_view_counter(client, make_user):
    _, headers = make_user()
    quiet = _create(client, headers, title="조용한").json()["id"]
    busy = _create(client, headers, title="인기").json()["id"]
    _finish(client, _play(client, busy, 4).json())

    popular = client.get("/api/tournaments/", params={"sort": "popular_all"}).json()
    assert popular[0]["id"] == busy and popular[0]["play_count"] == 1
    assert client.get("/api/tournaments/", params={"sort": "nope"}).status_code == 422

    client.get(f"/api/tournaments/{quiet}")
    assert client.get(f"/api/tournaments/{quiet}").json()["view_count"] == 0
    assert client.post(f"/api/tournaments/{quiet}/view").status_code == 204
    assert client.get(f"/api/tournaments/{quiet}").json()["view_count"] == 1
