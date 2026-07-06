# QA Report — kikhipster Spotify API 연동 코드 검토

**작성일:** 2026-07-06
**검토 대상 브랜치:** main (35cec32)
**검토자:** Claude Code (code review mode)

---

## 검토 파일 목록

| 파일 | 역할 |
|------|------|
| backend/config.py | 환경변수 설정 (pydantic-settings) |
| backend/services/spotify_auth.py | Spotify Client Credentials 토큰 관리 |
| backend/services/music_api.py | Spotify Web API 클라이언트 |
| backend/schemas/music.py | Pydantic 응답 모델 |
| backend/routers/music.py | FastAPI 라우터 |
| backend/main.py | 앱 진입점, lifespan, DI |

---

## 발견된 이슈

---

### [HIGH-1] get_artist_albums 반환 dict에 artist_name 필드 누락

**파일:** backend/services/music_api.py L119~L139
**심각도:** HIGH

**문제:**
get_artist_albums가 반환하는 각 dict에는 artist_name 키가 없다.
routers/music.py의 response_model=list[AlbumSummary]는 AlbumSummary를 사용하고,
AlbumSummary에는 artist_name: str = "" 필드가 선언되어 있다.

Pydantic v2는 누락된 필드에 기본값이 있으면 ValidationError 없이 통과하므로
앱은 정상 기동되지만, 모든 응답에서 artist_name이 항상 빈 문자열로 반환된다.
Spotify /artists/{id}/albums 응답은 각 앨범에 artists 배열을 포함하므로
데이터는 존재하지만 파싱이 누락된 상태다. 즉시 재현 가능한 데이터 손실 버그다.

**수정 방법:**
get_artist_albums 루프 내부에서 artists 키를 추출해 artist_name을 조립한다.

    artists_list = a.get("artists", [])
    items.append({
        "artist_name": artists_list[0].get("name", "") if artists_list else "",
        ... (other fields unchanged)
    })

---
### [HIGH-2] backend/__init__.py 존재로 인한 import 경로 충돌 위험

**파일:** backend/__init__.py (존재 자체), backend/services/music_api.py L6,
backend/routers/music.py L3~9, backend/main.py L8~11
**심각도:** HIGH

**문제:**
backend/ 디렉토리에 __init__.py가 존재하므로 Python은 backend를 패키지로 인식한다.
그러나 모든 파일의 import가 backend/ 기준 절대 경로 방식으로 작성되어 있다.

    # music_api.py
    from services.spotify_auth import SpotifyTokenManager
    # main.py
    from config import settings
    from routers.music import router as music_router

이 방식은 backend/ 내부에서 실행(cd backend && uvicorn main:app)할 때만 동작한다.
루트에서 uvicorn backend.main:app 또는 pytest를 루트에서 실행하면
ModuleNotFoundError: No module named services 가 발생한다.
__init__.py 존재 의도가 불명확해 실행 환경에 따라 동작 여부가 바뀌는 구조다.

**수정 방법 (택일):**
1. backend/__init__.py를 삭제하고 항상 backend/를 실행 루트로 고정.
   Dockerfile, Makefile, pytest.ini에 PYTHONPATH=backend 또는 cd backend를 명시.
2. backend/__init__.py를 유지하고 모든 import를 패키지 상대 경로로 변경.
   services/music_api.py: from .spotify_auth import SpotifyTokenManager
   routers/music.py: from ..schemas.music import (...)

---

### [HIGH-3] invalidate()에 asyncio.Lock이 없어 논리적 race condition 발생 가능

**파일:** backend/services/spotify_auth.py L63~66
**심각도:** HIGH

**문제:**
invalidate()는 동기 함수로 Lock 없이 _token과 _expires_at를 직접 수정한다.

    def invalidate(self) -> None:
        self._token = None
        self._expires_at = 0.0

_request()에서 401 수신 후 invalidate() 호출 전에 다른 코루틴이
get_token() -> Lock 획득 -> _refresh_token() -> 새 토큰 저장 순서로 실행되면,
이후 invalidate()가 방금 발급된 유효한 토큰을 None으로 덮어쓴다.
CPython asyncio 단일 스레드 환경에서도 await 지점마다 코루틴 전환이 발생하므로 이 시나리오는 재현 가능하다.

**수정 방법:**

    async def invalidate(self) -> None:
        async with self._lock:
            self._token = None
            self._expires_at = 0.0

_request() 호출부도 await self._token_manager.invalidate()로 변경한다.

---
### [MED-1] 두 번째 401 응답 시 502 HTTPException 대신 httpx 예외가 전파됨

**파일:** backend/services/music_api.py L28~56
**심각도:** MED

**문제:**
재시도 루프에서 attempt == 1일 때 401이 오면 "if ... and attempt == 0" 조건을 건너뛰고
response.raise_for_status()에서 httpx.HTTPStatusError가 발생한다.
루프 이후의 "raise HTTPException(status_code=502)" 코드에는 도달하지 못한다.
FastAPI는 처리되지 않은 httpx.HTTPStatusError를 500으로 반환하면서 Spotify 엔드포인트 정보가 노출될 수 있다.

**수정 방법:**

    if response.status_code == 401:
        if attempt == 0:
            await self._token_manager.invalidate()
            continue
        raise HTTPException(status_code=502, detail="Spotify 인증 실패")

