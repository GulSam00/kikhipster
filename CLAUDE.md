## 하네스: kikhipster

**목표:** OpenAPI 기반 음악 웹사이트의 전체 기능(아티스트/앨범 검색, 탑스터 제작/공유, 노래 토너먼트, 리뷰, 댓글, 좋아요)을 Next.js + Python(FastAPI) + Tailwind + shadcn/ui로 구현

**트리거:** 기능 구현, 컴포넌트/페이지 개발, API 엔드포인트 작성, DB 설계, 버그 수정, 리팩토링 등 kikhipster 개발 작업 요청 시 `orchestrate-kikhipster` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

---

## 현재 상태 (2026-08-13 기준)

**브랜치:** `main` (`feat/shadcn-ui-migration` 는 PR #1로 병합 후 삭제됨)
**직전 작업:** 배포 전 선행 작업 4건 코드 작업 완료 — DB 설정 일원화, Alembic 도입(초기 리비전), CORS 환경변수화, 백엔드 Dockerfile (`2ad8388`)

> ⚠️ **DB 기반 API는 아직 검증되지 않았다.** Alembic 초기 리비전은 작성됐지만 로컬 `backend/.env` 가 없어서 `alembic upgrade head` 를 한 번도 실행해보지 못했다. 테이블이 실제로 생기는 걸 확인하기 전까지는 탑스터·댓글·좋아요·토너먼트·인증 API가 여전히 500이라고 가정할 것.
> 프론트는 호출 실패를 전부 `catch` 로 삼키므로 화면은 에러 없이 빈 상태로 렌더링된다 — 정상 동작으로 오인하지 말 것.

### 다음 작업

- [ ] `backend/.env` 구성 후 로컬 검증: `docker compose up -d` → `cd backend && alembic upgrade head` → `uvicorn main:app --reload`
- [ ] 인프라 프로비저닝 (RDS·ECS·ALB·ACM 등) — 도메인명·AWS 리전·크레딧 잔액 미결. 상세는 Notion §11

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
| 2026-08-13 | docs: CLAUDE.md에 현재 작업 상태 및 대기 작업 기록 | CLAUDE.md | 커밋 `c529622` |
| 2026-08-13 | chore: git commit 후 CLAUDE.md 변경 이력 자동 갱신 hook 추가 | .claude, CLAUDE.md | 커밋 `d1385d7` |
| 2026-08-13 | fix: 변경 이력 hook의 대상 칸 구분자 깨짐 수정 | .claude, CLAUDE.md | 커밋 `0df850b` |
| 2026-08-13 | chore(backend): 배포 전 선행 작업 완료 - DB 설정 일원화, Alembic 도입, CORS 환경변수화, Dockerfile | backend | 커밋 `2ad8388` |
| 2026-08-13 | docs: CLAUDE.md 현재 상태 갱신 - main 병합 반영, 배포 전 선행 작업 4건 완료 기록 | CLAUDE.md | 커밋 `f6892ed` |
