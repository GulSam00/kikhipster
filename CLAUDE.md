## 하네스: kikhipster

**목표:** OpenAPI 기반 음악 웹사이트의 전체 기능(아티스트/앨범 검색, 탑스터 제작/공유, 노래 토너먼트, 댓글, 좋아요)을 Next.js + Python(FastAPI) + Tailwind + shadcn/ui로 구현

**트리거:** 기능 구현, 컴포넌트/페이지 개발, API 엔드포인트 작성, DB 설계, 버그 수정, 리팩토링 등 kikhipster 개발 작업 요청 시 `orchestrate-kikhipster` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

---

## 문서 구조

**이 파일에는 작업 로그도 과제 목록도 적지 않는다.** 각각 전용 파일이 있다.

| 파일 | 역할 | 언제 읽나 | 누가 쓰나 |
|------|------|----------|----------|
| `CLAUDE.md` (이 파일) | 하네스 정의, 항구적 규약·함정 | 매 세션 자동 로드 | 규약이 바뀔 때만 |
| **`docs/TASKS.md`** | **할 일의 정본** — 차단 항목, 예정 과제, 현재 구현 범위 | 작업 시작 전 / "뭐 할까" 류 질문 | 과제가 생기거나 끝날 때 |
| **`docs/WORKLOG.md`** | **이력의 정본** — 세션 기록 + 커밋 이력 표 | 과거 판단의 이유를 찾을 때 | 커밋 이력은 hook이 자동, 세션 기록은 수동 |

- 작업을 시작하기 전에 `docs/TASKS.md` 를 읽는다. 과제를 끝냈으면 거기서 지우고 `docs/WORKLOG.md` 세션 기록에 남긴다.
- 커밋 이력 표는 `.claude/hooks/update-changelog.sh` 가 커밋 직후 `docs/WORKLOG.md` 에 자동으로 덧붙인다. 수동으로 채우지 말 것.
- **정본 문서는 Notion.** 큰 작업이 끝나면 갱신한다: https://app.notion.com/p/coding-sham/kikhipster-3af286f3bd70806597c2c64470a644ed

---

## 로컬 실행

```
npm run dev     # 루트에서 한 번에: DB 기동 → healthy 대기 → alembic upgrade → 백엔드(:8000) + 프론트(:3300)
```

런처는 `scripts/dev.mjs`(Node 기본 모듈만 사용, 루트 의존성 없음). 부품별로 돌릴 때는:

```
docker compose up -d                                            # Postgres, healthy 확인
cd backend  && ./venv/Scripts/python.exe -m alembic upgrade head
cd backend  && ./venv/Scripts/python.exe -m uvicorn main:app --reload --port 8000
cd frontend && npm run dev                                      # :3300
```

- **`.env` 를 고치면 백엔드를 반드시 재기동한다.** uvicorn `--reload` 는 `.py` 만 감시해서 `.env` 변경은 반영되지 않는다.
- OAuth Redirect URI는 **백엔드 8000** 이다 — 프론트 3300이 아니다. `http://localhost:8000/api/auth/callback/{google,kakao}`
- Kakao는 `KAKAO_CLIENT_ID` 에 **REST API 키**를 넣고, 사이트 도메인(`http://localhost:8000`)을 먼저 등록해야 Redirect URI 등록이 된다.

---

## 작업 시 유의사항

**실행·구조**
- **백엔드는 `backend/` 를 실행 루트로 고정한다.** `from config import settings` 같은 절대 경로 import를 쓰므로 루트에서 `uvicorn backend.main:app` 을 실행하면 `ModuleNotFoundError` 가 난다.
- **로컬 DB는 루트 `docker-compose.yml`** 로 띄운다 (`docker compose up -d`).

**과거에 실제로 터진 함정 — 반복하지 말 것**
- **`alembic.ini` 는 ASCII 전용으로 유지한다.** 한글 주석을 넣으면 Python 3.9 alembic이 ini를 OS 로케일(cp949)로 읽어 `UnicodeDecodeError` 가 난다. 한글 설명은 `alembic/env.py` 에.
- **응답 스키마에서 UUID PK를 `id: str` 로 선언하지 않는다.** Pydantic v2가 `UUID` → `str` 변환을 거부해 행이 생기는 순간 전수 500이 된다. `schemas/common.py` 의 `UUIDStr` 을 쓸 것.
- **모든 관계에 `cascade="all, delete-orphan", passive_deletes=True` 를 건다.** 빠뜨리면 부모 삭제 시 자식 FK를 NULL로 UPDATE하려다 `IntegrityError`.
- **iTunes `/lookup`에 앨범 ID + `entity=song`으로 트랙을 조회할 때 `country` 파라미터를 같이 넘기지 않는다.** 실제로 트랙이 0개로 잘리는 걸 확인함(`limit`도 생략하면 마찬가지). `collectionId`는 전역 고유값이라 country 없이도 정확히 찾힌다. `backend/services/music_api.py`의 `get_album_tracks` 참조.

