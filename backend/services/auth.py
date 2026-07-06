from datetime import datetime, timedelta

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config import settings
from models.user import User


def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_refresh_expire_days)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> str | None:
    """토큰 검증 후 user_id 반환. 유효하지 않으면 None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except JWTError:
        return None


def get_or_create_user(
    db: Session, email: str, provider: str, provider_id: str, nickname: str
) -> User:
    """소셜 로그인 시 유저 조회 또는 생성."""
    user = db.query(User).filter_by(provider=provider, provider_id=provider_id).first()
    if not user:
        user = User(email=email, provider=provider, provider_id=provider_id, nickname=nickname)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
