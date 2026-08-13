## 하네스: kikhipster

**목표:** OpenAPI 기반 음악 웹사이트의 전체 기능(아티스트/앨범 검색, 탑스터 제작/공유, 노래 토너먼트, 리뷰, 댓글, 좋아요)을 Next.js + Python(FastAPI) + Tailwind + shadcn/ui로 구현

**트리거:** 기능 구현, 컴포넌트/페이지 개발, API 엔드포인트 작성, DB 설계, 버그 수정, 리팩토링 등 kikhipster 개발 작업 요청 시 `orchestrate-kikhipster` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

---

## 현재 상태 (2026-08-13 기준)

**브랜치:** `feat/shadcn-ui-migration` — origin에 푸시됨, `main` 미병합
**직전 작업:** 프론트 UI를 순수 Tailwind 유틸리티 → shadcn/ui 프리미티브로 전면 이관 (`2bcb79b`..`7844c90`)

> ⚠️ **백엔드의 DB 기반 API가 현재 전부 500이다.** Alembic 마이그레이션이 없고 `create_all()` 호출도 없어서 테이블 생성 수단 자체가 존재하지 않는다. 탑스터·댓글·좋아요·토너먼트·인증이 전부 해당된다. 아래 #1~#2가 끝나야 해소된다.
> 프론트는 호출 실패를 전부 `catch` 로 삼키므로 화면은 에러 없이 빈 상태로 렌더링된다 — 정상 동작으로 오인하지 말 것.

### 대기 중인 작업 — 배포 전 선행 작업

순서 의존이 있다. 상세 배경은 루트 `README.md` 와 Notion §11.4 참조.

| # | 작업 | 선행 | 요점 |
|---|------|------|------|
| 1 | `database.py` 설정 일원화 | – | 평문 기본값 제거(미설정 시 즉시 실패), `os.getenv` → `settings` 일원화, `pool_pre_ping=True`, `sslmode=require` 지원. `config.py` 의 `database_url` 은 현재 **아무도 읽지 않는 죽은 설정**이라 그쪽만 고치면 조용히 무시됨 |
| 2 | Alembic 도입 + 초기 리비전 | #1 | `alembic init`, `env.py` 에 `models` import + `Base.metadata` + `settings.database_url` 연결, 테이블 7종 리비전 생성 |
| 3 | CORS·배포 환경변수화 | – | `main.py` 의 `allow_origins=["http://localhost:3000"]` 하드코딩 제거, `frontend_url`·`oauth_redirect_base_url` 기본값 정리 |
| 4 | 백엔드 Dockerfile | #1 #2 #3 | `python:3.9-slim`, `backend/` 내용을 워킹 디렉토리 루트로(절대 경로 import), `uvicorn --host 0.0.0.0 --port 8000` |

### 확정된 배포 스택 (2026-08-13)

프론트 **Vercel Hobby**, 백엔드 **AWS ECS Fargate**(퍼블릭 서브넷 + 공인 IP, **NAT Gateway 미사용**) + **ALB**, DB **RDS PostgreSQL** `db.t4g.micro`. 커스텀 도메인 `kikhipster.com` / `api.kikhipster.com` 으로 same-site 구성. 예상 월 ~$48. 전체 근거와 인프라 주의점은 Notion §11.

**미결:** 도메인명 · AWS 리전(서울/버지니아) · 크레딧 잔액

---

## 작업 시 유의사항

- **백엔드는 `backend/` 를 실행 루트로 고정한다.** `from config import settings` 같은 절대 경로 import를 쓰므로 루트에서 `uvicorn backend.main:app` 을 실행하면 `ModuleNotFoundError` 가 난다.
- **프론트 UI는 shadcn/ui 위에서 조립한다.** raw `<button>` + Tailwind로 새로 만들지 말고 `@/components/ui/*` 를 먼저 찾는다. 색상은 하드코딩(`bg-zinc-900`, `text-violet-400`) 대신 시맨틱 토큰(`bg-card`, `text-primary`, `text-muted-foreground`, `bg-accent`)을 쓴다. 상세는 `kikhipster-frontend` 스킬.
- **로컬 DB는 루트 `docker-compose.yml`** 로 띄운다 (`docker compose up -d`).
- **정본 문서는 Notion.** 큰 작업이 끝나면 갱신한다: https://app.notion.com/p/coding-sham/kikhipster-3af286f3bd70806597c2c64470a644ed

---

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-07-03 | 초기 구성 | 전체 | - |
| 2026-08-13 | 현재 상태·대기 작업·배포 스택 섹션 추가, 목표에 shadcn/ui 반영 | CLAUDE.md | 세션 간 작업 상태 인계 |
