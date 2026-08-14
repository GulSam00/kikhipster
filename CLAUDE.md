## 하네스: kikhipster

**목표:** OpenAPI 기반 음악 웹사이트의 전체 기능(아티스트/앨범 검색, 탑스터 제작/공유, 노래 토너먼트, 리뷰, 댓글, 좋아요)을 Next.js + Python(FastAPI) + Tailwind + shadcn/ui로 구현

**트리거:** 기능 구현, 컴포넌트/페이지 개발, API 엔드포인트 작성, DB 설계, 버그 수정, 리팩토링 등 kikhipster 개발 작업 요청 시 `orchestrate-kikhipster` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

---

## 현재 상태 (2026-08-14 기준)

**브랜치:** `fix/db-api-local-verification` (main에서 분기, 아직 미병합)
**직전 작업:** 로컬 DB 검증 완료 + 그 과정에서 발견한 버그 3건 수정 (`fb651dc`)

> ✅ **DB 기반 API는 검증됐다.** `alembic upgrade head` 로 7개 테이블 생성 확인(스탬프 `1f0a9c2b7e3d`), 탑스터 생성/목록/상세·댓글·좋아요·토너먼트 생성·삭제 cascade까지 실제 호출로 확인. **더 이상 "500이라고 가정"하지 않아도 된다.**
> 다만 프론트는 호출 실패를 전부 `catch` 로 삼키므로 화면은 에러 없이 빈 상태로 렌더링된다 — 화면만 보고 정상 동작을 판단하지 말 것.

**검증 중 수정한 버그 3건** (상세는 Notion §7.2):

1. `alembic.ini` 한글 주석 → Python 3.9 alembic이 ini를 OS 로케일(cp949)로 읽어 `UnicodeDecodeError`. **ini는 ASCII 전용으로 유지할 것**, 한글 설명은 `alembic/env.py` 에.
2. 응답 스키마가 UUID PK를 `id: str` 로 선언 → Pydantic v2가 `UUID` → `str` 변환을 거부해 행이 생기는 순간 전수 500. `schemas/common.py` 의 `UUIDStr` 을 쓸 것.
3. `backref` 관계에 cascade 누락 → 부모 삭제 시 자식 FK를 NULL로 UPDATE하려다 `IntegrityError`. 모든 관계에 `cascade="all, delete-orphan", passive_deletes=True` 적용됨.

### 다음 작업

- [x] `backend/.env` 구성 후 로컬 검증 — 2026-08-14 완료
- [ ] AWS 실습 1단계: ECR 푸시 + Fargate 태스크 단독 기동 (ALB 없이). **착수 전 AWS 크레딧 잔액·프리 티어 잔여 기간 확인 필요**
- [ ] 실습 2~5단계 (RDS 연결 → ALB+ACM → GitHub Actions OIDC → Terraform 코드화). 상세는 Notion §11.8

### 배포 구성 (2026-08-14 목적 확정)

**1차 목적은 서비스 상시 공개가 아니라 AWS 아키텍처 실습이다.** 두 가지 원칙이 따라온다:

- **부품을 우회하지 않는다.** ALB·ACM·보안그룹 체인은 우회 가능하지만(Cloudflare Tunnel 등으로 월 ~$20 절감) 그게 배우려는 대상이라 정공법으로 간다.
- **상시 구동하지 않는다.** `terraform apply` → 실습 → `terraform destroy` 사이클. **RDS "중지"는 최대 7일 후 자동 재시작되고 스토리지 과금도 계속되므로 의존하지 말 것.**

스택: 프론트 **Vercel Hobby**, 백엔드 **ECS Fargate**(퍼블릭 서브넷 + 공인 IP, **NAT 미사용**) + **ALB**, DB **RDS PostgreSQL** `db.t4g.micro`, 리전 **`us-east-1`**. 상시 월 ~$48이지만 실습 단위(주 2회 × 4시간)로는 **월 ~$2~4**. 전체 근거·비용표·주의점·로드맵은 Notion §11.

**미결:** AWS 크레딧 잔액 · 프리 티어 잔여 기간 (도메인·리전은 해소됨 — 실습 단계에선 도메인 미구입, ALB 기본 DNS 사용)

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
| 2026-08-13 | chore : CLAUDE.md 수정 | CLAUDE.md | 커밋 `0e6cbf4` |
| 2026-08-14 | fix(backend): 로컬 DB 검증에서 드러난 DB API 장애 3건 수정 | backend | 커밋 `fb651dc` |
