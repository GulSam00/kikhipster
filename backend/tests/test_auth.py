"""JWT 발급·검증과 인증 의존성."""
from datetime import datetime, timedelta

from jose import jwt

from config import settings
from services.auth import create_access_token, create_refresh_token, decode_token


def test_token_roundtrip():
    assert decode_token(create_access_token("user-1")) == "user-1"
    assert decode_token(create_refresh_token("user-2")) == "user-2"


def test_garbage_and_wrong_signature_are_rejected():
    assert decode_token("not-a-token") is None
    forged = jwt.encode({"sub": "u"}, "another-secret", algorithm=settings.jwt_algorithm)
    assert decode_token(forged) is None


def test_expired_token_is_rejected():
    expired = jwt.encode(
        {"sub": "u", "exp": datetime.utcnow() - timedelta(minutes=1)},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    assert decode_token(expired) is None


def test_me_requires_login(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_me_returns_the_user(client, make_user):
    user, headers = make_user("함상준")
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["nickname"] == "함상준"
    assert res.json()["id"] == str(user.id)


def test_token_of_deleted_user_is_rejected(client, make_user, db):
    user, headers = make_user()
    db.delete(user)
    db.commit()
    assert client.get("/api/auth/me", headers=headers).status_code == 401
