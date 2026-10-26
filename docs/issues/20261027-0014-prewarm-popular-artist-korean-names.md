---
id: 20261027-0014-prewarm-popular-artist-korean-names
title: 인기 아티스트 한국어 이름 미리 채우기 (검색 카드용)
status: later
priority: low
created: 2026-10-27
external:
---

## 맥락

한국어 이름은 아티스트 상세를 처음 열 때 찾아 저장하므로, 아직 열지 않은 아티스트는 검색 카드에서 영어로 보인다.
검색 한 번에 외부 호출을 N번 하지 않으려는 의도적 선택이다. 자주 검색될 아티스트를 배치로 미리 채우는 방법을 검토할 수 있다.
참고: 일반 검색어 표본에서 Wikidata 만으로는 한글 이름 적중이 약 41%였다(`_workspace/spike_ko_names_README.md`).
TASKS.md T5 ⑤('영어로 남는 것이 어색한지, 고칠 방법 없음')는 이 기능 이후 사실과 다르다.

## 완료 조건

- [ ] 미리 채울 대상 정의 (K-POP 인기 아티스트 목록 등)
- [ ] iTunes 분당 20회 제한과 Wikidata 예절을 지키는 배치 스크립트
- [ ] TASKS.md T5 ⑤ 문구 정리

## 로그

- 2026-10-27: PR #4 구현 중 나온 후속
