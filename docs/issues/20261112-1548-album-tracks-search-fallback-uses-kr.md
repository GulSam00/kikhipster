---
id: 20261112-1548-album-tracks-search-fallback-uses-kr
title: 앨범 상세 ③단계(검색으로 수록곡 채우기)가 `country=KR` 로 나가 0건일 가능성
status: doing
priority: high
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

- [x] 실제 iTunes 로 `/search?entity=song&country=KR&term=aespa Armageddon` 결과 건수를 실측해 기록
- [x] 0건이면 `_search_album_tracks` 도 `_search_country(market)` 를 쓰게 고치고 `tests/test_music_storefront.py` 에 테스트 추가
- [x] 수정했다면 `music_cache` 의 `album_tracks` 행 정리 필요 여부 판단(30일 TTL)

## 로그

- 2026-11-12: 이슈 20261027-0008 작업 중 발견, later 로 기록
- 2026-11-12: todo/high 로 승격, 착수
- 2026-11-12: 실측(`/search?entity=song&media=music&limit=200&term=aespa Armageddon`, 대상 collectionId 1773694541 = Armageddon - The 1st Album, 11곡) — KR 0건/일치 0, US 19건/일치 10, 생략 19건/일치 10(일치분 전부 previewUrl 있음). 2번째 표본 `IU Love poem`: KR 0건, US 14건(Love Poem - EP 6곡). 실제 검색어(`aespa Armageddon - The 1st Album`) US: 18건/일치 10. → KR 은 어떤 경우에도 0건이라 쓸모가 없고 US 가 트랙을 준다. `_search_country(market)` 적용(KR→US), docstring 의 "KR 에서도 정상" 서술 정정
- 2026-11-12: 부수 관찰 — 같은 앨범을 지금 lookup 하면 ①(country 없음)이 collection 1 + track 10 을 주고 ②(`country=KR`)는 0건이다. 2026-08-28 표와 반대라 이 앨범은 현재 ③까지 가지 않는다. ①②의 순서·필요성 재검토는 범위 밖이라 손대지 않음(later 이슈로 기록)
- 2026-11-12: 회귀 테스트 `test_album_tracks_search_fallback_goes_to_us_storefront` 추가 — 수정 전 코드에서 실패(요청 country=KR, 트랙 0개), 수정 후 통과. 대역(`fake_itunes.py`)은 KR 검색 0건으로 이미 실측과 일치해 고치지 않음
- 2026-11-12: 캐시 판단 — 정리 필요. `album_tracks` 는 `_detail_with_cache` 가 빈 `tracks` 결과도 그대로 30일(DETAIL_TTL_DAYS) 저장하므로, ③을 탔던 앨범은 수정 후에도 최대 30일간 트랙 0개로 보인다. 대상은 `item_type='album_tracks' AND item_id LIKE '%:KR' AND jsonb_array_length(payload->'tracks') = 0` 인 행만(트랙 있는 행은 영향 없음). DB 행 삭제는 되돌리기 어려운 동작이라 이번에 실행하지 않음 — 사용자가 개발 DB 에서 직접 실행할 것
- 2026-11-12: 검증 범위 — 실 PostgreSQL 미실행(컨테이너에 Docker 없음). `--noconftest` + 메모리 캐시 플러그인으로 test_music_storefront/router/helpers 43건 통과. 스토어프론트 테스트는 DB 를 쓰지 않지만 conftest(alembic upgrade) 경유 실행은 못 함. 그래서 status 는 doing 으로 둔다
