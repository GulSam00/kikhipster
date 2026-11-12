---
id: 20261112-1607-album-tracks-lookup-steps-recheck
title: 앨범 상세 lookup ①②단계 동작이 2026-08-28 실측과 반대로 바뀜 — 재실측·정리
status: later
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

- [ ] KR 앨범 3개 이상으로 ①·② 결과(collection/track 수) 재실측해 기록
- [ ] ② 가 여전히 필요한지 판단하고, docstring 표와 위 테스트 주석을 실측에 맞게 갱신
- [ ] 순서를 바꾸거나 단계를 지우면 `tests/test_music_storefront.py` 회귀 테스트 갱신

## 로그

- 2026-11-12: 이슈 20261112-1548 작업 중 발견, later 로 기록
