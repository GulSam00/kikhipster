---
id: 20261026-2338-migrate-tasks-md-to-issues
title: docs/TASKS.md 항목을 이슈 파일로 옮길지 결정하고 이전
status: later
priority: low
created: 2026-10-26
external:
---

## 맥락

이슈 체계(`docs/issues/`)를 도입할 때 기존 `docs/TASKS.md`는 건드리지 않고 병행하기로 했다.
둘이 영구히 공존하면 "할 일의 정본"이 둘이 되므로, 체계가 안정되면 한쪽으로 합쳐야 한다.
CLAUDE.md 의 문서 구조 표가 `TASKS.md` 를 정본으로 정의하고 있어 이전하면 그 표도 고쳐야 한다.

## 완료 조건

- [ ] `TASKS.md` 의 예정 과제를 이슈 파일로 옮길지, `TASKS.md` 를 유지할지 결정
- [ ] 옮긴다면 항목별 이슈 생성 후 `TASKS.md` 에는 이슈 id 링크만 남기기
- [ ] CLAUDE.md 문서 구조 표의 `TASKS.md` 행 갱신

## 로그

- 2026-10-26: 체계 도입 때 예시 겸 첫 이슈로 기록
