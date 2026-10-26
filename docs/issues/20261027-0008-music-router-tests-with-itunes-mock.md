---
id: 20261027-0008-music-router-tests-with-itunes-mock
title: `/api/music/*` 라우터 테스트 (iTunes 목, KR→폴백 로직)
status: todo
priority: medium
created: 2026-10-27
external:
---

## 맥락

TASKS.md T3 '테스트 공백'. 백엔드 테스트는 auth·topster·tournament·comment·like·설정·iTunes 순수 함수와
아티스트 한국어 이름까지 덮지만 `/api/music/*` 라우터는 비어 있다.
가장 위험한 곳은 `_lookup_chunked` 의 KR 먼저 → 못 찾은 것만 country 없이 재조회하는 폴백이다.
이게 깨지면 저장된 탑스터의 커버가 조용히 사라진다(CLAUDE.md 참조).
`tests/test_artist_names.py` 의 `FakeService` + `httpx.MockTransport` 방식을 참고할 수 있다.

## 완료 조건

- [ ] iTunes 응답을 목으로 대체하는 픽스처 작성
- [ ] KR 응답에 없는 앨범이 country 없는 재조회로 채워지는 테스트
- [ ] 캐시 적중 시 iTunes 호출이 0회인 테스트
- [ ] 검색은 US 스토어프론트로 나가고 lookup 은 KR 로 나가는 테스트

## 로그

- 2026-10-27: TASKS.md T3 에서 옮겨 적음