- **shadcn 프리미티브의 색·크기를 덮을 때는 variant 까지 똑같이 써야 한다.** `cn()` 은
  `twMerge` 라 **variant 가 다르면 다른 그룹**으로 보고 둘 다 남긴다. 그러면 속성 선택자가
  붙은 기본값이 specificity 에서 이긴다. `SelectTrigger` 에 `h-11 bg-primary` 를 얹었더니
  기본값 `data-[size=default]:h-8` 과 `dark:bg-input/30` 이 이겨서 **클래스는 붙었는데
  높이 32px·회색인 채**로 렌더된 적이 있다(2026-08-27). 이 앱은 `<html class="dark">` 고정이라
  `dark:` variant 가 **항상** 적용된다는 걸 특히 잊지 말 것 — 덮으려면
  `data-[size=default]:h-11`, `dark:bg-primary` 처럼 같은 variant 로 다시 쓴다.
  **SSR HTML 에 클래스가 보이는 것은 적용됐다는 증거가 아니다.** 기본값이 사라졌는지를 본다.
- **다른 프리미티브를 버튼처럼 보이게 할 때는 `buttonVariants` 를 통째로 얹는다.** 색·높이만
  따로 맞추면 `border` 유무와 패딩이 어긋나 결국 다른 크기가 된다(`SelectTrigger` 로 실제로 겪음).
  덮을 것은 그 프리미티브 고유의 동작뿐이다 — select 라면 `justify-between` 정도.

**판단 기준**
- **화면만 보고 정상 동작을 판단하지 않는다.** (2026-08-20 이전엔 프론트가 호출 실패를 전부 `catch` 로 삼켜 에러 없이 빈 화면으로 렌더링됐다 — Server Component는 `app/error.tsx` 경계, Client Component는 `sonner` 토스트로 정리됨. 새 코드에서 같은 패턴을 반복하지 않는다.) 화면이 정상으로 보여도 `curl` 이나 백엔드 로그로 한 번 더 확인한다.
- **프론트 UI는 shadcn/ui 위에서 조립한다.** raw `<button>` + Tailwind로 새로 만들지 말고 `@/components/ui/*` 를 먼저 찾는다. 색상은 하드코딩(`bg-zinc-900`, `text-amber-400`) 대신 시맨틱 토큰(`bg-card`, `text-primary`, `text-muted-foreground`, `bg-accent`)을 쓴다. 토큰 정의·레퍼런스 근거는 `DESIGN.md`, 컴포넌트 조립 컨벤션은 `kikhipster-frontend` 스킬.

---

## 배포 원칙 (2026-08-14 확정)

**1차 목적은 서비스 상시 공개가 아니라 AWS 아키텍처 실습이다.** 두 가지 원칙이 따라온다:

- **부품을 우회하지 않는다.** ALB·ACM·보안그룹 체인은 우회 가능하지만(Cloudflare Tunnel 등으로 월 ~$20 절감) 그게 배우려는 대상이라 정공법으로 간다.
- **상시 구동하지 않는다.** `terraform apply` → 실습 → `terraform destroy` 사이클. **RDS "중지"는 최대 7일 후 자동 재시작되고 스토리지 과금도 계속되므로 의존하지 말 것.**

스택: 프론트 **Vercel Hobby**, 백엔드 **ECS Fargate**(퍼블릭 서브넷 + 공인 IP, **NAT 미사용**) + **ALB**, DB **RDS PostgreSQL** `db.t4g.micro`, 리전 **`us-east-1`**. 상시 월 ~$48이지만 실습 단위(주 2회 × 4시간)로는 **월 ~$2~4**. 전체 근거·비용표·주의점·로드맵은 Notion §11.

실습 단계별 과제는 `docs/TASKS.md` T4.

---

<!-- omd:start v=1 hash=a0905ab87d60 -->
# Design System (oh-my-design)

Read the standalone design contract at **@./DESIGN.md** before any UI,
styling, microcopy, or motion work. When a valid adopted Core v2
`.omd/system/manifest.json` declares `profile: portable-core` and binds exact
graph/projection hashes, the System Graph is machine authority and DESIGN.md is
its standalone projection. A migration candidate is never adopted authority.

Preference log (pending corrections): @./.omd/preferences.md

Precedence: pending explicit preference corrections > adopted Bound System
graph/standalone DESIGN.md > your defaults. Fold pending corrections into the
graph and regenerate the projection before clearing them.
<!-- omd:end -->
