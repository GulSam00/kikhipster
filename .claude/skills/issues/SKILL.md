---
name: issues
description: 이 레포의 이슈/할 일을 파일(docs/issues/*.md)로 관리한다. 작업 중 버그·개선점·나중에 할 일을 발견했을 때, 할 일을 추가·조회·시작·완료·재개하라고 요청받았을 때, 작업 범위 밖의 문제를 발견했을 때, "이슈", "할 일", "TODO", "나중에", "백로그", "이어서 할 일" 같은 말이 나올 때 사용한다. 외부 트래커(Notion, GitHub Issues)는 쓰지 않는다.
---

# 이슈 관리

모든 상태는 레포 안 파일이다. 여러 머신에서 같은 레포를 쓰므로 **git 으로 동기화**되고, 충돌이 안 나게 **이슈 하나 = 파일 하나**다.
포맷과 예시는 `docs/issues/README.md`.

## 파일 규칙

- 위치: `docs/issues/<id>.md`
- id: `YYYYMMDD-HHmm-<kebab-slug>` — 현재 시각은 `date +%Y%m%d-%H%M` 로 얻는다. slug 는 영문 소문자·숫자·하이픈만, 3~5단어.
  순번(001…)은 쓰지 않는다 — 머신 간 중앙 시퀀스가 없어 충돌한다.
- frontmatter: `id`, `title`, `status`(todo|doing|later|done), `priority`(high|medium|low), `created`(YYYY-MM-DD), `external`(비워 둠)
- 본문 섹션: `## 맥락`, `## 완료 조건`(체크리스트), `## 로그`(날짜별 한 줄)
- `id` 는 파일명과 같아야 한다. 어긋나면 SessionStart 목록에서 "형식 오류"로 빠진다.
- **파일을 삭제하지 않는다.** 끝났으면 `status: done`, 접으려면 `later` 로 둔다.

## 언제 무엇을 하나

| 상황 | 동작 |
|---|---|
| 작업 중 **범위 밖** 문제·할 일 발견 | **고치지 않는다.** `status: later` 로 이슈를 만들고 사용자에게 **한 줄로만** 알린다(`이슈 기록: <id> — <제목>`). |
| 사용자가 할 일 추가 요청 | 이슈 생성. 지금 하겠다고 하면 `todo`, 안 정했으면 `later`. |
| 이슈 착수 | `status: doing` 으로 바꾸고 로그에 한 줄. |
| 완료 조건 하나 충족 | 체크박스 `- [x]` 로 갱신. |
| 완료 | 모든 체크 확인 후 `status: done`, 로그에 한 줄. |
| "뭐 남았어/할 일 보여줘" | `node .claude/skills/issues/list-issues.mjs` 를 실행해 보여 준다. |

로그는 `- 2026-10-26: 한 줄` 형식으로 **덧붙이기만** 한다(과거 줄을 고치지 않는다 — 머신 간 병합 충돌을 줄인다).

## 커밋·푸시

- 이슈 파일 변경은 **관련 코드 변경과 같은 커밋**에 넣는다.
- 이슈만 바뀌었으면 단독 커밋: `chore(issues): <무엇을>`
- **push 는 하지 않는다.** 세션을 마무리할 때 push 할지 사용자에게 묻는다.

## 하지 말 것

- **비밀값(.env 값, 토큰, 키, 비밀번호, 개인 URL 의 인증 파라미터)을 이슈에 적지 않는다.** 변수 *이름*이나 위치만 쓴다.
- `external` 필드를 채우지 않는다(나중에 외부 트래커와 연결할 자리다).
- 기존 `docs/TASKS.md` 를 이 체계로 옮기는 작업은 별도 요청이 있을 때만 한다. 당분간 둘이 병행된다.

## SessionStart 훅

`.claude/settings.json` 이 세션 시작 때 `list-issues.mjs` 를 실행해 열린 이슈를 출력한다.
upstream 보다 뒤처져 있으면 경고만 하고 자동 pull 은 하지 않는다. 훅이 실패해도 세션 시작은 막히지 않는다(항상 exit 0).
스크립트를 고쳤다면 `frontend/node_modules/.bin/tsc -p .claude/skills/issues` (frontend 의 `pnpm install` 이 돼 있어야 한다) 로 타입 체크한다.
