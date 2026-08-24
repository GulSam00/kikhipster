# kikhipster

Spotify Web API 기반 음악 취향 기록·공유 서비스. 아티스트/앨범/곡 탐색, 탑스터(앨범 격자 차트) 제작·공유, 노래 토너먼트, 좋아요·댓글을 제공합니다.

**정본 문서:** [Notion 페이지](https://app.notion.com/p/coding-sham/kikhipster-3af286f3bd70806597c2c64470a644ed) — 전체 현황·API 명세·데이터 모델·배포 구성은 여기를 봅니다. 이 README는 로컬 셋업과 인계 사항만 다룹니다.

## 스택

| 영역 | 구성 |
|---|---|
| 프론트 | Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · **shadcn/ui** · pnpm |
| 백엔드 | FastAPI · SQLAlchemy 2.0 · PostgreSQL · Python 3.9 |
| 외부 | Spotify Web API (Client Credentials) · Google/Kakao OAuth |

## 저장소 구조

```
kikhipster/
├── frontend/            # Next.js. components/ui/ 는 shadcn/ui 프리미티브
├── backend/             # FastAPI. 실행 루트를 backend/ 로 고정해야 함
├── docker-compose.yml   # 로컬 개발용 PostgreSQL
├── _workspace/          # 기획·검토 산출물
└── .claude/             # 개발 하네스 (에이전트 4종 + 스킬 3종)
```

## 로컬 실행

### 1. 데이터베이스

```bash
docker compose up -d      # PostgreSQL 16 (kikhipster DB 자동 생성)
docker compose ps         # healthy 확인
```

`docker compose down` 은 컨테이너만 내리고 데이터는 유지합니다. 데이터까지 지우려면 `down -v`.

### 2. 백엔드

```bash
cd backend
python -m venv venv && source venv/Scripts/activate   # Windows Git Bash 기준
pip install -r requirements.txt
cp .env.example .env      # DATABASE_URL 은 compose 기본값에 맞춰져 있음
uvicorn main:app --reload --port 8000
```

> **반드시 `backend/` 안에서 실행하세요.** `from config import settings` 같은 절대 경로 import를 쓰기 때문에 루트에서 `uvicorn backend.main:app` 을 돌리면 `ModuleNotFoundError` 가 납니다.

### 3. 프론트엔드

```bash
cd frontend
pnpm install
pnpm dev                  # http://localhost:3300
```

`NEXT_PUBLIC_API_URL` 미설정 시 `http://localhost:8000` 을 기본값으로 씁니다.

## 현재 동작 범위

> ⚠️ **테이블 생성 수단이 아직 없습니다.** Alembic 마이그레이션이 미작성이고 `create_all()` 호출도 없어서, DB를 띄워도 테이블이 생기지 않습니다. 탑스터·댓글·좋아요·토너먼트·인증 API는 전부 500을 반환합니다. (아래 선행 작업 #1~#2)

| 기능 | 상태 | 필요 조건 |
|---|---|---|
| 프론트 전체 화면 | ✅ 동작 | — |
| 음악 검색·상세 | ⚠️ Spotify 자격증명 필요 | `.env` 의 `SPOTIFY_CLIENT_ID/SECRET` |
| 탑스터·댓글·좋아요·토너먼트 | ❌ 미동작 | Alembic 도입 후 테이블 생성 |
| 소셜 로그인 | ❌ 미동작 | 위와 동일 + Google/Kakao 자격증명 |

백엔드 호출 실패는 전부 `catch` 로 삼켜지므로, 화면은 에러 없이 빈 상태로 렌더링됩니다.

## 남은 작업 (배포 전 선행 작업)

상세 배경은 Notion **§11.4 배포 전 선행 작업** 참조. 의존 순서가 있습니다.

```
#1 database.py 설정 일원화 ─┬─→ #2 Alembic 도입 ─┐
                           │                    ├─→ #4 Dockerfile
#3 CORS 환경변수화 ─────────┴────────────────────┘
```

**#1. `database.py` 설정 일원화 및 엔진 옵션 보강**
- 평문 기본값(`postgresql://user:password@...`) 제거 → 환경변수 미설정 시 즉시 실패
- `os.getenv` → `settings` 일원화. 현재 `config.py` 의 `database_url` 은 **아무도 읽지 않는 죽은 설정**이라, 그쪽만 고치면 조용히 무시됨
- `pool_pre_ping=True` 추가 (RDS 유휴 커넥션 절단 대응)
- `sslmode=require` 지원

**#2. Alembic 도입 및 초기 리비전** *(#1 이후)*
- `alembic init` → `env.py` 에 `models` import + `Base.metadata` 연결 + `settings.database_url` 주입
- 테이블 7종 초기 리비전 생성
- `main.py` 의 `import models  # noqa: F401` 주석이 이 연결을 전제로 미리 넣어둔 것
- **#1 이후인 이유:** `env.py` 가 `settings` 를 참조하므로 순서가 뒤바뀌면 재작업 발생

**#3. CORS 및 배포 환경변수화** *(#1과 독립)*
- `main.py` 의 `allow_origins=["http://localhost:3000"]` 하드코딩 제거
- `frontend_url` · `oauth_redirect_base_url` 기본값 정리
- 배포 시 프론트 요청 차단 및 OAuth 콜백 파손 방지 (QA 리포트 LOW-2)

**#4. 백엔드 Dockerfile** *(#1·#2·#3 이후)*
- `python:3.9-slim`, `backend/` 내용을 워킹 디렉토리 루트로 배치
- `uvicorn --host 0.0.0.0 --port 8000`
- `.dockerignore` 로 `venv/`·`__pycache__` 제외
- **마지막인 이유:** 앞 세 작업이 코드·환경변수 구조를 바꾸므로 확정 후 이미지를 잡아야 재작업이 없음

### 알려진 이슈

- `pnpm lint` 에 `react-hooks/set-state-in-effect` 오류 6건. 디바운스 훅과 `localStorage` 로그인 체크에서 발생하는 기존 패턴이며, shadcn 이관 전에도 동일하게 존재했음
- 대부분의 페이지가 `catch { /* ignore */ }` 로 조용히 실패. 공통 컴포넌트(`Spinner`/`Empty`/`sonner`)는 갖춰졌으므로 실패 경로만 연결하면 됨 (Notion §8.3)

## 배포 구성

Notion **§11** 에 확정 스택이 정리돼 있습니다. 요약하면 프론트는 Vercel, 백엔드는 AWS ECS Fargate(퍼블릭 서브넷, NAT 미사용) + ALB, DB는 RDS PostgreSQL, 도메인은 `kikhipster.com` / `api.kikhipster.com` 으로 same-site 구성. 예상 비용 월 ~$48.

도메인명·리전·AWS 크레딧 잔액은 미결 상태입니다.

## 개발 하네스

이 저장소는 Claude Code 하네스로 개발합니다. 기능 구현·버그 수정 요청 시 `orchestrate-kikhipster` 스킬이 작업을 조율합니다. 프론트 구현 컨벤션은 `.claude/skills/kikhipster-frontend/SKILL.md`, 백엔드는 `kikhipster-backend/SKILL.md` 를 따릅니다.

## 라이선스

MIT
