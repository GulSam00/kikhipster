---
id: 20261112-1548-album-tracks-search-fallback-uses-kr
title: 앨범 상세 ③단계(검색으로 수록곡 채우기)가 `country=KR` 로 나가 0건일 가능성
status: later
priority: medium
created: 2026-11-12
external:
---

## 맥락

`backend/services/music_api.py` 의 `_search_album_tracks` 는 `get_album_tracks` 의 ③단계(lookup 이 트랙을 안 줄 때
검색으로 채우기)인데 `/search` 에 `"country": market` 을 그대로 넘긴다. 기본 market 이 KR 이라 실제 요청은
`/search?entity=song&country=KR` 이다. 그런데 CLAUDE.md 의 2026-09-10 실측은 **`/search` + `country=KR` 은
앨범·곡이 0건**이라고 적고 있고, 다른 검색 메서드는 그래서 `_search_country()` 를 거친다. 이 호출만 빠져 있다.

함수 docstring(2026-08-28)은 "검색 API는 KR 스토어에서도 preview_url 을 정상으로 준다"고 적어 서로 어긋난다.
어느 쪽이 맞는지 실측이 필요하다. 09-10 실측이 맞다면 KR 전용 앨범(aespa Armageddon 등) 상세의 트랙이
조용히 0개가 된다(404 가 아니라 빈 목록이라 에러도 안 난다).

이슈 20261027-0008(라우터 테스트)을 하다가 `tests/fake_itunes.py` 대역으로 확인했다 — 대역은 09-10 실측대로
KR 검색에 0건을 주며, 그 조건에서 ③단계 요청은 `country=KR` 로 나가고 트랙은 0개였다.

## 완료 조건

- [ ] 실제 iTunes 로 `/search?entity=song&country=KR&term=aespa Armageddon` 결과 건수를 실측해 기록
- [ ] 0건이면 `_search_album_tracks` 도 `_search_country(market)` 를 쓰게 고치고 `tests/test_music_storefront.py` 에 테스트 추가
- [ ] 수정했다면 `music_cache` 의 `album_tracks` 행 정리 필요 여부 판단(30일 TTL)

## 로그

- 2026-11-12: 이슈 20261027-0008 작업 중 발견, later 로 기록
