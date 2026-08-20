# kikhipster 작업 로그

> 이 파일이 **작업 이력의 정본**이다. CLAUDE.md에는 이력을 적지 않는다.
> 아래 "커밋 이력" 표는 `.claude/hooks/update-changelog.sh` 가 커밋 직후 자동으로 한 줄씩 덧붙인다 — 수동으로 채우지 말 것.
> "세션 기록"은 커밋 메시지만으로 복원되지 않는 판단·검증 결과를 남기는 곳이다. 사람이 쓴다.

---

## 세션 기록

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
