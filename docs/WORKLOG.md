# kikhipster 작업 로그

> 이 파일이 **작업 이력의 정본**이다. CLAUDE.md에는 이력을 적지 않는다.
> 아래 "커밋 이력" 표는 `.claude/hooks/update-changelog.sh` 가 커밋 직후 자동으로 한 줄씩 덧붙인다 — 수동으로 채우지 말 것.
> "세션 기록"은 커밋 메시지만으로 복원되지 않는 판단·검증 결과를 남기는 곳이다. 사람이 쓴다.

---

## 세션 기록

### 2026-08-20 (계속) — 토너먼트 기획 변경, omd 스킬 3종 적용

**omd 스킬 적용**
- `omd-init` 시도했으나 중단 — 이번 세션에 코드 역추출로 이미 작성한 `DESIGN.md`(Netflix/Watcha 근거 포함)가 omd-init의 Core v2 그래프 파이프라인보다 이 프로젝트엔 더 정확해서, 새로 만들지 않고 기존 문서를 그대로 유지하기로 결정
- `omd-sync` 실행 — `CLAUDE.md`/`AGENTS.md`/`.cursor/rules/omd-design.mdc` shim 3종을 전부 신규 생성(기존에 하나도 없었음), `.omd/sync.lock.json`에 해시 기록. 김에 `CLAUDE.md`의 stale한 내용(catch{} 18곳·`text-violet-400` 예시)도 같이 정리
- `omd-reference-capture`는 후보로 검토했으나 보류 — Netflix/Watcha가 카탈로그 상 `legacy_snapshot`(재검증 필요) 상태지만 지금 급한 우선순위가 아니라고 판단

**토너먼트 백엔드 착수 → 기획 변경으로 보류**
- 현재 `tournament_rounds`가 트랙 ID만 저장하고 메타데이터가 없어 새로고침 시 복구가 안 된다는 문제로 서버 측 라운드 저장 + 복구 API를 설계하려 했으나, 실제 검증해보니 `GET /api/music/search/tracks`가 이미 500(Spotify 차단 여파)이라 착수 시점 자체가 안 맞다는 게 드러남
- 이 과정에서 사용자가 토너먼트 기획을 통째로 바꾸기로 결정: 서버에 라운드별 대진 기록을 저장하지 않고, **진행 상태는 프론트 `localStorage`에만**(새로고침은 견디되 기기 간 동기화는 포기), **완료 시엔 승패 기록이 아니라 트랙별 선택률/도달 라운드 기반 스코어만 서버에 POST**하는 방식으로 전환. 여러 유저 플레이가 쌓여 트랙 랭킹으로 집계되는 걸 노리는 설계. 정확한 스코어 산식은 미정
- **착수 시점을 T1(음악 API 교체) 이후로 명시적으로 미룸** — 지금 Spotify ID 기준으로 스키마를 짜봐야 곧 갈아엎어야 하기 때문. 코드 변경은 없었음(설계 단계에서 방향 전환), 상세는 `docs/TASKS.md` T3

### 2026-08-20 — 로컬 기동, OAuth 연결, Spotify 차단 확인, 문서 구조 개편

**로컬 3종 기동 검증**
- Docker Desktop 기동 → `kikhipster-db` healthy, Alembic은 이미 `1f0a9c2b7e3d (head)` 라 추가 마이그레이션 없음
- 백엔드 `:8000`, 프론트 `:3000` 정상. `GET /api/topsters/` → 200 `[]` 로 DB 경로까지 확인

**OAuth 연결 완료 (Google·Kakao)**
- 두 provider 모두 authorize 엔드포인트까지 실제 요청해 검증. Google은 `Sign in - Google Accounts` 페이지 200 (`redirect_uri_mismatch`·`invalid_client` 없음), Kakao는 `KOE***` 없이 로그인 페이지 도달
- 브라우저에서 실제 계정 동의하는 단계만 남음

**Spotify Web API 차단 확인 — 이번 세션 최대 발견**
- `api.spotify.com/v1/search` → 403 `"Active premium subscription required for the owner of the app."`
- 토큰 발급은 성공(140자)하므로 자격증명·대시보드 설정 문제가 **아니다**. 이 오진에 시간을 쓰지 않도록 `docs/TASKS.md` 차단 항목에 명시
- 결정: 구독하지 않고 다른 음악 API로 교체 (Deezer 유력)

**코드 조사로 드러난 것** (상세는 `docs/TASKS.md` T2·T3)
- 백엔드에 있는데 프론트가 안 쓰는 기능 4건 — 탑스터 수정/삭제, 댓글 수정, 앨범/트랙/아티스트 좋아요, 아티스트 앨범 목록
- 토너먼트 진행 상태가 React state에만 있어 새로고침에 소실됨
- 리뷰 기능은 목표에만 있고 모델·라우터·페이지·기획 전부 부재

**문서 구조 개편**
- 작업 로그(이 파일)와 과제(`docs/TASKS.md`)를 CLAUDE.md에서 분리. CLAUDE.md는 하네스 정의와 항구적 규약만 담고 두 파일을 포인터로 참조
- `update-changelog.sh` 의 기록 대상을 CLAUDE.md → `docs/WORKLOG.md` 로 변경. 컨텍스트를 잠식하지 않는 파일이 되었으므로 기존 15행 상한을 제거하고 전체 이력을 보존

