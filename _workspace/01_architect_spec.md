# Spotify Web API Integration - Architecture Spec

## 1. 수정/생성 파일 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `backend/config.py` | 신규 생성 | 환경변수 로딩, Settings 클래스 (pydantic-settings) |
| `backend/services/spotify_auth.py` | 신규 생성 | Client Credentials 토큰 관리 (자동 갱신) |
| `backend/services/music_api.py` | 수정 | mock 제거, SpotifyMusicService 클래스로 교체 |
| `backend/schemas/music.py` | 신규 생성 | Pydantic response/request 모델 |
| `backend/routers/music.py` | 신규 생성 | /api/music/* 엔드포인트 라우터 |
| `backend/main.py` | 수정 | music 라우터 등록, lifespan으로 httpx client 관리 |
| `backend/.env.example` | 수정 | Spotify 환경변수 추가 |
| `backend/requirements.txt` | 수정 | httpx, pydantic-settings 추가 |

---

## 2. 환경변수 (.env.example 추가분)

```
DATABASE_URL=postgresql://user:password@localhost:5432/kikhipster

# Spotify API
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_DEFAULT_MARKET=KR
```

---

## 3. requirements.txt 추가 패키지

```
httpx==0.28.1
pydantic-settings==2.6.1
```

---

## 4. config.py - Settings 클래스

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    spotify_client_id: str
    spotify_client_secret: str
    spotify_default_market: str = "KR"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 5. services/spotify_auth.py - 토큰 관리

### 클래스 시그니처

```python
class SpotifyTokenManager:
    TOKEN_URL = "https://accounts.spotify.com/api/token"

    def __init__(self, client_id: str, client_secret: str): ...
    async def get_token(self, client: httpx.AsyncClient) -> str: ...
    async def _refresh_token(self, client: httpx.AsyncClient) -> None: ...
    def _is_token_valid(self) -> bool: ...
```

- asyncio.Lock으로 동시 갱신 요청 방지
- 만료 60초 전 자동 갱신
- Client Credentials Flow: POST https://accounts.spotify.com/api/token

---

## 6. services/music_api.py - SpotifyMusicService

```python
class SpotifyMusicService:
    BASE_URL = "https://api.spotify.com/v1"

    async def search_artists(self, query: str, market: str = "KR", limit: int = 20) -> list[dict]
    # GET /v1/search?type=artist&q={query}&market={market}&limit={limit}
    # 반환: [{ id, name, image_url, genres, popularity, followers }]

    async def search_albums(self, query: str, market: str = "KR", limit: int = 20) -> list[dict]
    # GET /v1/search?type=album&q={query}&market={market}&limit={limit}
    # 반환: [{ id, title, cover_url, artist_name, release_date, total_tracks }]

    async def get_artist_detail(self, artist_id: str) -> dict | None
    # GET /v1/artists/{artist_id}
    # 반환: { id, name, image_url, genres, popularity, followers }

    async def get_artist_albums(self, artist_id: str, market: str = "KR", limit: int = 50) -> list[dict]
    # GET /v1/artists/{artist_id}/albums?market={market}&limit={limit}&include_groups=album,single
    # 반환: [{ id, title, cover_url, release_date, total_tracks, album_type }]

    async def get_album_tracks(self, album_id: str, market: str = "KR") -> dict
    # GET /v1/albums/{album_id}?market={market}
    # 반환: { album: AlbumSummary, tracks: [{ id, name, track_number, duration_ms, preview_url, artists }] }

    async def _request(self, method: str, path: str, params: dict = None) -> dict
    # 인증 헤더 자동 첨부, 401 시 토큰 갱신 후 1회 재시도
```

---

## 7. schemas/music.py - Pydantic 모델

```python
class ArtistSummary(BaseModel):
    id: str
    name: str
    image_url: str | None = None
    genres: list[str] = []
    popularity: int = 0
    followers: int = 0

class ArtistDetail(ArtistSummary): pass

class AlbumSummary(BaseModel):
    id: str
    title: str
    cover_url: str | None = None
    artist_name: str
    release_date: str
    total_tracks: int = 0
    album_type: str = "album"

class TrackItem(BaseModel):
    id: str
    name: str
    track_number: int
    duration_ms: int
    preview_url: str | None = None
    artists: list[str] = []

class AlbumWithTracks(BaseModel):
    album: AlbumSummary
    tracks: list[TrackItem]

class SearchArtistsResponse(BaseModel):
    items: list[ArtistSummary]
    total: int

class SearchAlbumsResponse(BaseModel):
    items: list[AlbumSummary]
    total: int
```

---

## 8. routers/music.py - FastAPI 엔드포인트

| Method | Path | Query Params | Response Model |
|--------|------|-------------|----------------|
| GET | `/api/music/search/artists` | `q`, `market=KR`, `limit=20` | `SearchArtistsResponse` |
| GET | `/api/music/search/albums` | `q`, `market=KR`, `limit=20` | `SearchAlbumsResponse` |
| GET | `/api/music/artists/{artist_id}` | - | `ArtistDetail` |
| GET | `/api/music/artists/{artist_id}/albums` | `market=KR`, `limit=50` | `list[AlbumSummary]` |
| GET | `/api/music/albums/{album_id}/tracks` | `market=KR` | `AlbumWithTracks` |

---

## 9. main.py 수정 사항

- asynccontextmanager lifespan 추가
- startup: httpx.AsyncClient + SpotifyTokenManager + SpotifyMusicService 를 app.state에 저장
- shutdown: http_client.aclose()
- app.include_router(music.router)

---

## 10. 에러 핸들링

| Spotify 응답 | 처리 |
|-------------|------|
| 401 | 토큰 강제 갱신 후 1회 재시도 |
| 404 | HTTPException(404) |
| 429 | HTTPException(503) + Retry-After 로깅 |
| 500+ | HTTPException(502) |

---

## 11. KPOP/JPOP 최적화

- market 기본값: KR
- Spotify는 한글/일본어 검색 네이티브 지원 (로마자 변환 불필요)
- market 파라미터로 KR/JP 전환 가능