---

### [MED-2] _refresh_token 실패 시 httpx 예외가 그대로 전파되어 내부 정보 노출

**파일:** backend/services/spotify_auth.py L52
**심각도:** MED

**문제:**
response.raise_for_status()가 httpx.HTTPStatusError를 발생시키면 이 예외가
FastAPI 기본 핸들러까지 도달해 500을 반환하면서 예외 메시지에
Spotify 토큰 엔드포인트 URL과 응답 상태 코드가 포함될 수 있다.

**수정 방법:**

    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error("Spotify 토큰 발급 실패: HTTP %d", e.response.status_code)
        raise HTTPException(status_code=502, detail="Spotify 인증 서버 오류") from e

---

### [MED-3] spotify credentials 미설정 시 앱 기동 시점에 오류가 감지되지 않음

**파일:** backend/config.py L6~7, backend/main.py L18~31
**심각도:** MED

**문제:**
spotify_client_id와 spotify_client_secret의 기본값이 빈 문자열이므로
.env 없이도 앱이 정상 기동된다. 오류는 첫 API 요청 시점에서야 발견되며,
운영 배포 후 무음 실패(silent failure)로 이어질 수 있다.

**수정 방법:**
lifespan 시작부에서 명시적으로 검증한다.

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if not settings.spotify_client_id or not settings.spotify_client_secret:
            raise RuntimeError("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET 환경변수가 설정되지 않았습니다.")

---
### [MED-4] config.py 기본 database_url에 평문 비밀번호 포함

**파일:** backend/config.py L5
**심각도:** MED

**문제:**
database_url에 postgresql://user:password@... 형태로 평문 비밀번호가 기본값으로 소스에 포함된다.
.env 미설정 시 이 값이 실제로 사용되며, 코드베이스 역사에 영구 기록된다.

**수정 방법:**
기본값을 제거해 .env 미설정 시 pydantic-settings가 ValidationError를 발생시키도록 한다.

    database_url: str  # 기본값 없음 — 환경변수 필수

---

### [LOW-1] spotify_default_market 설정값이 라우터에 반영되지 않음

**파일:** backend/config.py L8, backend/routers/music.py 전체
**심각도:** LOW

**문제:**
config.py에 spotify_default_market: str = "KR"가 정의되어 있으나
라우터의 Query 기본값은 "KR" 하드코딩이다. 설정값을 변경해도 동작에 반영되지 않는다.

**수정 방법:**

    # routers/music.py
    from config import settings
    market: str = Query(settings.spotify_default_market, description="마켓 코드"),

---

### [LOW-2] CORS allow_origins이 localhost 하드코딩

**파일:** backend/main.py L38~43
**심각도:** LOW

**문제:**
allow_origins=["http://localhost:3000"]이 하드코딩되어 배포 환경에서
프론트엔드 도메인 추가를 잊으면 모든 실제 요청이 CORS 오류로 차단된다.

**수정 방법:**
config.py에 cors_origins: list[str] = ["http://localhost:3000"]를 추가하고 환경변수로 관리한다.

---
## 검증 항목별 요약

### 1. Pydantic 모델과 서비스 반환값 shape 일치 여부

| 엔드포인트 | 서비스 메서드 | 스키마 | 결과 |
|-----------|-------------|--------|------|
| GET /search/artists | search_artists | SearchArtistsResponse | 일치 |
| GET /search/albums | search_albums | SearchAlbumsResponse | 일치 |
| GET /artists/{id} | get_artist_detail | ArtistDetail | 일치 |
| GET /artists/{id}/albums | get_artist_albums | list[AlbumSummary] | **불일치 — artist_name 누락 (HIGH-1)** |
| GET /albums/{id}/tracks | get_album_tracks | AlbumWithTracks | 일치 |

### 2. response_model과 서비스 반환값 일치 여부

4개 엔드포인트 일치. GET /artists/{id}/albums만 artist_name 누락으로 불일치. (HIGH-1)

### 3. import 경로 오류

backend/__init__.py 존재 + 절대 경로 import 혼용으로 실행 환경에 따라 ModuleNotFoundError 가능. (HIGH-2)

### 4. 토큰 관리 로직 버그

- invalidate() Lock 부재로 논리적 race condition. (HIGH-3)
- 두 번째 401 응답 시 의도한 502 대신 httpx 예외 전파. (MED-1)
- 토큰 발급 실패 시 httpx 예외가 FastAPI까지 전파. (MED-2)

### 5. 에러 핸들링 누락

- _refresh_token의 raise_for_status() 래핑 없음. (MED-2)
- credentials 미설정 시 기동 시점 검증 없음. (MED-3)

---

## Review Summary

| 심각도 | 건수 | 상태 |
|--------|------|------|
| HIGH | 3 | block |
| MED | 4 | warn |
| LOW | 2 | note |

**판정: BLOCK — HIGH 이슈 3건이 머지 전 반드시 수정되어야 합니다.**

- HIGH-1: artist_name 누락은 즉시 재현 가능한 API 응답 데이터 손실 버그
- HIGH-2: __init__.py + 절대 import 혼용은 배포/테스트 환경에서 ModuleNotFoundError 유발
- HIGH-3: invalidate() Lock 부재는 토큰 갱신 안전성을 보장하지 않는 설계 결함