**`DESIGN.md` 신설 — 프론트 디자인 시스템 정본화**
- 코드에서 역추출한 현재 상태(타이포·radius·spacing·component states·모바일 규칙)를 `DESIGN.md`로 문서화. `omd-designer-review` 스킬이 이걸 기준으로 audit
- 브랜드 컬러를 violet → **amber**로 교체(`frontend/app/globals.css`). violet은 근거 기록이 전혀 없던 값이었음을 커밋 이력(`2bcb79b`, `15d483d`)으로 확인 후 교체 — coral은 향후 포인트 강조용으로 보류
- oh-my-design 검증 레퍼런스 카탈로그(`C:\Users\qwerg\.claude\data\references\`)로 리서치: 카탈로그 인덱스(`reference-tags.md`, 94개)가 실제 카탈로그(440개)보다 훨씬 좁다는 것부터 발견. Spotify DESIGN.md는 최신 "증거 한정" 포맷이라 그리드/hover 정보가 없어 토큰 공급자로만 격하하고, **Netflix + Watcha**(둘 다 카탈로그 검증됨)를 그리드·hover·elevation 로직의 주 레퍼런스로 확정. 다크 표면값(`background`/`card`)은 zinc 그대로 유지하기로 결정 — 로직만 차용, 색값은 안 바꿈. 토너먼트 브래킷 트리는 카탈로그에도 카탈로그 밖(Letterboxd·RYM·AOTY·PIKU, 전부 403으로 관측 실패)에도 참고할 게 없어 자체 설계로 명시
- `omd-designer-review` 2라운드 실행(`홈페이지 app/page.tsx` 대상): round 1에서 BLOCK 3건(카드 focus-visible 누락 2건, 탑스터 그리드 셀의 컬러 예산 초과 1건) 발견 → focus-visible 추가 + DESIGN.md 컬러 예산 규칙에 "반복 콘텐츠 타일 예외" 조항 추가로 round 2에서 전부 RESOLVED. WARN 4건(섹션 헤더 크기 불일치, 임의 radius/폰트 크기 값, 컬러 예산 경계)은 미해결로 이월

**T3 리뷰 기능 — 결정 보류**
- `Comment` 모델이 `topster_id`에 고정돼 있어(`backend/models/comment.py`) 리뷰(앨범/아티스트/트랙 대상 별점+텍스트)를 댓글로 대체 불가함을 확인. 구현 vs CLAUDE.md 목표 제외, 결정은 보류하고 T3의 다른 항목부터 진행하기로 함

**T3 프론트 에러 처리 완료**
- `frontend/app/` 내 `catch {}` 18곳 중, Server Component 4곳(`page.tsx`, `topsters/page.tsx`, `albums/[id]`, `artists/[id]`)은 `sonner`가 클라이언트 전용이라 토스트를 못 씀 — 대신 `lib/api.ts`에 상태 코드를 보존하는 `ApiError` 클래스를 추가하고, 신설한 `app/error.tsx`(Next.js 라우트 에러 경계)로 처리. 기존 코드가 "fetch 실패"와 "진짜 404"를 `notFound()` 하나로 뭉개고 있던 것도 `ApiError.status === 404` 체크로 분리
- 나머지 Client Component 쪽 14곳은 `toast.error()`로 정리하되, 이미 토스트가 붙어 있던 5곳(`topsters/[id]/page.tsx`의 좋아요·댓글·링크복사, `topsters/new/page.tsx`의 저장 실패)은 손대지 않음. `profile/page.tsx`는 401(진짜 로그인 만료)과 그 외 에러를 분리해 후자는 더 이상 강제로 `/login`으로 쫓아내지 않고 재시도 UI를 보여주도록 수정
- 타입체크(`tsc --noEmit`) 통과, 주요 라우트 200 확인

### 2026-08-14 — 로컬 DB 검증 및 DB API 장애 3건 수정

`alembic upgrade head` 로 7개 테이블 생성 확인(스탬프 `1f0a9c2b7e3d`). 탑스터 생성/목록/상세·댓글·좋아요·토너먼트 생성·삭제 cascade까지 실제 호출로 확인. **DB 기반 API는 이 시점부터 검증된 상태다** — 더 이상 "500이라고 가정"하지 않아도 된다.

검증 중 드러난 버그 3건을 수정(`fb651dc`). 재발 방지 규약은 CLAUDE.md "작업 시 유의사항"으로 옮겼다. 상세는 Notion §7.2.

### 2026-08-13 — 배포 전 선행 작업

DB 설정 일원화, Alembic 도입, CORS 환경변수화, `backend/Dockerfile` 추가 (`2ad8388`).
배포 1차 목적을 "서비스 상시 공개"가 아니라 **AWS 아키텍처 실습**으로 재정의. 원칙과 스택은 CLAUDE.md 참조, 근거·비용표는 Notion §11.

### 2026-07-06 이전 — 초기 구축

Spotify 연동 백엔드, 프론트 기획(`_workspace/planning.md`), QA 리뷰(`_workspace/qa_report.md`), 전체 UI의 shadcn/ui 이관(PR #1).

---

## 커밋 이력

> `.claude/hooks/update-changelog.sh` 가 자동 기록한다. 전체 이력의 정본은 `git log`.

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
| 2026-08-19 | Merge pull request #2 from GulSam00/fix/db-api-local-verification | - | 커밋 `a913c75` |
| 2026-08-20 | docs: 작업 로그·과제를 CLAUDE.md에서 분리해 전용 파일로 이관 | .claude, CLAUDE.md, docs | 커밋 `a70d0b8` |
| 2026-08-20 | fix(hooks): 이력 행만 담은 커밋은 이력에 기록하지 않도록 수정 | .claude | 커밋 `68dce41` |
| 2026-08-20 | Merge branch 'docs/split-worklog-and-tasks' | - | 커밋 `1ad2940` |
| 2026-08-20 | feat(frontend): 디자인 시스템 정립 + API 에러 처리 정리 | .reviews, DESIGN.md, docs, frontend | 커밋 `d3300ba` |
