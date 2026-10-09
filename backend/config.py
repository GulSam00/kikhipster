import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

# `.env.example` 과 `Settings` 기본값에 들어 있는 자리표시자. 이 값으로 서명한 JWT 는 누구나 위조할 수 있다.
INSECURE_JWT_SECRETS = {"change-me-in-production", "changeme", "secret"}
MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    # "production" 이면 취약한 JWT 시크릿으로 기동하지 않는다. 로컬 개발은 기본값("development")이라
    # 경고만 낸다 — `.env.example` 을 그대로 복사해도 뜨도록 하기 위해서다.
    app_env: str = "development"
    database_url: str
    music_default_market: str = "KR"

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 30

    # OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    kakao_client_id: str = ""
    kakao_client_secret: str = ""
    oauth_redirect_base_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3300"

    # CORS 허용 origin (콤마로 구분된 목록)
    cors_origins: str = "http://localhost:3300"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def _check_jwt_secret(self) -> "Settings":
        weak = (
            self.jwt_secret_key in INSECURE_JWT_SECRETS
            or len(self.jwt_secret_key) < MIN_JWT_SECRET_LENGTH
        )
        if not weak:
            return self
        message = (
            "JWT_SECRET_KEY 가 자리표시자이거나 %d자 미만이다. "
            "`python -c \"import secrets; print(secrets.token_urlsafe(48))\"` 로 만든 값으로 바꿀 것."
            % MIN_JWT_SECRET_LENGTH
        )
        if self.app_env.lower() == "production":
            raise ValueError(message)
        logger.warning("%s (APP_ENV=%s 라 기동은 계속한다)", message, self.app_env)
        return self


settings = Settings()
