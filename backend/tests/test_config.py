"""JWT 시크릿 기동 검증(`config.Settings`)."""
import logging

import pytest
from pydantic import ValidationError

from config import Settings

STRONG = "x" * 48


def _make(**kw):
    return Settings(_env_file=None, database_url="postgresql://u:p@h/d", **kw)


def test_production_rejects_placeholder_secret():
    with pytest.raises(ValidationError):
        _make(app_env="production", jwt_secret_key="change-me-in-production")


def test_production_rejects_short_secret():
    with pytest.raises(ValidationError):
        _make(app_env="production", jwt_secret_key="short")


def test_production_accepts_strong_secret_case_insensitively():
    assert _make(app_env="Production", jwt_secret_key=STRONG).jwt_secret_key == STRONG


def test_development_only_warns(caplog):
    # alembic 의 fileConfig 가 기존 로거를 꺼 두므로(disable_existing_loggers) 다시 켠다.
    logging.getLogger("config").disabled = False
    s = _make(app_env="development", jwt_secret_key="change-me-in-production")
    assert s.app_env == "development"
    assert "JWT_SECRET_KEY" in caplog.text
