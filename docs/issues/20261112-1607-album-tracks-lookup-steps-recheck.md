---
id: 20261112-1607-album-tracks-lookup-steps-recheck
title: 앨범 상세 lookup ①②단계 동작이 2026-08-28 실측과 반대로 바뀜 — 재실측·정리
status: done
priority: low
created: 2026-11-12
external:
---

## 맥락

`backend/services/music_api.py` 의 `get_album_tracks` docstring 표(2026-08-28)는 KR 앨범 aespa Armageddon 이
① `/lookup?entity=song`(country 없음)에서 **결과 0**, ② `country=KR` 에서 collection 1 + track 0 이라고 적는다.
그래서 ①→②→③(검색) 순서가 생겼다.

2026-11-12 이슈 20261112-1548 작업 중 같은 앨범(collectionId 1773694541)을 다시 lookup 하니 반대였다 —
① collection 1 + **track 10**, ② **결과 0**. iTunes 동작이 바뀐 것으로 보인다. 지금은 ③에 도달하지 않고,
② 는 이 표본에서 아무것도 안 준다.

`backend/tests/test_music_storefront.py` 의 `test_kr_only_album_is_found_through_market_storefront` 주석
("실측: KR 앨범은 country 없는 entity=song 에서 결과 0")도 같은 옛 실측에 기댄다.

표본이 하나뿐이라 ② 를 지울 근거로는 부족하다. iTunes 호출 제한(분당 약 20회, 초과 시 HTTP 403)을 감안해 표본을 몇 개 더 잡아야 한다.

## 완료 조건

- [x] KR 앨범 3개 이상으로 ①·② 결과(collection/track 수) 재실측해 기록
- [x] ② 가 여전히 필요한지 판단하고, docstring 표와 위 테스트 주석을 실측에 맞게 갱신
- [x] 순서를 바꾸거나 단계를 지우면 `tests/test_music_storefront.py` 회귀 테스트 갱신 — 해당 없음(순서·단계 유지, 2026-11-19)

## 로그

- 2026-11-12: 이슈 20261112-1548 작업 중 발견, later 로 기록
- 2026-11-19: 착수
- 2026-11-19: 재실측(entity=song&limit=200, ①country 없음/②KR, collection+track) — KR 전용 ID 4개(aespa Armageddon KR판 1745285216·Whiplash KR판 1772644600·iScreaM Vol.26 1890393604, IU Believe in Love 1577664507) 전부 ①결과 0/②1+0; 그 밖 판·US 겸용 ID 5개(Armageddon 1773694541 1+10/0, LEMONADE 1893742002 1+12/0, Palette 1229073300 1+10/1+0, Get Up 1695951888 1+6/1+0, TELEVISION 1804661544 1+5/1+0); 대조군 Thriller 269572838 1+9/1+0. 403 재시도 6회(전부 검색 호출, 집계는 200 만).
- 2026-11-19: 판단 — iTunes 동작이 바뀐 게 아니라 aespa Armageddon 이 KR 판/그 밖 판으로 collectionId 가 다르고, 11-12 는 그 밖 판(1773694541)을 쟀다. 08-28 표는 KR 판 ID 로 그대로 재현된다. ② 는 KR 전용 ID 의 collection 을 주는 유일한 단계라 필요하고 ①→② 순서도 맞다 → 로직 변경 없음, 완료 조건 3 해당 없음. docstring 표·테스트 주석 갱신, done.
- 2026-11-19: 범위 밖 발견 — KR 전용 ID 는 ③ 검색으로도 트랙이 안 채워짐 → 이슈 20261119-1455-kr-only-album-id-no-tracks (later)
