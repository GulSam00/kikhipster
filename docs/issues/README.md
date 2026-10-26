# 이슈 관리

레포 안 파일만으로 할 일을 관리한다. 외부 트래커는 쓰지 않는다. 여러 머신에서 같은 레포를 쓰므로 git 으로 동기화된다.
동작 규칙(언제 만들고 어떻게 커밋하나)은 `.claude/skills/issues/SKILL.md` 가 정본이고, 이 문서는 포맷 설명이다.

## 설계 결정

1. **이슈 하나 = 파일 하나** (`docs/issues/<id>.md`). 여러 머신에서 동시에 추가해도 같은 파일을 건드리지 않아 병합 충돌이 안 난다.
2. **id = `YYYYMMDD-HHmm-<kebab-slug>`**. 순번(001, 002)은 중앙 시퀀스가 필요해 머신 간에 충돌하므로 쓰지 않는다.
3. **파일을 삭제하지 않는다.** 완료는 `status: done`.
4. 로그는 **덧붙이기만** 한다. 과거 줄을 고치면 두 머신이 같은 줄을 바꿔 충돌한다.

## 포맷

```markdown
---
id: 20261026-2338-migrate-tasks-md-to-issues
title: 한 줄 제목
status: later          # todo | doing | later | done
priority: low          # high | medium | low
created: 2026-10-26
external:              # 비워 둠 (외부 트래커 연결용 자리)
---

## 맥락
왜 필요한지, 어디서 발견했는지.

## 완료 조건
- [ ] 검증 가능한 조건

## 로그
- 2026-10-26: 날짜별 한 줄
```

- frontmatter 는 `key: value` 한 줄씩만 쓴다(중첩·배열 불가).
- `id` 는 파일명(`.md` 제외)과 같아야 한다.
- 비밀값(.env 값, 토큰)은 절대 적지 않는다.

## status 의 뜻

| status | 뜻 |
|---|---|
| `doing` | 지금 하고 있다 |
| `todo` | 하기로 했다 |
| `later` | 발견했지만 지금 할 일은 아니다 (작업 범위 밖에서 발견한 것의 기본값) |
| `done` | 끝났다 (파일은 남긴다) |

## 목록 보기

세션을 시작하면 훅이 자동으로 출력한다. 직접 보려면:

```
node .claude/skills/issues/list-issues.mjs
```

`done` 을 뺀 열린 이슈를 status(doing→todo→later), priority(high→low) 순으로 한 줄씩 보여준다.
형식이 깨진 파일은 목록에서 빼고 끝에 "형식 오류"로 따로 알린다. 로컬이 upstream 보다 뒤처졌으면 경고만 하고 pull 은 하지 않는다.

## 예시

[`20261026-2338-migrate-tasks-md-to-issues.md`](20261026-2338-migrate-tasks-md-to-issues.md)

## 기존 `docs/TASKS.md` 와의 관계

당분간 병행한다. `TASKS.md` 를 이 체계로 옮기는 일은 위 예시 이슈로 추적한다.
