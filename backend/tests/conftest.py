"""백엔드 테스트 하네스.

**진짜 PostgreSQL 에 붙는다.** SQLite 로 대체하지 않는 이유: 이 프로젝트의 과거 버그 세 건
(UUID PK 직렬화, backref cascade, alembic 인코딩)이 전부 "실제 DB 로 돌려 보기 전에는 안 드러나는"
종류였고, 모델이 `postgresql.UUID` / `JSONB` 를 쓰기 때문이다.

개발 DB(`kikhipster`)를 건드리지 않도록 **별도 DB(`kikhipster_test`)** 를 쓴다. 없으면 만들고,
세션 시작 때 `alembic upgrade head` 로 스키마를 올리므로 **마이그레이션 체인 자체도 매번 검증된다.**
각 테스트가 끝나면 전 테이블을 비운다.

접속 주소는 `TEST_DATABASE_URL`(기본: 루트 docker-compose.yml 의 로컬 값). 이 모듈은 `config` 를
import 하기 전에 `DATABASE_URL` 을 덮어쓰므로 **다른 import 보다 먼저 있어야 한다.**
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))



def _default_test_url() -> str:
    """개발 DB 와 같은 서버·계정에서 DB 이름만 `_test` 로 바꾼다.

    로컬 포트가 루트 `.env` 의 `POSTGRES_PORT` 로 바뀌어 있을 수 있어(이 PC 는 15432) 포트를 하드코딩하지
    않고 `backend/.env` 의 `DATABASE_URL` 에서 가져온다. `.env` 가 없으면(CI) compose 기본값이다.
    """
    from dotenv import dotenv_values

    dev = dotenv_values(BACKEND_DIR / ".env").get("DATABASE_URL")
    if not dev:
        return "postgresql://kikhipster:devpassword@localhost:5432/kikhipster_test"
    url = make_url(dev)
    return url.set(database=f"{url.database}_test").render_as_string(hide_password=False)


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or _default_test_url()
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["APP_ENV"] = "development"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-that-is-long-enough-0123456789"
# 기동 시 `.env` 를 읽어 값을 덮어쓰지 않게 한다(환경변수가 이기지만 방어적으로).

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def _ensure_database() -> None:
    url = make_url(TEST_DATABASE_URL)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("select 1 from pg_database where datname = :n"), {"n": url.database}
        ).scalar()
        if not exists:
            conn.execute(text(f'create database "{url.database}"'))
    admin.dispose()


@pytest.fixture(scope="session", autouse=True)
def _schema():
    _ensure_database()
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    # env.py 가 settings.database_url 을 주입한다 — 위에서 이미 테스트 DB 로 덮어썼다.
    os.chdir(BACKEND_DIR)
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def _clean_tables(_schema):
    yield
    from database import Base, engine

    names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"truncate {names} restart identity cascade"))


@pytest.fixture()
def db():
    from database import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    from main import app

    # lifespan(iTunes 클라이언트·캐시 정리)을 돌리지 않는다 — `with` 없이 쓴다.
    return TestClient(app)


@pytest.fixture()
def make_user(db):
    """유저와 그 유저의 Authorization 헤더를 함께 만든다."""
    from models.user import User
    from services.auth import create_access_token

    def _make(nickname: str = "tester"):
        user = User(
            email=f"{uuid.uuid4().hex[:8]}@example.com",
            provider="google",
            provider_id=uuid.uuid4().hex,
            nickname=nickname,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user, {"Authorization": f"Bearer {create_access_token(str(user.id))}"}

    return _make
