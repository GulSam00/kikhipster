from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.user import User
from routers.deps import get_current_user
from services.auth import create_access_token, create_refresh_token, decode_token, get_or_create_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

KAKAO_AUTH_URL = "https://kauth.kakao.com/oauth/authorize"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USERINFO_URL = "https://kapi.kakao.com/v2/user/me"


@router.get("/google")
async def google_login():
    redirect_uri = f"{settings.oauth_redirect_base_url}/api/auth/callback/google"
    params = (
        f"?client_id={settings.google_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid email profile"
    )
    return RedirectResponse(url=GOOGLE_AUTH_URL + params)


@router.get("/callback/google")
async def google_callback(code: str, request: Request, db: Session = Depends(get_db)):
    redirect_uri = f"{settings.oauth_redirect_base_url}/api/auth/callback/google"
    http_client = request.app.state.http_client

    token_resp = await http_client.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    token_resp.raise_for_status()
    access_token = token_resp.json()["access_token"]

    userinfo_resp = await http_client.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    userinfo_resp.raise_for_status()
    info = userinfo_resp.json()

    user = get_or_create_user(
        db,
        email=info["email"],
        provider="google",
        provider_id=info["sub"],
        nickname=info.get("name", info["email"].split("@")[0]),
    )
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    frontend = settings.frontend_url
    return RedirectResponse(
        url=f"{frontend}/auth/callback?access_token={access_token}&refresh_token={refresh_token}"
    )


@router.get("/kakao")
async def kakao_login():
    redirect_uri = f"{settings.oauth_redirect_base_url}/api/auth/callback/kakao"
    params = (
        f"?client_id={settings.kakao_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
    )
    return RedirectResponse(url=KAKAO_AUTH_URL + params)


@router.get("/callback/kakao")
async def kakao_callback(code: str, request: Request, db: Session = Depends(get_db)):
    redirect_uri = f"{settings.oauth_redirect_base_url}/api/auth/callback/kakao"
    http_client = request.app.state.http_client

    token_resp = await http_client.post(
        KAKAO_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.kakao_client_id,
            "client_secret": settings.kakao_client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token_resp.raise_for_status()
    kakao_access = token_resp.json()["access_token"]

    userinfo_resp = await http_client.get(
        KAKAO_USERINFO_URL,
        headers={"Authorization": f"Bearer {kakao_access}"},
    )
    userinfo_resp.raise_for_status()
    info = userinfo_resp.json()

    kakao_account = info.get("kakao_account", {})
    profile = kakao_account.get("profile", {})

    user = get_or_create_user(
        db,
        email=kakao_account.get("email", f"{info['id']}@kakao.com"),
        provider="kakao",
        provider_id=str(info["id"]),
        nickname=profile.get("nickname", f"user_{info['id']}"),
    )
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    frontend = settings.frontend_url
    return RedirectResponse(
        url=f"{frontend}/auth/callback?access_token={access_token}&refresh_token={refresh_token}"
    )


@router.post("/refresh")
async def refresh_token(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    refresh = body.get("refresh_token")
    if not refresh:
        raise HTTPException(status_code=400, detail="refresh_token이 필요합니다")
    user_id = decode_token(refresh)
    if not user_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 refresh token입니다")
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="존재하지 않는 유저입니다")
    return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "nickname": current_user.nickname,
        "provider": current_user.provider,
    }
