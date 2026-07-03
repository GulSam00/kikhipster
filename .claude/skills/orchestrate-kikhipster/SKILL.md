---
name: orchestrate-kikhipster
description: "kikhipster 음악 웹사이트의 모든 기능 개발을 조율하는 오케스트레이터. 아티스트/앨범 검색, 탑스터 제작/공유, 노래 토너먼트, 리뷰, 댓글, 좋아요 등 모든 기능 구현 요청, Next.js 컴포넌트/페이지 개발, FastAPI 엔드포인트 작성, DB 스키마 설계, 버그 수정, 리팩토링, 다시 실행, 업데이트, 이전 결과 개선 등 kikhipster 개발 작업이라면 반드시 이 스킬을 사용할 것."
---

# kikhipster 오케스트레이터

## 프로젝트 컨텍스트

- **Frontend:** Next.js 14+ (App Router, TypeScript) + Tailwind CSS — `frontend/`
- **Backend:** Python FastAPI + SQLAlchemy + PostgreSQL — `backend/`
- **OpenAPI:** 미정 — 연동 부분은 `services/music_api.py` 플레이스홀더로 처리
- **실행 모드:** 서브 에이전트 파이프라인 (파일 기반 데이터 전달)

## 에이전트 팀

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| architect | `.claude/agents/architect.md` | DB 스키마, API 스펙, 컴포넌트 트리 설계 |
| frontend-dev | `.claude/agents/frontend-dev.md` | Next.js + Tailwind 구현 |
| backend-dev | `.claude/agents/backend-dev.md` | FastAPI + SQLAlchemy 구현 |
| qa | `.claude/agents/qa.md` | 프론트-백 경계면 교차 검증 |

## Phase 0: 컨텍스트 확인

워크플로우 시작 전 기존 산출물 존재 여부를 확인한다:

- `_workspace/` 없음 → **초기 실행** (Phase 1부터 전체)
- `_workspace/` 있음 + 사용자가 특정 부분만 수정 요청 → **부분 재실행** (해당 에이전트만 재호출)
- `_workspace/` 있음 + 새 기능 요청 → **새 실행** (`_workspace/`를 `_workspace_prev/`로 이동 후 초기 실행)

## Phase 1: 기능 설계 (architect)

```
Agent(
  agent: "architect",
  model: "opus",
  prompt: """
    요청된 기능을 설계하라: {사용자 요청}

    kikhipster 프로젝트:
    - Frontend: Next.js (App Router, TypeScript) + Tailwind, frontend/ 디렉토리
    - Backend: Python FastAPI + SQLAlchemy + PostgreSQL, backend/ 디렉토리
    - OpenAPI 미정 — 연동 부분은 플레이스홀더 처리

    DB 스키마, API 엔드포인트, 컴포넌트 트리를 _workspace/01_architect_spec.md에 저장하라.
  """
)
```

## Phase 2: 병렬 구현 (frontend-dev + backend-dev)

architect 완료 후 두 에이전트를 병렬로 실행한다.

```
Agent(
  agent: "frontend-dev",
  model: "opus",
  run_in_background: true,
  prompt: """
    _workspace/01_architect_spec.md를 읽고 Next.js 프론트엔드를 구현하라.
    .claude/skills/kikhipster-frontend/SKILL.md의 컨벤션을 따른다.
    구현 완료 후 _workspace/frontend_done.md에 생성한 파일 목록을 기록하라.
  """
)

Agent(
  agent: "backend-dev",
  model: "opus",
  run_in_background: true,
  prompt: """
    _workspace/01_architect_spec.md를 읽고 Python FastAPI 백엔드를 구현하라.
    .claude/skills/kikhipster-backend/SKILL.md의 컨벤션을 따른다.
    구현 완료 후 _workspace/backend_done.md에 생성한 파일 목록을 기록하라.
  """
)
```

## Phase 3: 통합 검증 (qa)

두 에이전트 완료 후 qa를 실행한다.

```
Agent(
  agent: "qa",
  model: "opus",
  prompt: """
    frontend-dev와 backend-dev의 구현 결과를 검증하라.
    - backend/schemas/와 frontend/types/를 교차 비교
    - API 응답 shape과 프론트 훅/컴포넌트 접근 필드 비교
    결과를 _workspace/qa_report.md에 기록하라.
  """
)
```

## Phase 4: 결과 보고

사용자에게 다음을 요약한다:
1. 구현된 파일 목록 (`_workspace/frontend_done.md`, `_workspace/backend_done.md` 기반)
2. qa_report.md의 이슈 목록 (심각도 높은 순)
3. 남은 작업 / 다음 단계 제안

## 에러 핸들링

- architect 설계 실패 시: 사용자에게 기능 범위 재확인 요청, 진행하지 않는다.
- 에이전트 구현 실패 시: 1회 재시도. 재실패 시 해당 부분 제외하고 qa 보고서에 누락 명시.
- qa 이슈 발견 시: 해당 에이전트에게 수정 요청 후 재검증 1회.

## 테스트 시나리오

**정상 흐름 — "탑스터 기능 만들어줘":**
1. architect → `_workspace/01_architect_spec.md` 생성 (topsters 테이블, CRUD 엔드포인트, TopsterGrid 컴포넌트 트리)
2. frontend-dev → `frontend/app/topster/page.tsx`, `frontend/components/music/TopsterGrid.tsx`, `frontend/types/topster.ts`
3. backend-dev → `backend/routers/topster.py`, `backend/models/topster.py`, `backend/schemas/topster.py`
4. qa → 타입 불일치 없음 확인

**에러 흐름 — 타입 불일치:**
1. qa가 `is_public: string` (프론트) vs `is_public: bool` (백엔드) 불일치 발견
2. `_workspace/qa_report.md`에 심각도 높음으로 기록
3. frontend-dev에게 수정 요청 → `frontend/types/topster.ts` 수정 후 재검증
